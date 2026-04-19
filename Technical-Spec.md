# Pila Lang — Technical Specification (v1)

## Overview

One Next.js 14 monolith. One Postgres database. One Redis instance (pub/sub + rate limiting + undo stack). One MinIO instance for blob storage. Self-hosted via Docker Compose for both local development and production. Real-time updates for guest wait and host queue are delivered via Server-Sent Events backed by Redis pub/sub. V1 ships as a browser-only web app; a Flutter native app (guest + host) against the same API is the v2 mobile path.

## Stack

| Layer                               | Choice                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| Language                            | TypeScript                                                   |
| Framework                           | Next.js 14 (App Router), long-running Node server            |
| Database                            | Postgres 16 (Compose service)                                |
| Cache / pub-sub / rate limit / undo | Redis 7 (Compose service)                                    |
| Blob storage                        | MinIO (Compose service, S3-compatible)                       |
| ORM                                 | Drizzle                                                      |
| Styling                             | Tailwind CSS                                                 |
| UI components                       | shadcn/ui                                                    |
| Client data fetching                | TanStack Query for mutations; native `EventSource` for SSE   |
| Admin auth                          | NextAuth (email magic links via Resend)                      |
| Host auth                           | Custom per-tenant shared password → JWT with rolling refresh |
| Rate limiting                       | `rate-limiter-flexible` backed by Redis                      |
| Hosting                             | Self-hosted Docker Compose                                   |
| Magic link email                    | Resend                                                       |
| Error tracking                      | None in v1 (container logs only)                             |

## Compose topology

Services:

- `app` — Next.js server. Long-running; handles HTTP + SSE.
- `postgres` — primary data store. Named volume for data.
- `redis` — pub/sub + rate limiting + undo stack. Named volume for AOF persistence.
- `minio` — S3-compatible blob store. Named volume for objects.
- `migrator` — one-shot container that runs `drizzle-kit migrate` and exits. `app` declares `depends_on: migrator: { condition: service_completed_successfully }`.

Local dev and production use the same `docker-compose.yml` with env overrides (`.env.dev`, `.env.prod`). No Vercel, no Neon, no Upstash, no Vercel Blob, no Sentry.

## Data model

### Tables

