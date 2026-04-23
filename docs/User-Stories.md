# Pila Lang — User Stories (v1)

## Purpose

This doc is the bridge between PRD (what we're building and why) and tests (proof that we built it). Each story names a role, states a demo-critical outcome in Given/When/Then form, points at the Playwright or integration test that verifies it, and links back to the PRD or Technical-Spec section where the behavior is specified in detail.

**When in doubt, the PRD and Technical-Spec win.** Stories here are _acceptance criteria_, not new requirements. If a story conflicts with the spec, the spec is correct and the story is stale — fix the story.

## Legend

- **Role** — Guest · Host · Admin · Sales · Restaurant Owner · Ops
- **Priority**
  - **P0** — demo-critical: the 5-minute pitch breaks if this doesn't work
  - **P1** — pilot-must-have: pilots can't run without it, not visible in a typical pitch
  - **P2** — nice-to-have: planned for v1 but a slip is survivable
- **Test spec** — forward-looking path of the Playwright E2E or integration test that proves the story. File doesn't exist yet; treated as a naming contract.
- **Refs** — `PRD § <heading>` and `Spec § <heading>` pointers.

---

## Sales demo master flow

### S1. Five-minute sales demo lands cleanly

- **Role:** Sales · **Priority:** P0
- **Given** a fresh, reset demo tenant and two devices (laptop for host stand, phone for guest scan)
- **When** the sales person runs the demo script: open display, scan QR on phone, join as "Priya Sharma, party of 2", watch the party appear on the laptop within 1 second, tap Seat, watch the phone transition to "your table is ready" within 1 second
- **Then** every step works on first try, no errors, no dev tools needed, total elapsed time under 5 minutes
- **Test spec:** `tests/e2e/sales-demo.spec.ts`
- **Refs:** PRD § Sales demo flow · Spec § Testing (E2E)

---

## Guest stories

### G1. Scan, join, and land on wait page

- **Role:** Guest · **Priority:** P0
- **Given** a valid QR token (`/r/<slug>?t=<token>`) and an open tenant
- **When** the guest fills name + party size (phone optional) and taps Join
- **Then** they land on `/r/<slug>/wait/<partyId>` showing position, name, and an initial "joined" state; the `party_session` cookie is set; the host queue stream receives a `party:joined` event within 1 second
- **Test spec:** `tests/e2e/guest-join.spec.ts`
- **Refs:** PRD § User flows · Spec § Guest session

### G2. See position update live when the queue moves

- **Role:** Guest · **Priority:** P0
- **Given** the guest is on the wait page at position 3
- **When** the host seats an earlier party
- **Then** the guest's visible position updates to 2 within 1 second via SSE, without a page refresh
- **Test spec:** `tests/e2e/guest-wait-updates.spec.ts`
- **Refs:** Spec § Real-time transport

### G3. Terminal "your table is ready" state on seat

- **Role:** Guest · **Priority:** P0
- **Given** the guest is on the wait page
- **When** the host taps Seat
- **Then** the page transitions to the terminal "your table is ready" screen, the SSE stream closes, and a reconnect attempt receives 204 No Content so the browser stops retrying
- **Test spec:** `tests/e2e/guest-seated-terminal.spec.ts`
- **Refs:** Spec § Post-seat state · Spec § Real-time transport (terminal handling)

### G4. Returning-guest welcome-back banner

- **Role:** Guest · **Priority:** P2
- **Given** the guest's phone was used at this tenant in a past party
- **When** they submit the join form with that same phone number
- **Then** the server sets a short-lived `welcome_back` cookie and the wait page shows a "welcome back" banner on first render (cookie cleared after)
- **Test spec:** `tests/e2e/guest-returning.spec.ts`
- **Refs:** Spec § Returning-guest recognition

### G5. Leave the queue from the wait page

- **Role:** Guest · **Priority:** P1
- **Given** a waiting party on the wait page
- **When** the guest taps "Leave queue", then the inline confirm
- **Then** the party is marked `left`, all other waiters' positions advance by 1 via SSE, the page transitions to "you've left the queue", and the stream closes
- **Test spec:** `tests/e2e/guest-leave.spec.ts`
- **Refs:** Spec § Guest leave flow

### G6. Session recovery after closing the tab

- **Role:** Guest · **Priority:** P1
- **Given** a waiting party and an active `party_session` cookie on the device
- **When** the guest closes the tab and reopens `/r/<slug>?t=<token>`
- **Then** they are redirected straight to `/r/<slug>/wait/<partyId>` without re-joining
- **Test spec:** `tests/e2e/guest-session-recovery.spec.ts`
- **Refs:** Spec § Guest session (revisit branch)

### G7. Session cookie survives a long wait

- **Role:** Guest · **Priority:** P2
- **Given** a waiting party whose session cookie is approaching its 24h expiry
- **When** the wait page's SSE stream reconnects at any time while still waiting
- **Then** the server re-sets the `party_session` cookie with a fresh 24h TTL so the session lives as long as the party is active
- **Test spec:** `tests/integration/party-session-refresh.spec.ts`
- **Refs:** Spec § Guest session (SSE step 6)

### G8. Join blocked when tenant is closed

- **Role:** Guest · **Priority:** P1
- **Given** a tenant with `is_open = false`
- **When** a guest hits `/r/<slug>?t=<token>` or posts to the join endpoint
- **Then** the page renders the "not accepting guests right now" banner; the API returns 409 `{ error: 'tenant_closed' }`
- **Test spec:** `tests/e2e/tenant-closed-hard-block.spec.ts`
- **Refs:** Spec § Queue closed behavior

### G9. QR token expiry is rejected

- **Role:** Guest · **Priority:** P1
- **Given** a QR token more than 65 minutes old
- **When** the guest loads the join URL
- **Then** the page shows an "expired QR, please re-scan" error instead of the join form
- **Test spec:** `tests/integration/qr-token-expiry.spec.ts`
- **Refs:** Spec § QR token rotation

### G10. Existing waiter unaffected by tenant close

- **Role:** Guest · **Priority:** P1
- **Given** a waiting party and a host who flips the tenant closed
- **When** the host closes the queue
- **Then** the guest's wait page keeps streaming, they can still be seated normally, and their "Leave queue" action still works
- **Test spec:** `tests/e2e/tenant-closed-existing-waiter.spec.ts`
- **Refs:** Spec § Queue closed behavior

### G11. Reconnecting banner when the SSE connection drops

- **Role:** Guest · **Priority:** P2
- **Given** a guest on the wait page
- **When** the `EventSource` fires an `error` event (flaky wifi, phone sleep, proxy hiccup)
- **Then** an inline "reconnecting" banner appears in a live region; it hides once the stream's `open` event fires again; stale queue position is never rendered while reconnecting
- **Test spec:** `tests/e2e/guest-reconnect-banner.spec.ts`
- **Refs:** Spec § Connection loss

### G12. Concurrent joins with the same phone resolve cleanly

- **Role:** Guest · **Priority:** P1
- **Given** two devices submitting the join form at the same tenant with the same phone number within milliseconds of each other
- **When** both requests arrive at the server
- **Then** exactly one insert succeeds (returning 200 with the wait URL); the other receives `409 { error: 'already_waiting' }` — whether the conflict is caught by the pre-check or by the unique-index `23505` path — and the front-end surfaces a "you're already in the queue" message with a link to the existing wait page
- **Test spec:** `tests/integration/join-race-same-phone.spec.ts`
- **Refs:** Spec § Guest session (join step 3)

### G13. Stream rejects mismatched session token or tenant slug

- **Role:** Guest · **Priority:** P1
- **Given** a valid waiting party with its own `party_session` cookie
- **When** another device (or a forged cookie) hits `/api/r/<slug>/parties/<id>/stream` whose `party_session` cookie does not match `party.sessionToken`, _or_ whose URL `<slug>` does not resolve to the party's `tenant_id`
- **Then** the server responds 403 without opening a stream; no position, name, or other party fields leak in the response body
- **Test spec:** `tests/integration/guest-stream-auth.spec.ts`
- **Refs:** Spec § Guest session (SSE step 4)

---

## Host stories

### H1. Log in with the shared password

- **Role:** Host · **Priority:** P0
- **Given** a tenant with a known host password
- **When** the host submits the password on `/host/<slug>`
- **Then** they receive a `host_session` cookie (12h TTL, `pwv` matches the current `host_password_version`) and land on `/host/<slug>/queue`
- **Test spec:** `tests/e2e/host-login.spec.ts`
- **Refs:** Spec § Authentication (Host stand)

### H2. See the queue with live updates

- **Role:** Host · **Priority:** P0
- **Given** a logged-in host on the queue page
- **When** a guest joins via the QR flow
- **Then** the new party appears in the waiting list within 1 second via SSE with correct name, party size, and joined-at time; the time-waited ticker updates once per second without additional server events
- **Test spec:** `tests/e2e/host-queue-live.spec.ts`
- **Refs:** Spec § Real-time transport · Spec § Wait-time ticker

### H3. Seat a party in one tap

- **Role:** Host · **Priority:** P0
- **Given** a waiting party in the queue
- **When** the host taps Seat
- **Then** the party's status becomes `seated`, it disappears from the waiting list, a 5-second Undo toast appears, the party arrives in the "Recently resolved" panel, and the guest's wait page transitions to the terminal state within 1 second
- **Test spec:** `tests/e2e/host-seat.spec.ts`
- **Refs:** Spec § Assisted FIFO queue

### H4. Remove a no-show party

- **Role:** Host · **Priority:** P1
- **Given** a waiting party
- **When** the host taps Remove
- **Then** status becomes `no_show`, the row disappears from waiting, it shows up in Recently resolved with an Undo button, and the guest's stream (if still open) gets a final event
- **Test spec:** `tests/e2e/host-remove.spec.ts`
- **Refs:** Spec § Assisted FIFO queue

### H5. Undo last action from any logged-in device

- **Role:** Host · **Priority:** P0
- **Given** two host devices logged in to the same tenant and a just-seated party
- **When** the _other_ device (not the one that seated) taps Undo within 60 seconds
- **Then** the party returns to `waiting`, reappears at its original `joined_at` position (not the bottom), the recently resolved row vanishes, and the guest's wait page reconnects to the live stream
- **Test spec:** `tests/integration/undo-shared-across-sessions.spec.ts`
- **Refs:** Spec § Undo (Redis-backed, shared per tenant)

### H6. Undo rejected after the 60-second window

- **Role:** Host · **Priority:** P1
- **Given** a seated party 61+ seconds ago
- **When** the host taps Undo
- **Then** the server responds 409 and the UI shows "too late to undo"
- **Test spec:** `tests/integration/undo-window-expiry.spec.ts`
- **Refs:** Spec § Undo

### H7. Toggle the queue closed from the queue header

- **Role:** Host · **Priority:** P1
- **Given** a logged-in host with an open tenant
- **When** the host taps the "Queue: Open" pill and confirms the close dialog
- **Then** `tenant.is_open = false`, all display pages swap to the closed banner within 60 seconds, new joins return 409, existing waiters are undisturbed
- **Test spec:** `tests/e2e/host-close-queue.spec.ts`
- **Refs:** Spec § Queue closed behavior

### H8. Recently-resolved panel lets me fix a mistaken seat

- **Role:** Host · **Priority:** P1
- **Given** a seated party within the last 30 min and within the 60s undo window
- **When** the host expands Recently resolved and taps Undo on that row
- **Then** the party returns to `waiting` at its original position (same behavior as H5), and the inline Undo button disables on rows whose 60s window has passed
- **Test spec:** `tests/e2e/host-resolved-panel.spec.ts`
- **Refs:** Spec § Recently-resolved view

### H9. Edit name, accent color, and logo

- **Role:** Host · **Priority:** P1
- **Given** a logged-in host on the settings page
- **When** the host saves a new accent color with poor contrast (both black and white fail AA against it)
- **Then** the server returns 422 with a message; a valid color saves successfully and propagates within 1s via `--accent` to all three live surfaces — `/host/<slug>/queue`, `/r/<slug>/wait/<id>`, and `/display/<slug>`
- **When** the host uploads a PNG logo
- **Then** the server re-encodes to 512×512 PNG, writes to MinIO, updates `tenant.logo_url`, and the same three surfaces render the new logo on their next tick
- **Test spec:** `tests/integration/host-settings.spec.ts`
- **Refs:** Spec § Branding and theming

### H10. Rotate password and kick other devices

- **Role:** Host · **Priority:** P1
- **Given** a host logged in on two devices
- **When** device A rotates the password
- **Then** `host_password_version` increments; A's cookie is re-issued with the new `pwv`; B's next request receives 401 and the cookie is cleared; B's browser redirects to login
- **Test spec:** `tests/integration/password-rotation-kicks-sessions.spec.ts`
- **Refs:** Spec § Authentication (Host stand) · Password rotation

### H11. Log out all devices without changing password

- **Role:** Host · **Priority:** P2
- **Given** multiple active host sessions
- **When** one session hits "Log out all devices"
- **Then** `host_password_version` bumps without rewriting the hash; caller stays logged in with a re-issued cookie; all other sessions get 401 on their next request
- **Test spec:** `tests/integration/logout-all-devices.spec.ts`
- **Refs:** Spec § Authentication (Log out all devices)

### H12. Silent session refresh within the last hour

- **Role:** Host · **Priority:** P2
- **Given** a host session with less than 1 hour of JWT validity remaining
- **When** the host makes any request against a `/host/<slug>/*` route
- **Then** middleware signs a fresh 12h JWT (same `jti`, same `pwv`) and sets a new cookie on the response — the host never sees a mid-shift logout
- **Test spec:** `tests/integration/session-rolling-refresh.spec.ts`
- **Refs:** Spec § Authentication (Silent rolling refresh)

### H13. Browse guest history by phone

- **Role:** Host · **Priority:** P2
- **Given** a tenant with many historical guests
- **When** the host opens the guests tab
- **Then** the first 25 rows load grouped by phone (most recent name, visit count, last visit), ordered by last visit desc; scrolling triggers the next page; all timestamps render in the tenant's timezone
- **Test spec:** `tests/e2e/host-guest-history.spec.ts`
- **Refs:** Spec § Returning-guest recognition (guests page query) · Spec § Resolved implementation choices (timezone)

### H14. New party renders with full row data, no extra fetch

- **Role:** Host · **Priority:** P1
- **Given** a logged-in host on the queue page with DevTools open to the Network tab
- **When** a guest joins via the QR flow and the host receives the `party:joined` SSE event
- **Then** the queue row renders with name, party size, phone (if provided), and joined-at time from the event payload alone — no follow-up `/api/.../parties/<id>` fetch is triggered
- **Test spec:** `tests/integration/host-diff-payload.spec.ts`
- **Refs:** Spec § Real-time transport (event payloads)

### H15. Initials badge replaces logo on every surface when `logo_url` is null

- **Role:** Host · **Priority:** P2
- **Given** a tenant with `logo_url = null` and a name like "Garden Table"
- **When** any user loads `/r/<slug>/wait/<id>`, `/display/<slug>`, or `/host/<slug>/queue`
- **Then** the logo slot renders a circular initials badge with up to 2 uppercase characters drawn from the tenant name ("GT"), filled with `--accent`, foreground auto-picked for WCAG AA contrast; the same component is used across all three surfaces
- **Test spec:** `tests/integration/logo-fallback-initials.spec.ts`
- **Refs:** Spec § Branding and theming (Logo fallback)

---

## Display stories

### D1. Display page rotates QR token without visible flash

- **Role:** Restaurant Owner · **Priority:** P1
- **Given** the display page open on a long-running screen
- **When** the 60-second poll returns a new token (because the previous one is past its 60-minute rotation threshold)
- **Then** the QR component re-renders to the new token, the transition is visually seamless (no loading flash or blank frame), and a guest scanning the freshly rendered QR successfully joins the queue
- **Test spec:** `tests/integration/display-token-rotation.spec.ts`
- **Refs:** Spec § QR token rotation

### D2. Display page swaps to closed banner when host closes the queue

- **Role:** Restaurant Owner · **Priority:** P1
- **Given** the display page open with a live QR and the tenant open
- **When** the host flips the queue closed (H7)
- **Then** within 60 seconds (next poll), the display replaces the QR with the "not accepting guests right now" banner; when the host re-opens, the QR returns on the following poll
- **Test spec:** `tests/e2e/display-closed-banner.spec.ts`
- **Refs:** Spec § Queue closed behavior · Spec § QR token rotation

---

## Admin stories

### A1. Magic-link login for admins on the allow list

- **Role:** Admin · **Priority:** P0
- **Given** an email on the `ADMIN_EMAILS` allow list
- **When** the admin submits the email on `/admin`
- **Then** Resend delivers a magic link; clicking it completes sign-in; non-allowed emails are rejected at the NextAuth callback before session creation
- **Test spec:** `tests/integration/admin-magic-link.spec.ts` (stub Resend)
- **Refs:** Spec § Authentication (Admin)

### A2. Create a tenant and see the initial password once

- **Role:** Admin · **Priority:** P0
- **Given** an authenticated admin on `/admin/tenants`
- **When** they submit a valid slug (passes pattern + reserved list), a name, and an IANA timezone
- **Then** the server creates the tenant with `host_password_version = 1`, generates a 12-char password, hashes it, and returns the plaintext in the 201 response; the UI shows it once on a copy-to-clipboard screen with a "cannot be retrieved" warning; reloading the page never shows it again
- **Test spec:** `tests/e2e/admin-create-tenant.spec.ts`
- **Refs:** Spec § Deployment (Initial host password)

### A3. Reject reserved and malformed slugs at creation

- **Role:** Admin · **Priority:** P1
- **Given** an admin on the create-tenant form
- **When** they submit `admin`, `api`, `r`, `display`, `ABC`, `-foo`, or `foo--`
- **Then** each is rejected with a specific error; a valid slug (e.g. `garden-table`) succeeds
- **Test spec:** `tests/integration/slug-validation.spec.ts`
- **Refs:** Spec § Slug rules

### A4. Edit tenant name, logo, accent, timezone, and flags

- **Role:** Admin · **Priority:** P1
- **Given** an existing tenant
- **When** the admin PATCHes `/api/admin/tenants/<id>` with any subset of `name`, `logo_url`, `accent_color`, `timezone`, `is_demo`, `is_open`
- **Then** each field updates; attempting to send `slug` or `host_password_hash` is rejected; `accent_color` runs through the same WCAG AA validator as the host settings path
- **Test spec:** `tests/integration/admin-edit-tenant.spec.ts`
- **Refs:** Spec § URL and route structure (API table)

### A5. Hard-delete a tenant

- **Role:** Admin · **Priority:** P1
- **Given** an active tenant with parties and notifications attached
- **When** the admin DELETEs `/api/admin/tenants/<id>` after satisfying the typed-slug confirmation prompt
- **Then** in one transaction `is_open` flips false, any still-`waiting` parties transition to `no_show`, and the tenant row is removed; ON DELETE CASCADE wipes parties and notifications; existing host streams receive a final `tenant:closed` event and open guest streams emit one terminal event; subsequent slug lookups 404; the tenant no longer appears in `/admin/tenants`
- **Test spec:** `tests/integration/tenant-hard-delete.spec.ts`
- **Refs:** Spec § Tenant delete

### A6. Reset the shared demo tenant between pitches

- **Role:** Sales (admin-level) · **Priority:** P0
- **Given** the demo tenant with arbitrary state
- **When** a sales person on the allow list hits Reset Demo
- **Then** all parties and notifications are wiped; 10 back-dated seated + 3 staggered waiting parties are inserted with deterministic names; any open host view for the demo tenant re-fetches its snapshot via a `tenant:reset` event within 1 second
- **Test spec:** `tests/e2e/admin-reset-demo.spec.ts`
- **Refs:** Spec § Demo tenant reset

### A7. Rotate a tenant's host password from admin

- **Role:** Admin · **Priority:** P2
- **Given** an admin on a tenant's detail page
- **When** they hit Reset Password
- **Then** a new plaintext is generated, the hash is updated, `host_password_version` bumps (all active host sessions get 401 on their next request), and the new plaintext is shown once in the UI
- **Test spec:** `tests/integration/admin-reset-host-password.spec.ts`
- **Refs:** Spec § URL and route structure (API table)

---

## Ops stories

### O2. Rate limits protect against abuse without capping busy restaurants

- **Role:** Ops · **Priority:** P1
- **Given** 20 guests on the restaurant's shared Wi-Fi
- **When** each scans and submits a join form
- **Then** all succeed (phone-based keying, not IP); the per-tenant global cap (200/hour) stays well above normal traffic; a script hitting the host login endpoint 11 times in an hour from one IP receives 429 on the 11th with a `Retry-After` header
- **Test spec:** `tests/integration/rate-limits.spec.ts`
- **Refs:** Spec § Rate limiting

### O3. SSE survives proxy idle timeouts

- **Role:** Ops · **Priority:** P1
- **Given** an idle host queue stream behind a proxy with a 60-second idle timeout
- **When** no events fire for 5 minutes
- **Then** the stream stays open (15-second `:ping` comments keep it alive); a subsequent real event delivers without the client reconnecting
- **Test spec:** `tests/integration/sse-heartbeat.spec.ts`
- **Refs:** Spec § Real-time transport (keep-alive)

### O4. Guest wait page rehydrates correctly on SSE reconnect

- **Role:** Ops · **Priority:** P1
- **Given** a guest on the wait page whose `EventSource` connection drops mid-wait (flaky wifi, phone sleep, proxy hiccup) while other parties are seated during the outage
- **When** the stream reconnects
- **Then** the server flushes a fresh `snapshot` event with the current `position`, the client replaces any stale in-memory position with the snapshot value before resuming incremental `position_changed` handling, and the displayed number matches what the host sees within 1 second of reconnect
- **Test spec:** `tests/integration/guest-reconnect-rehydrate.spec.ts`
- **Refs:** Spec § Real-time transport · Spec § Guest session (SSE snapshot)

### O5. Notifier no-op does not break join or seat paths

- **Role:** Ops · **Priority:** P2
- **Given** the app wired with `NoopNotifier` at startup (v1 default)
- **When** a guest joins and a host seats
- **Then** `notifier.onPartyJoined` and `notifier.onPartyReady` are awaited at their call sites, resolve without error, and write no rows to the `notifications` table; swapping in a stub notifier whose methods throw causes both endpoints to return 500, proving the calls are real and not silently skipped — this is the seam the post-v1 WhatsApp/SMS work depends on
- **Test spec:** `tests/integration/notifier-wiring.spec.ts`
- **Refs:** Spec § Notifier interface

### O6. Seed script runs reliably in CI

- **Role:** Ops · **Priority:** P2
- **Given** the migrator service has completed and the database is empty
- **When** CI invokes `pnpm seed --reset` followed by `pnpm seed --tenant=demo`
- **Then** the demo tenant is created with 3 staggered waiters and 10 back-dated seated parties; repeated invocations remain idempotent; subsequent Playwright specs that assume this fixture pass without flaking
- **Test spec:** `tests/integration/seed-script.spec.ts`
- **Refs:** Spec § Deployment (Seed script)

---

## Post-v1.5 follow-ups

Surfaced during local testing after the v1.5 mobile cut landed. Real user-visible gaps, not net-new features — promoted here so they graduate out of the progress-tracker.

### M1. Guest can launch the app cold and still reach the scanner

- **Role:** Guest · **Priority:** P1
- **Given** the guest has the Pila app installed from a previous visit and opens it from the home screen (no Universal Link, no active deep link)
- **When** the app cold-starts
- **Then** the landing screen shows a prominent "Scan QR" action that routes to the existing `/scan` camera screen; the screen never sits on an indefinite spinner
- **Notes:** Today `apps/mobile/lib/screens/splash_screen.dart` renders an infinite `CircularProgressIndicator` at `/` whenever there is no deep-link bootstrap and no paired display. Re-uses the existing `ScanScreen` and `DeepLinkParser` — no new routing. Scanner must continue to accept guest (`/r/<slug>?t=<token>`), host (`/host/<slug>`), and display (`/display/<slug>`) payloads so one button covers every printed QR we might ever ship.
- **Test spec:** `apps/mobile/test/screens/landing_screen_test.dart` (+ extend `integration_test/sales_demo_test.dart` to exercise cold-launch → scan)
- **Refs:** Spec § v1.5 · PRD § Guest flow

### M2. Returning host can sign back in without a deep link

- **Role:** Host · **Priority:** P1
- **Given** a host who has previously signed into the app on this device (host bearer + snapshot cached) and now cold-launches the app
- **When** the landing screen renders
- **Then** a secondary "Sign back in to <tenant name>" action appears next to the Scan button and routes to `/host/<slug>` using the remembered slug; the action is hidden when no snapshot exists
- **Notes:** Mirror the pattern `_kioskInitialLocation` uses for `displayPairingStore.currentSlug()` — introduce an equivalent `latestSlug()` on `HostSnapshotStore` driven by the existing sqflite rows. First-time hosts have no resume path by design: slugs are never user-facing strings (Spec § v1.5), so initial sign-in remains via the admin-issued Universal Link. On bearer expiry the existing auth redirect already lands the user on `/host/<slug>` login; no new error handling needed.
- **Test spec:** `apps/mobile/test/screens/landing_screen_test.dart` (visibility matrix: no snapshot, one snapshot, stale bearer)
- **Refs:** Spec § v1.5 · Spec § Host session

---

## Open questions / not yet stories

Tracked here so they don't get lost; promote to a real story when the PRD or Spec grows to cover them:

- Arrival tracking after seating (explicitly out of scope for v1)
- Wait-time estimation shown to the guest (out of scope)
- Web push notifications (out of scope)
- SMS/WhatsApp Notifier rollouts (post-v1)
