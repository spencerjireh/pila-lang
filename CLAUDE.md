# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pila Lang — a hosted, QR-first waitlist for small restaurants. Next.js 14 monolith with Postgres, Redis, and MinIO, self-hosted via Docker Compose. Pre-pilot v1 MVP; breaking changes are expected.

Authoritative design docs: `Technical-Spec.md` (the contract — read this before changing queue, SSE, auth, or tenancy behavior), `PRD.md`, `User-Stories.md`, `docs/RUNBOOK.md`.

## Common commands

```bash
pnpm dev                          # next dev
pnpm build                        # next build
pnpm typecheck                    # tsc --noEmit
pnpm lint                         # next lint
pnpm format / pnpm format:check   # prettier
pnpm test                         # vitest (full unit suite)
pnpm test -- lib/qr/token.test.ts # single unit file
pnpm test:watch                   # vitest watch
pnpm db:generate                  # drizzle-kit generate (new migration from schema)
pnpm db:migrate                   # apply migrations (normally run by the `migrator` compose service)
pnpm db:studio                    # drizzle-kit studio
pnpm seed --tenant=demo           # seed canonical demo tenant
pnpm seed --tenant=<slug> --with-waiters=N
pnpm e2e:install                  # one-time: playwright browsers
pnpm e2e                          # playwright, requires docker services up + built app
pnpm e2e:ui                       # playwright UI mode
```

Bring up dev services before running the app or e2e:

```bash
docker compose up -d postgres redis minio migrator
```

Required package manager: `pnpm@10.23.0`, Node `>=22` (see `.nvmrc`).

## Architecture

Single Next.js 14 App Router server. No edge functions, no serverless split — SSE requires a long-running Node process.

- `app/` — App Router routes. Three user surfaces plus admin:
  - `app/r/<slug>/…` — guest join + wait (public, QR-gated)
  - `app/host/<slug>/…` — host stand (per-tenant shared password → JWT cookie)
  - `app/display/<slug>/…` — kiosk QR
  - `app/admin/…` — internal admin (NextAuth magic link via Resend; gated by `ADMIN_EMAILS` allow list)
  - `app/api/…` — route handlers mirroring the surfaces above, plus `api/test/*` (gated on `NODE_ENV==="test"`, never ships to prod)
- `lib/` — server-side domain code. Key modules: `lib/db` (Drizzle schema + tenant-scoped service wrappers), `lib/redis` (shared + subscribe clients), `lib/sse` (event encoding + stream helpers), `lib/qr` (HMAC token sign/verify), `lib/auth` (host JWT + NextAuth config), `lib/parties` (queue state transitions + undo), `lib/ratelimit`, `lib/storage` (MinIO + sharp logo pipeline), `lib/notifier` (Noop in v1; interface is the v1.5 push seam), `lib/validators`, `lib/i18n/en.ts`.
- `drizzle/migrations/` — generated SQL. **Never imported at runtime.** The `migrator` compose service applies them at boot; `app` waits on `service_completed_successfully`.
- `scripts/seed.ts` — used by local dev and CI. Same Drizzle wrappers as the app, so schema drift breaks seeding loudly.
- `e2e/` — Playwright specs against a real compose stack.
- `components/` — shadcn/ui primitives + app components.

### Load-bearing invariants

These are easy to break and expensive to debug. Read `Technical-Spec.md` for the full rationale before editing the code that enforces them.

- **Tenancy scoping.** Every query on `parties` / `notifications` must go through a service wrapper that takes a `tenantId`. Never expose `tenant_id` to the client; resolve from the URL slug server-side.
- **SSE setup order.** In stream handlers: subscribe to Redis **first**, then read the Postgres snapshot, then emit the snapshot, then forward live diffs. Inverting this drops events in the gap.
- **Publish after commit.** Every write path that changes queue state publishes to Redis **after** the DB write commits (host queue channel + position updates via `publishPositionUpdates(tenantId, slug)` for any reorder — join skips position updates because it appends).
- **Host JWT rolling refresh.** Middleware re-issues the cookie in the last hour of validity; the JWT carries `pwv` (host_password_version) and a slug — mismatch → 403, stale `pwv` → 401 + clear cookie. Password rotation / "log out all devices" bumps `pwv`.
- **QR tokens.** HMAC of `<slug>:<issuedAtMs>` with `QR_TOKEN_SECRET`; rotated hourly with a 5-minute overlap. Verify slug + signature + age on every join.
- **Terminal SSE.** When a party hits a terminal status, emit one final event and close the stream; reconnects to a resolved party return **204** so `EventSource` stops retrying. A missing party row also returns 204 (orphaned cookie).
- **Undo.** Redis list `undo:tenant:<tenantId>`; 60-second per-frame eligibility enforced on `LPOP`. Shared across all host sessions for the tenant.
- **Redis connection split.** One shared subscribe connection multiplexed across SSE handlers; a separate pooled client for publishes + rate limiting. Don't mix subscribe and normal commands on one connection.
- **Slugs are immutable** after tenant creation (printed QRs must keep working); reserved names live in the slug validator.

## Testing

- Unit tests live next to the module: `lib/**/*.test.ts`. Run a single file with `pnpm test -- <path>`.
- `vitest.setup.ts` wires test-only globals. `vitest.config.ts` is the source of truth for include/exclude.
- E2E (`e2e/specs/`) requires the docker services running and builds the app under `NODE_ENV=test` via `pnpm build && pnpm start`. The `/api/test/*` routes are only mounted when `NODE_ENV==="test"`.
- CI (`.github/workflows/ci.yml`) runs format:check → lint → typecheck → unit → build → migrate → seed(demo) → e2e, with postgres/redis/minio as service containers.

## Conventions

- Prettier defaults (2-space, double quotes, semi, 80 cols, trailing commas "all") — do not hand-format.
- ESLint extends `next/core-web-vitals` + `plugin:@typescript-eslint/recommended`. `no-var` and `@typescript-eslint/no-empty-object-type` are intentionally off (needed for `declare global { var … }` and shadcn empty-interface patterns).
- Husky `pre-commit` runs `pnpm lint-staged` then `pnpm typecheck` — don't `--no-verify`.
- All user input validated with Zod on the server (not just client).
- UI strings live in `lib/i18n/en.ts`; don't hardcode strings in JSX.
- Dates/times rendered via `Intl.DateTimeFormat` with `tenant.timezone`.

## Git / collaboration

- Solo repo, pre-pilot. External PRs are not accepted yet (see README).
- Branch protection is on `main` with required status checks (`test`, `Analyze (javascript-typescript)`). Prefer PRs over direct pushes so CI gates run before code lands on `main`, even as a solo dev. Admin bypass is possible but defeats the point.
- Releases are tag-triggered: pushing `v*` builds and publishes a GHCR image (`.github/workflows/release.yml`); prod deploy is still manual — see `docs/RUNBOOK.md`.