```sql
-- tenants: one row per restaurant
CREATE TABLE tenants (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text UNIQUE NOT NULL,
  name                   text NOT NULL,
  logo_url               text,
  accent_color           text NOT NULL DEFAULT '#1F6FEB',
  host_password_hash     text NOT NULL,
  host_password_version  int NOT NULL DEFAULT 1,
  timezone               text NOT NULL DEFAULT 'Asia/Kolkata',
  is_open                boolean NOT NULL DEFAULT true,
  is_demo                boolean NOT NULL DEFAULT false,
  current_qr_token       text,
  qr_token_issued_at     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- parties: every queue entry
CREATE TABLE parties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  phone          text,
  party_size     int NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  status         text NOT NULL CHECK (status IN ('waiting','seated','no_show','left')),
  session_token  text NOT NULL,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  seated_at      timestamptz,
  resolved_at    timestamptz
);

CREATE INDEX idx_parties_tenant_status ON parties(tenant_id, status);
CREATE INDEX idx_parties_tenant_phone  ON parties(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_parties_one_waiting_per_phone
  ON parties(tenant_id, phone) WHERE status='waiting' AND phone IS NOT NULL;

-- notifications: every notifier call (skipped with channel='noop' in v1)
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel     text NOT NULL,       -- 'noop' | 'sms' | 'whatsapp' | 'push'
  event_type  text NOT NULL,       -- 'joined' | 'ready'
  status      text NOT NULL,       -- 'skipped' | 'sent' | 'failed'
  payload     jsonb,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_party ON notifications(party_id);

-- admins: internal team accounts (not tenant-scoped)
CREATE TABLE admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  role        text NOT NULL DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Tenancy rules

- Every query on `parties` and `notifications` must filter by `tenant_id`. Enforce via a Drizzle service wrapper that accepts a `tenantId` parameter and rejects unscoped queries.
- `tenant_id` is never exposed to the frontend. Resolve it server-side from the URL slug on every request.
- The host-stand session JWT embeds the tenant slug and the tenant's `host_password_version` at issue time. If the slug in a request URL does not match the slug in the session, respond with 403. If the version in the JWT is less than the current `host_password_version`, respond with 401 and clear the cookie.

### Slug rules

- Pattern: `^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$` (lowercase alphanumerics and hyphens, 3–32 chars, no leading or trailing hyphen).
- Reserved list (rejected at creation): `admin`, `api`, `r`, `host`, `display`, `www`, `public`, `static`, `_next`, `well-known`, `health`.
- Immutable after creation. Rebrands require a new tenant row and a manual migration outside the app.

## URL and route structure

### Public (guest)

| Path                       | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `/`                        | Marketing page (minimal in v1)                                                |
| `/r/<slug>?t=<token>`      | Join page (validates QR token; shows hard-close banner when tenant is closed) |
| `/r/<slug>/wait/<partyId>` | Guest wait page (opens SSE stream)                                            |
| `/display/<slug>`          | QR display page (polls for fresh token every 60s)                             |

### Host stand

| Path                    | Purpose                            |
| ----------------------- | ---------------------------------- |
| `/host/<slug>`          | Login page (shared password)       |
| `/host/<slug>/queue`    | Main queue view (opens SSE stream) |
| `/host/<slug>/settings` | Name, logo, color, password        |
| `/host/<slug>/guests`   | Guest history                      |

### Admin (internal)

| Path                  | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `/admin`              | Magic-link login                                       |
| `/admin/tenants`      | Tenant list and create form                            |
| `/admin/tenants/<id>` | Single-tenant edit, demo controls, reset host password |

### API

| Path                                     | Method | Purpose                                                                           |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `/api/r/<slug>/join`                     | POST   | Create party (valid QR token and `tenant.is_open` required)                       |
| `/api/r/<slug>/parties/<id>/stream`      | GET    | SSE stream of party status (guest). 204 if party already resolved                 |
| `/api/r/<slug>/parties/<id>/leave`       | POST   | Guest leaves queue                                                                |
| `/api/display/<slug>/token`              | GET    | Current signed QR token + `isOpen` flag                                           |
| `/api/host/<slug>/login`                 | POST   | Exchange password for host session JWT                                            |
| `/api/host/<slug>/logout`                | POST   | Clear host session cookie                                                         |
| `/api/host/<slug>/queue/stream`          | GET    | SSE stream of the queue (host)                                                    |
| `/api/host/<slug>/parties/<id>/seat`     | POST   | Host seats party                                                                  |
| `/api/host/<slug>/parties/<id>/remove`   | POST   | Host marks party no-show                                                          |
| `/api/host/<slug>/undo`                  | POST   | Undo last host action for this tenant (shared across sessions)                    |
| `/api/host/<slug>/open`                  | POST   | Toggle queue open/closed                                                          |
| `/api/host/<slug>/settings`              | POST   | Update name and accent color                                                      |
| `/api/host/<slug>/settings/logo`         | POST   | Upload logo (multipart)                                                           |
| `/api/host/<slug>/password`              | POST   | Rotate shared host password; bumps `host_password_version`                        |
| `/api/admin/tenants`                     | GET    | List all tenants                                                                  |
| `/api/admin/tenants`                     | POST   | Create tenant; response includes the auto-generated initial host password once    |
| `/api/admin/tenants/<id>`                | PATCH  | Update name, logo, accent_color, timezone, is_demo, is_open                       |
| `/api/admin/tenants/<id>`                | DELETE | Hard-delete tenant (force-closes first, then CASCADE wipes parties/notifications) |
| `/api/admin/tenants/<id>/toggle-demo`    | POST   | Flip `is_demo`                                                                    |
| `/api/admin/tenants/<id>/reset-demo`     | POST   | Clear and re-seed demo data                                                       |
| `/api/admin/tenants/<id>/reset-password` | POST   | Rotate host password                                                              |

## Key technical flows

### Real-time transport (SSE + Redis pub/sub)

- Guest wait page and host queue page open an `EventSource` to their respective `/stream` endpoints.
- Each stream handler subscribes to one or more Redis channels:
  - `tenant:<slug>:queue` — host view; fired on every party status change in this tenant, plus `tenant:closed` / `tenant:opened` / `tenant:reset`
  - `party:<id>` — guest view; fired for this party's own status changes **and** for position changes when the queue ahead of it shifts
- Every write path that changes queue state (`join`, `seat`, `remove`, `leave`, `open`, `undo`, stale-cleanup) publishes events after the DB write commits:
  - One event on `tenant:<slug>:queue` carrying the full affected row (see _Event payloads_ below).
  - On any change that reorders the waiting list, one `position_changed` event on **each** still-waiting `party:<id>` with `{ type: 'position_changed', position }`. Implement as a single helper `publishPositionUpdates(tenantId, slug)` — see _Position-update helper_ below.
- **Stream setup order is load-bearing.** The handler subscribes to its Redis channel(s) **first**, then reads the snapshot from Postgres, then sends the snapshot as the initial SSE event, then forwards live events as diffs. Subscribing after the snapshot read would drop any event published in the gap between the two — the client would be silently out of sync until the next reconnect.
- **Event payloads.** Diffs carry the data the client needs to render without an extra fetch:
  - `party:joined` → `{ type, id, name, partySize, phone, joinedAt }`
  - `party:seated` / `party:removed` / `party:left` → `{ type, id, status, resolvedAt }`
  - `party:restored` (undo) → `{ type, id, name, partySize, phone, joinedAt }` (full row, since the client re-inserts it into the waiting list at its original `joined_at` position)
  - `position_changed` (guest channel only) → `{ type, position }`
  - `status_changed` (guest channel) → `{ type, status }` and, for terminal statuses, `resolvedAt`
- **Keep-alive.** Each open stream writes a `:ping\n\n` comment every 15 seconds. `EventSource` ignores comment lines, but the bytes prevent reverse proxies (nginx, Caddy, Cloudflare, ALBs) from closing idle connections. Implement as a single `setInterval` per open stream, cleared on close.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (prevent proxy buffering).
- **Terminal-state handling.** When a party reaches a terminal status (`seated`, `no_show`, `left`), the server emits one final SSE event and closes the stream. If the client reconnects to a stream whose party is already in a terminal status, the server responds **204 No Content**, which tells `EventSource` to stop retrying.
- Client reconnection is automatic via `EventSource`; on reopen (for still-active parties), the handler re-flushes the current snapshot.
- **Single app container in v1.** Redis pub/sub is wired in so horizontal scaling is a compose change later, but v1 assumes one Node process handles all SSE connections.
- Display page stays on a 60-second poll — token rotation is a timer, not an event, and SSE adds no value there.

### Position-update helper

`publishPositionUpdates(tenantId, slug)` is the single implementation called from every write path that shifts the waiting list — specifically `seat`, `remove`, `leave`, and `undo`. Join skips it: appending to the tail doesn't change anyone else's rank. Internals:

1. Select all `waiting` parties for `tenantId` ordered by `joined_at ASC`, returning their `id`s.
2. For each row at zero-indexed position `i`, publish `{ type: 'position_changed', position: i + 1 }` on `party:<id>`.

Concentrating the rank math in one place is load-bearing: a write path that forgets to call this leaves guests staring at a stale position until they happen to reconnect. The helper is the only code that publishes `position_changed` events.

### Wait-time ticker

The host queue and guest wait pages show a live "time waited" string (e.g. "12m ago"). The server sends `joined_at` as an ISO string once in the SSE snapshot; the client computes the duration via a single `setInterval` that re-renders once per second. No server-side ticker events.

### QR token rotation

Tokens are HMAC-SHA256 signatures of `<tenantSlug>:<issuedAtMs>` using `process.env.QR_TOKEN_SECRET`.

On `GET /api/display/<slug>/token`:

```ts
const tenant = await getTenantBySlug(slug);
const now = Date.now();
if (!tenant.currentQrToken || now - tenant.qrTokenIssuedAt > 60 * 60_000) {
  const payload = `${slug}:${now}`;
  const sig = hmacSha256(payload, process.env.QR_TOKEN_SECRET);
  const token = `${base64urlEncode(payload)}.${sig}`;
  await updateTenant(tenant.id, {
    currentQrToken: token,
    qrTokenIssuedAt: now,
  });
  return { token, validUntilMs: now + 65 * 60_000, isOpen: tenant.is_open };
}
return {
  token: tenant.currentQrToken,
  validUntilMs: tenant.qrTokenIssuedAt + 65 * 60_000,
  isOpen: tenant.is_open,
};
```

On `GET /r/<slug>?t=<token>`:

```ts
const [payloadB64, sig] = token.split(".");
const payload = base64urlDecode(payloadB64);
const [tokenSlug, issuedAtStr] = payload.split(":");
if (tokenSlug !== slug) return invalidToken();
if (!timingSafeEqual(sig, hmacSha256(payload, SECRET))) return invalidToken();
if (Date.now() - Number(issuedAtStr) > 65 * 60_000) return expiredToken();
if (!tenant.is_open) return closedBanner();
// Valid - render join form
```

The display page SSR-prefetches the initial token and `isOpen` flag on the server and embeds them into the rendered HTML, so the QR paints immediately with no client-side loading flash. TanStack Query then takes over with a 60-second refetch interval and re-renders the QR component (`qrcode.react`) on every token change. A 5-minute overlap between issuance and expiry ensures no dead zone during rotation. When `isOpen === false`, the display replaces the QR with a "not accepting guests right now" banner.

### Queue closed (`tenant.is_open = false`) behavior

Hard close:

- `POST /api/r/<slug>/join` → 409 with `{ error: 'tenant_closed' }`.
- `GET /r/<slug>?t=<token>` → renders "not accepting guests right now" instead of the join form.
- `GET /display/<slug>` → shows closed banner instead of the QR.
- Existing waiting parties keep their SSE stream; `GET /r/<slug>/wait/<id>` continues to render; the host can still seat/remove them.
- `POST /api/host/<slug>/open` toggles the flag and publishes `tenant:closed` or `tenant:opened` on `tenant:<slug>:queue` so host UIs update immediately.

### Guest session

On `POST /api/r/<slug>/join`:

1. Validate the QR token.
2. Reject with 409 if `tenant.is_open === false`.
3. If the phone is already associated with a `waiting` party at this tenant, return 409 `{ error: 'already_waiting' }`. The unique index (`idx_parties_one_waiting_per_phone`) is the source of truth — the handler does a pre-check for a fast path, and separately catches a Postgres `23505` on insert to cover the race between two concurrent joins. Both routes return the same 409 shape.
4. Generate `session_token = crypto.randomUUID()`.
5. Insert the party row.
6. Call `notifier.onPartyJoined(party)` — in v1 this is a literal no-op; no notifications row is written.
7. Check for past entries with the same phone at the same tenant; if any, set cookie `welcome_back=1; Max-Age=300; SameSite=Lax` (not HttpOnly, since the client reads it). The 5-minute window gives the wait page time to paint on slow mobile before the banner is missed, and is still short enough that a shared device doesn't leak the banner to the next guest.
8. Publish `{ type: 'party:joined', id, name, partySize, phone, joinedAt }` on `tenant:<slug>:queue`. Position updates are not needed here — joining appends to the end, so existing waiters' ranks are unchanged.
9. Set response cookie: `party_session=<session_token>; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`.
10. Return `{ partyId, waitUrl }`.

On `GET /api/r/<slug>/parties/<partyId>/stream` (SSE):

1. Read `party_session` cookie.
2. Load the party by id.
3. If the party row no longer exists (e.g., wiped by a demo-tenant reset), respond **204** — the client's cookie is orphaned; the wait page renders a generic "session ended" terminal screen.
4. Verify `party.sessionToken === cookie` and `party.tenantId === resolveSlug(slug)`. Reject with 403 on mismatch.
5. If the party is already in a terminal status, respond **204** (tells `EventSource` not to retry).
6. Subscribe to the `party:<id>` Redis channel, buffering any incoming events. This happens **before** the snapshot read so events published between read and subscribe aren't lost (see _Stream setup order_ in §Real-time transport).
7. Compute current position (count of `waiting` parties at this tenant ordered by `joined_at`, find target's rank). Emit initial `snapshot` SSE event: `{ type: 'snapshot', status, position, name, joinedAt }`.
8. **Refresh the `party_session` cookie** on the response: re-set with a fresh 24h `Max-Age`. A long wait no longer expires the session out from under the guest.
9. Drain the subscription buffer, then forward live `status_changed` and `position_changed` events as SSE messages. Write a `:ping` comment every 15 seconds.
10. When a non-`waiting` status is observed, emit one final event and close the stream.

On revisit to `/r/<slug>?t=<token>`:

- If the cookie resolves to an active `waiting` party at this tenant, redirect to `/r/<slug>/wait/<partyId>`.
- Otherwise, render the join form normally (or the closed banner if not open).

### Post-seat state

When the host seats a party, `resolved_at` is set and `status = 'seated'`. The guest's SSE stream emits a final event and the server closes the connection. The wait page swaps to a terminal "your table is ready — head to the host" screen. No further streaming or polling. If the guest revisits `/r/<slug>/wait/<partyId>`, the cookie still resolves the party and the terminal screen renders from the first hydration event. We do not track whether they actually arrived.

### Guest leave flow

Wait page shows a "Leave queue" button. Tapping it reveals an inline "Are you sure?" confirm (no modal). Confirm calls `POST /api/r/<slug>/parties/<id>/leave`:

1. Auth: `party_session` cookie matches party row.
2. Reject with 409 if `party.status !== 'waiting'`.
3. Update `status = 'left'`, `resolved_at = now()`.
4. Publish `{ type: 'status_changed', status: 'left', resolvedAt }` on `party:<id>` and `{ type: 'party:left', id, status: 'left', resolvedAt }` on `tenant:<slug>:queue`; then call `publishPositionUpdates` so remaining waiters see their new ranks.
5. Return 200.

The page transitions to a "you've left the queue" terminal state. Every other waiter's position advances via SSE.

### Notifier interface

Collapsed to two events: "joined" (on insert) and "ready" (on host seat). The v0 `onPartyCalled` / `onPartySeated` split is removed — v1 is a single-tap "Seat" action.

```ts
export interface Notifier {
  onPartyJoined(party: Party): Promise<void>;
  onPartyReady(party: Party): Promise<void>;
}

export class NoopNotifier implements Notifier {
  async onPartyJoined(_party: Party) {
    /* intentionally empty in v1 */
  }
  async onPartyReady(_party: Party) {
    /* intentionally empty in v1 */
  }
}
```

V1 wires `NoopNotifier` at app startup. The call sites in `join` and `seat` still `await` the notifier, so adding a real implementation later is a one-line wiring change. The notifications table stays empty in v1; a future `WhatsAppNotifier` or `SmsNotifier` writes rows with `status='sent'` or `'failed'` and the table becomes a true audit log of outbound comms. An `onPartyNoShow` hook can be added later without changing v1 call sites.

### Assisted FIFO queue

No algorithmic "next" selection. The host stand renders parties in arrival order with Seat and Remove buttons per row. The host picks based on judgment.

```ts
// POST /api/host/<slug>/parties/<id>/seat
const party = await loadPartyInTenant(id, tenantId);
if (party.status !== "waiting") return conflict();
const resolvedAt = now();
await db
  .update(parties)
  .set({
    status: "seated",
    seated_at: resolvedAt,
    resolved_at: resolvedAt,
  })
  .where(and(eq(parties.id, id), eq(parties.tenantId, tenantId)));
await notifier.onPartyReady(party);
await pushUndoFrame(tenantId, {
  action: "seat",
  partyId: id,
  previousStatus: "waiting",
  timestamp: Date.now(),
});
await publish(`tenant:${slug}:queue`, {
  type: "party:seated",
  id,
  status: "seated",
  resolvedAt,
});
await publish(`party:${id}`, {
  type: "status_changed",
  status: "seated",
  resolvedAt,
});
await publishPositionUpdates(tenantId, slug); // emits position_changed on every still-waiting party:<id>
```

### Undo (Redis-backed, shared per tenant)

Each host action pushes a frame to a Redis list keyed by the **tenant**: `undo:tenant:<tenantId>`. Frame shape: `{ action, partyId, previousStatus, timestamp }`. The Redis key carries a 5-minute TTL as a safety cleanup; undo-eligibility is governed by the per-frame 60-second window checked on pop — the TTL only matters so the key doesn't leak if no one ever pops. Any logged-in host session for this tenant can undo the last action, regardless of which device originally took it.

`POST /api/host/<slug>/undo`:

1. `LPOP undo:tenant:<tenantId>`.
2. If no frame, return 409.
3. If `Date.now() - frame.timestamp > 60_000`, return 409 (too old).
4. Reverse the status change (e.g. `seated → waiting`, `no_show → waiting`, `left → waiting`), clearing `seated_at` and `resolved_at` as appropriate. The party's `joined_at` is never changed, so on restoration they re-appear at their original position in the FIFO order.
5. Publish `status_changed` on `party:<id>` (with `status: 'waiting'`) and a `party:restored` event carrying the full row on `tenant:<slug>:queue` so the host re-inserts it at its original `joined_at`. Then call `publishPositionUpdates` so other waiters see their shifted ranks.
6. Return 200.

Redis is the source of truth for undo state; losing the list on a Redis flush is acceptable (undo is a 60-second affordance, not durable state). `LPOP` is atomic, so a simultaneous undo press from two devices resolves to exactly one successful undo and one 409.

### Recently-resolved view

The host queue page shows waiting parties as the primary list, followed by a collapsible "Recently resolved (last 30 min)" panel. Both lists ship in the initial SSE snapshot on `GET /api/host/<slug>/queue/stream`:

```ts
// initial SSE event shape for host queue stream
{
  type: 'snapshot',
  tenant: { name, isOpen, logoUrl, accentColor },
  waiting: [{ id, name, partySize, phone, joinedAt }],
  recentlyResolved: [{ id, name, partySize, status, resolvedAt }],
}
```

Query for the resolved list:

```sql
SELECT id, name, party_size, status, resolved_at
FROM parties
WHERE tenant_id = $1
  AND status IN ('seated', 'no_show', 'left')
  AND resolved_at > now() - interval '30 minutes'
ORDER BY resolved_at DESC
LIMIT 10;
```

Subsequent SSE diff events (`party:joined`, `party:seated`, `party:removed`, `party:left`, `party:restored`) update both lists on the client. Each resolved row renders an inline Undo button that is enabled only while the 60-second undo window is still open. The permanent guest history tab is a separate route (`/host/<slug>/guests`) that groups by phone across all time.

**Aging out.** Resolved rows disappear from the panel once `resolved_at` is older than 30 minutes. No server-side event fires for this transition — the client filters by `resolved_at > now() - 30min` on each render tick (the same interval that drives the wait-time ticker). On SSE reconnect, the fresh snapshot already excludes anything stale, so the list self-corrects.

**Known tradeoff.** A backgrounded host tab whose `setInterval` is throttled by the browser may hold a stale row past the 30-minute cutoff. The row is still correctly marked resolved, its 60-second undo window has long since closed, and the inline Undo button is already disabled — so the worst case is cosmetic. When the host refocuses the tab, the SSE reconnect replaces the entire list with a fresh snapshot, self-healing the display.

### Returning-guest recognition

On join (step 7 above), after inserting the new party:

```ts
const previous = await db
  .select()
  .from(parties)
  .where(
    and(
      eq(parties.tenantId, tenantId),
      eq(parties.phone, submittedPhone),
      ne(parties.id, newPartyId),
    ),
  );
if (previous.length > 0) {
  response.cookies.set("welcome_back", "1", { maxAge: 300, sameSite: "lax" });
}
```

The wait page reads this cookie on first render, shows a "welcome back" banner, and clears the cookie.

For the `/host/<slug>/guests` page:

```sql
SELECT
  phone,
  (ARRAY_AGG(name ORDER BY joined_at DESC))[1] AS most_recent_name,
  COUNT(*) AS visits,
  MAX(joined_at) AS last_visit
FROM parties
WHERE tenant_id = $1 AND phone IS NOT NULL
GROUP BY phone
ORDER BY last_visit DESC
LIMIT 25 OFFSET $2;
```

### Demo tenant reset

There is one shared `demo` tenant. Sales people are listed in `ADMIN_EMAILS` and reset it between pitches via `/admin`.

`POST /api/admin/tenants/<id>/reset-demo`:

1. Verify `is_demo = true` and the caller is an authenticated admin.
2. Delete all parties and notifications for that tenant.
3. Insert 10 historical parties with `status='seated'`, varied names, party sizes, phones, and `joined_at` / `seated_at` back-dated across the past 14 days. These populate the guest-history tab.
4. Insert 3 waiting parties with staggered `joined_at` (e.g. now - 12m, now - 5m, now - 1m), deterministic names (e.g. Priya Sharma, Raj Patel, Anya Lim), party sizes 2/4/2.
5. Publish a `{ type: 'tenant:reset' }` event on `tenant:demo:queue` so any host view currently open on the demo tenant re-fetches its snapshot.
6. Return 200.

All seeded rows get a random `session_token` so the schema invariant holds even though no guest device will use them.

### Tenant delete

`DELETE /api/admin/tenants/<id>`:

1. In a single transaction: set `is_open = false`; transition any still-`waiting` parties to `status = 'no_show'` with `resolved_at = now()`, capturing the affected `id`s via `RETURNING`; then `DELETE FROM tenants WHERE id = $1`. The `parties` and `notifications` foreign keys are `ON DELETE CASCADE`, so the row removal wipes all attached data atomically. Hold the returned party IDs in application memory for step 2.
2. After the transaction commits, publish `tenant:closed` on `tenant:<slug>:queue` so active host UIs transition to a closed state, and a final `status_changed` with `status: 'no_show'` on each affected `party:<id>` (using the IDs captured in step 1) so open guest streams emit one terminal event and close. Publishing after commit matches the global rule in _Real-time transport_ — no phantom closures if the transaction aborts. Subsequent guest reconnects hit the SSE terminal path and receive 204 — the wait page renders a generic "queue ended" screen with no PII about the tenant.
3. Return 200.

Hard-delete is irreversible; the admin UI gates the action behind a typed-slug confirmation prompt. No soft-delete window in v1. If a restore path is needed later, add `deleted_at` and a separate purge job — not in v1 scope.

## Authentication

### Guest

No account. The `party_session` cookie keyed to the party row provides return access. Cookie TTL is 24 hours.

### Host stand

`POST /api/host/<slug>/login` with `{ password }`:

1. Load the tenant by slug.
2. Bcrypt-compare against `tenants.host_password_hash`.
3. Issue JWT: `{ tenantSlug, jti, pwv: host_password_version, iat, exp: iat + 12h }` signed with `HOST_JWT_SECRET`.
4. Set cookie: `host_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`.

All `/host/<slug>/*` routes and `/api/host/<slug>/*` endpoints verify the JWT. Checks:

- If the slug in the URL does not match the slug in the JWT, respond 403.
- If the `pwv` in the JWT is less than the current `tenants.host_password_version`, respond 401 and clear the cookie. This is how password rotation invalidates other devices.

**Silent rolling refresh.** Middleware on all host routes verifies the JWT. If valid and less than 1 hour of validity remains, it signs a fresh JWT (same `jti`, same `pwv`, new `iat`/`exp`) and sets a new cookie on the response. An active host never sees a logout mid-shift; an idle host still expires at 12h.

**Password rotation.** `POST /api/host/<slug>/password`:

1. Verify current host session.
2. Validate the submitted password: minimum 8 characters. No complexity requirement — hosts often write the password on a sticky note on the tablet, and unusable passwords are worse than merely-short ones. Login rate limiting (10/hour per IP) is what actually blocks brute force.
3. Hash the new password with bcrypt (cost ≥ 10).
4. In one transaction: write the new hash and `host_password_version = host_password_version + 1`.
5. Re-issue the caller's cookie with a JWT carrying the new `pwv` (so the current device stays logged in; other devices get 401 on their next request).
6. Return 200.

**Logout.** `POST /api/host/<slug>/logout` clears the `host_session` cookie. It does not touch Redis or the DB; other sessions for the same tenant are unaffected.

**Log out all devices.** A button on the settings page calls `POST /api/host/<slug>/password` with `{ logoutOthers: true }` — the server increments `host_password_version` without rotating the hash, re-issues the caller's cookie with the new `pwv`, and every other device gets 401 on its next request. Matches the password-rotation invalidation path so there's a single kick-sessions mechanism.

### Admin

NextAuth email provider with magic links delivered via Resend. The `ADMIN_EMAILS` environment variable is a comma-separated allow list checked in a NextAuth callback before any sign-in completes. The `admins` table is in the schema for future DB-backed management but is unused in v1. Rotating the allow list requires a container restart; acceptable while the internal team is small.

## Rate limiting

Redis-backed sliding-window limits via `rate-limiter-flexible`. Default key is the client IP unless otherwise specified.

| Endpoint                                | Limit                                                     | Key                         |
| --------------------------------------- | --------------------------------------------------------- | --------------------------- |
| `GET /r/<slug>` with token              | 30/minute                                                 | IP                          |
| `POST /api/r/<slug>/join`               | 10/hour per phone (if phone present), else 10/hour per IP | phone when present, else IP |
| `POST /api/r/<slug>/join` (global)      | 200/hour per tenant                                       | tenant                      |
| `GET /api/r/<slug>/parties/<id>/stream` | 10 new connections/minute                                 | IP                          |
| `GET /api/host/<slug>/queue/stream`     | 30 new connections/minute                                 | IP + slug                   |
| `POST /api/host/<slug>/login`           | 10/hour                                                   | IP                          |

Keying join by phone fixes the restaurant-NAT problem where every guest shares one public IP. The per-tenant global cap is a belt-and-braces guard against abuse if a join URL leaks. Keying the host queue stream by (IP, slug) prevents one tenant's flaky-wifi reconnect storm from starving hosts at another tenant that happens to share the same upstream IP (unlikely but costs nothing to guard against), and also lets a multi-tablet restaurant stack reconnects without clipping.

Responses at the limit return 429 with a `Retry-After` header.

## Branding and theming

Per-tenant CSS custom property:

```tsx
<html style={{ '--accent': tenant.accentColor } as React.CSSProperties}>
```

Tailwind's config maps a custom `accent` utility to `var(--accent)`. Components that render text on the accent color pick the foreground (black or white) at render time based on whichever has the higher contrast ratio against `--accent`.

**Accent color validation.** On `POST /api/host/<slug>/settings` (and the admin PATCH), the server computes WCAG contrast of the submitted hex against both black and white. If both fail AA (4.5:1), reject with 422 and a human-readable error. This guarantees the render-time auto-pick always yields a legible foreground.

**Logo pipeline.**

- Accepted input: PNG or JPG, up to 500KB. SVG is rejected.
- `POST /api/host/<slug>/settings/logo` (multipart) streams the upload to memory, validates MIME + decoded dimensions, then re-encodes with `sharp` to a 512×512 PNG with transparent letterboxing to preserve aspect ratio. The output is typically under 100KB.
- Written to the MinIO `logos/` bucket at key `<tenantId>/<epochMs>.png`. `tenants.logo_url` stores the direct MinIO URL. The previous logo object is deleted after a successful write.
- The `logos/` bucket is configured for public read; all other buckets remain private. Logo `<img>` tags resolve directly from MinIO with no Next.js hop.

**Logo fallback.** When `tenant.logo_url IS NULL`, all surfaces render a circular initials badge instead: up to two uppercase characters drawn from `tenant.name`, filled with `--accent`, foreground auto-picked per contrast rules above. One component used on the wait page, host queue, and `/display/<slug>`.

## Connection loss

V1 is a browser-only web app — no PWA manifest, no service worker, no offline shell. When the `EventSource` on the wait or queue page fires its `error` event, the page shows a "Lost connection, retrying…" banner in a live region and hides it once `open` fires again. The browser handles `EventSource` reconnect automatically. Stale queue or position data is never rendered — the banner sticks until a fresh snapshot arrives.

Native mobile (guest + host) is the v2 path via a Flutter app against the same API.

## Internationalization readiness

V1 is English-only, but the codebase is structured to add languages without refactor:

- All UI strings live in `/lib/i18n/en.ts` with typed keys
- No hardcoded strings in JSX components
- Phone numbers stored as E.164 with an explicit country-code picker (`react-phone-number-input`)
- Dates and times rendered via `Intl.DateTimeFormat` using the tenant's `timezone` field

## Deployment

- GitHub Actions builds the `app` image on every push to `main`, pushes to a container registry, and triggers `docker compose pull && docker compose up -d` on the production host.
- Pull requests run the full compose stack in CI and execute unit, integration, and Playwright E2E suites against it.
- **V1 is prod-only.** No staging environment. Once a real pilot lands, a second compose project (`staging`) with its own volumes and hostname is added using the same compose file and a new `.env.staging`. Never share databases.
- Drizzle migrations run via the `migrator` compose service. App containers only start after migration succeeds.
- Environment variables live in per-env `.env` files (not committed), injected at `compose up` time.

### Initial host password

`POST /api/admin/tenants` (creation):

1. Validate slug (pattern + reserved list), name, timezone (from IANA list).
2. Generate a 12-character random password (alphanumeric, mixed case, no look-alikes).
3. Bcrypt-hash it (cost ≥ 10). Insert the tenant row with `host_password_version = 1`.
4. Return `201 { tenant, initialPassword }`. The plaintext appears in the response body **once** and is never stored; the admin UI shows it on a one-time screen with a copy-to-clipboard button and a warning that it cannot be retrieved later.

Rotation happens via either `POST /api/host/<slug>/password` (authenticated host) or `POST /api/admin/tenants/<id>/reset-password` (authenticated admin, same one-time-display pattern).

### Seed script

`scripts/seed.ts` is a CLI used for local dev and Playwright CI. Invocations:

- `pnpm seed --reset` drops and re-seeds the database from scratch.
- `pnpm seed --tenant=demo` inserts the canonical demo tenant with the same 3-waiting / 10-historical fixture that `/api/admin/tenants/<id>/reset-demo` produces.
- `pnpm seed --tenant=<slug> --with-waiters=N` inserts an arbitrary tenant with N staggered waiters. Used by E2E test files to set up specific scenarios.

The script uses the same Drizzle service wrappers as the app so schema drift breaks it loudly. CI runs it after the `migrator` service and before the Playwright runner.

### Required environment variables

| Name              | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string (compose `postgres` service) |
| `REDIS_URL`       | Redis connection string                                 |
| `S3_ENDPOINT`     | MinIO endpoint URL                                      |
| `S3_BUCKET`       | MinIO bucket for logos                                  |
| `S3_ACCESS_KEY`   | MinIO access key                                        |
| `S3_SECRET_KEY`   | MinIO secret key                                        |
| `QR_TOKEN_SECRET` | HMAC key for QR tokens                                  |
| `HOST_JWT_SECRET` | JWT signing key for host sessions                       |
| `ADMIN_EMAILS`    | Comma-separated allow list                              |
| `NEXTAUTH_SECRET` | NextAuth session signing                                |
| `NEXTAUTH_URL`    | App URL (for magic link email content)                  |
| `RESEND_API_KEY`  | Magic-link email delivery                               |

## Observability

- Container stdout/stderr via `docker compose logs`
- No APM, no error tracker in v1
- Operator may attach a log aggregator (Loki, Logtail) post-pilot; no v1 code changes required

## Backups

**V1 ships no automated backups.** Persistence is provided by named volumes on the Docker host (`postgres-data`, `minio-data`, `redis-data`). The operator is responsible for backing those up (e.g. nightly `pg_dump` into offsite storage, `mc mirror` for MinIO) using their own tooling.

A documented runbook ships with the repo explaining how to restore from a dump and how to bootstrap a new host. This is a conscious v1 scoping decision; a real backup service will be added once a pilot tenant has data worth protecting.

## Security

- All cookies `HttpOnly` (except `welcome_back` which the client reads), `Secure`, `SameSite=Lax`
- Passwords bcrypt-hashed with cost 10 or higher
- **CSRF.** v1 relies on `SameSite=Lax` cookies plus a `Content-Type: application/json` requirement on all state-changing endpoints. The browser blocks cross-site form POSTs; custom headers require a CORS preflight that won't succeed. No explicit CSRF tokens are issued. Revisit if we ever add a form-encoded surface or loosen `SameSite`.
- All user input validated with Zod schemas on the server, not just the client
- SQL injection prevented by Drizzle's parameterization
- Logo uploads: PNG/JPG only (SVG rejected to eliminate embedded script vectors), MIME + decoded-dimension validation, then server re-encodes via `sharp` before any MinIO write
- Slug is immutable after creation so printed QR codes stay valid; a reserved list prevents collisions with app routes
- No secrets in the repository; everything via env files mounted into compose
- Rate limiting on all public endpoints

## Accessibility baseline

V1 does not undergo a formal WCAG audit but ships a baseline:

- `<html lang="en">` on every page.
- All interactive elements (Seat, Remove, Undo, Leave, open/close pill) reachable by keyboard with a visible focus ring.
- Icon-only buttons carry `aria-label`s.
- Wait page wraps the position line in `aria-live="polite"` so screen readers announce updates when SSE fires.
- Accent color always rendered with a WCAG-AA-compliant foreground (enforced at save time + auto-picked at render time, per Branding).

Formal audit and keyboard-only QA pass are deferred to post-v1.

## Testing

- **Unit**: QR token sign/verify, rate limiter, Notifier, Drizzle service wrapper, undo stack, SSE event encoder, slug validator (pattern + reserved), contrast validator, logo re-encoder
- **Integration**: API routes against the compose Postgres + Redis stack (real services, ephemeral data). Includes password-rotation invalidation (second session gets 401), shared undo across two sessions, and hard-delete tenant wipe (CASCADE)
- **E2E**: Playwright against the full compose stack, covering the sales demo flow end-to-end — `scripts/seed.ts --tenant=demo` to set up, load display page, join via QR, host seats, guest page reflects seated state within a second via SSE. Additional specs cover tenant closed hard-block, QR token expiry, and the "leave queue" terminal state. Runs on every pull request in GitHub Actions
- **Manual**: Full sales demo walkthrough before each internal milestone

## Resolved implementation choices

| Area                           | Choice                                                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QR rendering library           | `qrcode.react`                                                                                                                                                                                                                                             |
| Phone input library            | `react-phone-number-input`                                                                                                                                                                                                                                 |
| Rate limiter library           | `rate-limiter-flexible`                                                                                                                                                                                                                                    |
| SSE transport                  | Native Next.js `Response` streaming with `ReadableStream`; no library                                                                                                                                                                                      |
| Redis pub/sub connection model | One shared subscribe connection multiplexed across all SSE handlers in the process; publishes and rate-limit ops share the default pooled client. Redis clients can't mix subscribe and normal commands on the same connection, so this split is mandatory |
| Timezone source                | Tenant setting, IANA value picked at creation by the admin (typeahead, default `Asia/Kolkata`)                                                                                                                                                             |
| Absolute time rendering        | `Intl.DateTimeFormat` using `tenant.timezone` across host queue timestamps and guest history                                                                                                                                                               |
| Image re-encoder               | `sharp` (512×512 PNG output)                                                                                                                                                                                                                               |
| Password hashing               | `bcrypt`, cost 10+                                                                                                                                                                                                                                         |
| JWT library                    | `jose`                                                                                                                                                                                                                                                     |

## v1.5 — Flutter mobile

V1.5 adds a Flutter app covering guest, host, and display against the same API. Admin stays web-only. Web remains authoritative; the mobile app is additive. One multi-tenant binary — the landing destination is decided by what the user does (scan a QR, tap Sign in, open a paired device). English only. Ships to TestFlight and raw APK; store launch is deferred.

### Scope

- Flutter surfaces: guest (join + wait), host (login + queue + settings + history + open/close), display (kiosk QR)
- Guest "seat ready" push via APNs + FCM — the first real `Notifier` implementation
- Universal Links on iOS and App Links on Android; QR opens the app when installed, the existing web page otherwise
- Best-effort accessibility on mobile (formal audit still deferred)
- TestFlight + raw APK distribution; App Store / Play Store submission out of scope
- Demo tenant pilot only

Out of scope for v1.5: admin on mobile, per-tenant branded apps, offline writes, SMS / WhatsApp notifier implementations, host push notifications.

### Mobile stack

| Layer            | Choice                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Language         | Dart                                                                                                 |
| UI               | Flutter (stable channel, ≥3.22)                                                                      |
| HTTP             | `dio` with a bearer-token interceptor                                                                |
| SSE              | Thin wrapper around `http` streamed responses; foreground reconnect + re-snapshot; no library        |
| State            | `riverpod`                                                                                           |
| Secure storage   | `flutter_secure_storage` (iOS Keychain, Android EncryptedSharedPreferences)                          |
| Push             | `firebase_messaging` on device; `firebase-admin` on server dispatching to FCM (FCM handles APNs too) |
| Deep linking     | Native Universal Links + App Links; cold-start URL plus warm-start intents                           |
| QR rendering     | `qr_flutter`                                                                                         |
| QR scanning      | `mobile_scanner`                                                                                     |
| Image picker     | `image_picker` (camera + photo library)                                                              |
| Phone input      | `intl_phone_field`                                                                                   |
| Persistent cache | `sqflite` for host snapshot + metadata                                                               |

### Repo layout

```
/flutter
  /lib
    /auth        — bearer storage, login, refresh
    /sse         — SSE client and reconnect state machine
    /theme       — palette + helpers ported from web Tailwind tokens
    /guest       — join + wait screens
    /host        — login, queue, settings, history
    /display     — kiosk QR
    /push        — FCM registration + routing
    /deeplink    — universal-link parser + router
  /ios
  /android
  /integration_test
  pubspec.yaml
```

### Server changes

- **Host middleware** accepts either the existing `host_session` cookie or `Authorization: Bearer <token>`. Both carry the same JWT claim shape (slug + `host_password_version`); the version-check and stale-version clear paths are shared.
- **`POST /api/host/token`** — password + slug → host bearer token; shares the rate limiter policy and hash-compare path with the cookie login endpoint. Token TTL matches the cookie (12 hours).
- **`POST /api/guest/token`** — authenticates the caller via the party session cookie and returns a guest bearer scoped to that party id. TTL matches the guest session cookie.
- **`POST /api/push/register`** / **`POST /api/push/unregister`** — authenticated by bearer, tenant-scoped, rate-limited, idempotent on `(scope_id, device_token)`.
- **`PushNotifier`** — first real `Notifier` implementation; subscribes to `party.seated`, dispatches via Firebase Admin SDK, records outcomes in `notifications` with `channel='push'` and `status` derived from the FCM response.

### New table

```sql
CREATE TABLE push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL CHECK (scope IN ('guest_party','host_session')),
  scope_id     uuid NOT NULL,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('ios','android')),
  device_token text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

CREATE UNIQUE INDEX idx_push_tokens_unique_live
  ON push_tokens(scope_id, device_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_push_tokens_tenant ON push_tokens(tenant_id);
```

### Deep linking

- iOS: `apple-app-site-association` served at `/.well-known/apple-app-site-association` as `application/json`, long cache. Claims `/q/*`, `/host/*`, `/display/*` for the Pila bundle id.
- Android: `assetlinks.json` at `/.well-known/assetlinks.json` with the app signing SHA-256.
- Both files are committed under `public/.well-known/`; a CI check asserts they serve with the expected content-type.
- QR payload format is unchanged. The existing `/q/<slug>?t=<token>` URL is claimed by the app when installed and falls back to the current web join page otherwise.

### Auth transport on mobile

- **Host**: one-time exchange of password → bearer; stored in `flutter_secure_storage`. Same JWT claims as the cookie, same server validation path.
- **Guest**: the party session cookie returned from `/api/join` is exchanged once for a guest bearer via `/api/guest/token`; the cookie never persists on mobile.
- **Refresh**: both tokens re-issue inside the last hour of validity, matching the cookie behavior.
- **Stale version / wrong slug**: a 401 wipes the bearer from secure storage and routes the app back to the login or join screen.

### Push notifications

- The only event wired in v1.5 is `party.seated`, delivered to the guest whose party was seated.
- Host `PushNotifier` registration is also wired so host tokens are captured, but no host event fires yet — this reserves the foothold without shipping host push UX.
- Server dispatches through a single FCM project; the same project holds the APNs auth key so iOS delivery is transparent.
- Device tokens are registered immediately after join (guest) or login (host), not at app launch. Permissions are requested at the same moment, so the user sees a reason for the ask.
- Foreground suppression: the client-side Flutter handler drops messages when the app is foregrounded and the SSE stream is live, because SSE is authoritative for in-app state. Backgrounded and terminated states route the message into the system tray normally.

### Offline behavior

- Host queue snapshot persisted to `sqflite` on every successful SSE event.
- Cold launch without connectivity renders the last snapshot read-only with a stale indicator.
- Writes (Seat, Remove, Undo, settings saves) are disabled whenever the SSE stream is closed or the snapshot is stale. No optimistic writes, no queued mutations — consistent with the v1 server invariant that every state change emits the canonical event.

### Theming

- Tailwind palette (accent, neutrals) exported as Dart constants into `lib/theme/`.
- Accent-contrast helper ported from the web so the foreground picker matches web behavior at render time.
- Logo and initials-badge rules mirror the web helpers; logos continue to be re-encoded server-side to 512×512 PNG.

### Testing

- **Unit**: bearer middleware matrix (cookie, bearer, stale version, wrong slug), token-exchange endpoints, `PushNotifier` dispatch + failure recording, deep-link parser, SSE reconnect state machine, offline gating, accent-contrast helper port, logo validation matrix.
- **Widget tests**: every screen renders from an injected snapshot; permission prompts gated at the right moment.
- **Integration (`integration_test`)**: sales-demo flow end-to-end on iOS simulator and Android emulator — display pairs, guest joins via deep link, host seats, guest receives push, terminal screen renders.
- **Cross-surface**: Playwright (web host) + Flutter (guest) joint test asserting a seat on web reaches the Flutter guest as a push within 3 seconds on both platforms.

### Distribution

- iOS: Apple Developer Program membership ($99/yr). Builds ship to TestFlight internal testers.
- Android: release-keystore-signed APK distributed via direct download or Firebase App Distribution; Play Console deferred.
- Both platforms: version string aligned to the backend tag; CI pipeline produces the web image and both mobile artifacts in the same run.
- Pilot: demo tenant only in v1.5; a real-restaurant pilot follows in v1.5.x.

### Resolved mobile choices

| Area             | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Flutter channel  | stable, ≥3.22                                            |
| HTTP client      | `dio` + bearer interceptor                               |
| SSE on mobile    | Custom thin wrapper, no library                          |
| State management | `riverpod`                                               |
| Secure storage   | `flutter_secure_storage`                                 |
| Push SDK         | `firebase_messaging` (device), `firebase-admin` (server) |
| QR render        | `qr_flutter`                                             |
| QR scan          | `mobile_scanner`                                         |
| Phone input      | `intl_phone_field`                                       |
| Local cache      | `sqflite`                                                |
| Deep linking     | Native Universal Links + App Links (no third-party lib)  |

## What comes next after v1.5 ships

Admin on mobile, host push notifications ("new party joined" while backgrounded), Play Console + App Store submission, white-label per-tenant builds, SMS and WhatsApp `Notifier` implementations, formal WCAG audit on mobile, and Filipino / multi-locale support. All of these slot cleanly onto the v1.5 foundation — the `Notifier` seam, the bearer-token middleware, and the `push_tokens` scope column were all shaped to absorb these additions without schema churn.
