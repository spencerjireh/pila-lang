# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pila Lang — a hosted, QR-first waitlist for small restaurants. Next.js 14 web app plus a Flutter mobile companion, backed by Postgres, Redis, and an S3-compatible blob store (RustFS in dev), self-hosted via Docker Compose. Pre-pilot v1 MVP; breaking changes are expected.

Authoritative design docs: `docs/Technical-Spec.md` (the contract — read this before changing queue, SSE, auth, or tenancy behavior), `docs/PRD.md`, `docs/User-Stories.md`, `docs/RUNBOOK.md`.

Visual/brand: `DESIGN.md` (palette, typography, voice, imagery contract). Living styleguide renders at `/design-system` when the web app is running.

## Layout

pnpm workspace + Turborepo monorepo:

```
apps/
  web/              # Next.js 14 app (@pila/web)
  mobile/           # Flutter guest / host / display surfaces (@pila/mobile, virtual)
packages/
  db/               # Drizzle schema, client, tenant-scoped wrappers + migrations (@pila/db)
  shared/           # Auth, parties, redis, push, storage, notifier, validators, etc. (@pila/shared)
  config/           # Shared tsconfig base + eslint preset (@pila/config)
scripts/seed.ts     # Local + CI tenant seed (uses @pila/db + @pila/shared)
e2e/                # Playwright specs against a real compose stack
docs/               # Technical-Spec, PRD, User-Stories, RUNBOOK, progress
```

## Common commands

```bash
pnpm dev                          # @pila/web next dev
pnpm build                        # turbo run build (builds @pila/web standalone)
pnpm typecheck                    # tsc (root) + turbo run typecheck (packages + apps/web)
pnpm lint                         # turbo run lint
pnpm format / pnpm format:check   # prettier
pnpm test                         # vitest (full unit suite across packages + apps/web)
pnpm test -- packages/shared/src/qr/token.test.ts  # single unit file
pnpm test:watch                   # vitest watch
pnpm db:generate                  # pnpm --filter @pila/db generate (new migration from schema)
pnpm db:migrate                   # pnpm --filter @pila/db migrate (normally the `migrator` compose service)
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

The `minio` service name in compose is historical — the image is now `rustfs/rustfs` (S3-compatible). The app talks to it via generic `S3_*` env vars.

Required package manager: `pnpm@10.23.0`, Node `>=22` (see `.nvmrc`). Flutter: `3.41.x` (see `apps/mobile/pubspec.yaml`).

## Architecture

Single Next.js 14 App Router server at `apps/web`. No edge functions, no serverless split — SSE requires a long-running Node process. `apps/mobile` is a Flutter client talking to the web API; it has no server code of its own.

- `apps/web/app/` — App Router routes. Three user surfaces plus admin:
  - `apps/web/app/r/<slug>/…` — guest join + wait (public, QR-gated)
  - `apps/web/app/host/<slug>/…` — host stand (per-tenant shared password → JWT cookie)
  - `apps/web/app/display/<slug>/…` — kiosk QR
  - `apps/web/app/admin/…` — internal admin (NextAuth magic link via Resend; gated by `ADMIN_EMAILS` allow list)
  - `apps/web/app/api/…` — route handlers mirroring the surfaces above, plus `api/test/*` (gated on `NODE_ENV==="test"` OR `ENABLE_TEST_ROUTES=1`; never ships to prod)
- `apps/web/lib/` — web-only helpers: `i18n/en.ts`, `sse/` (server `stream.ts`, client `useLiveStream` hook, `apply-tenant-event` reducer), `routes/` (route-handler shared logic — `host-party-action`, `host-open-close`), `auth/guard-host-page.ts` (server-component host guard), `forms/use-json-mutation.ts`, `time.ts`, `utils.ts` (shadcn `cn()`).
- `apps/web/components/` — shadcn/ui primitives + app components.
- `packages/db/` — Drizzle schema (`src/schema.ts`), client (`src/client.ts`), tenant-scoped wrappers (`src/tenant-scoped.ts`), plus `migrations/` (generated SQL, never imported at runtime — the `migrator` compose service applies them at boot; `app` waits on `service_completed_successfully`).
- `packages/shared/src/` — cross-surface server code imported by apps/web AND scripts/seed. Layered into `domain/` (business rules) → `infra/` (IO adapters) → `primitives/` (pure utilities); the dependency direction only flows downward, enforced by convention rather than lint:
  - `domain/` — `auth/` (host/guest/bearer JWTs, password, guards, sessions, NextAuth glue), `parties/` (join, leave, host-actions, position, host-stream, undo-store, tenant-updates, guest-history), `notifier/` (Noop + TestSpy + `PushNotifier` v1.5 seam), `push/` (FCM registry + dispatch + auth), `tenants/`, `host/`, `admin/`.
  - `infra/` — `redis/` (split subscribe + publish clients), `storage/` (S3 client + sharp logo pipeline), `push/firebase.ts` (FCM adapter), `email/`, `http/`, `log/`, `ratelimit/`.
  - `primitives/` — `qr/` (HMAC token sign/verify), `config/env.ts`, `validators/`, `time/`, `timezones.ts`, `test-api/`, `lazy.ts`.
- `packages/config/` — `tsconfig.base.json` + `eslint-preset.js` consumed by every TS package.
- `scripts/seed.ts` (thin entry that delegates to `scripts/seed/cli.ts` with `tenant.ts` / `parties.ts` helpers) — used by local dev and CI. Same Drizzle wrappers as the app, so schema drift breaks seeding loudly.
- `e2e/` — Playwright specs against a real compose stack.

### Load-bearing invariants

These are easy to break and expensive to debug. Read `docs/Technical-Spec.md` for the full rationale before editing the code that enforces them.

- **Tenancy scoping.** Every query on `parties` / `notifications` must go through a service wrapper that takes a `tenantId`. Never expose `tenant_id` to the client; resolve from the URL slug server-side.
- **SSE setup order.** In stream handlers: subscribe to Redis **first**, then read the Postgres snapshot, then emit the snapshot, then forward live diffs. Inverting this drops events in the gap.
- **Publish after commit.** Every write path that changes queue state publishes to Redis **after** the DB write commits (host queue channel + position updates via `publishPositionUpdates(tenantId, slug)` for any reorder — join skips position updates because it appends).
- **Host JWT rolling refresh.** Middleware re-issues the cookie in the last hour of validity; the JWT carries `pwv` (host_password_version) and a slug — mismatch → 403, stale `pwv` → 401 + clear cookie. Password rotation / "log out all devices" bumps `pwv`.
- **QR tokens.** HMAC of `<slug>:<issuedAtMs>` with `QR_TOKEN_SECRET`; rotated hourly with a 5-minute overlap. Verify slug + signature + age on every join.
- **Terminal SSE.** When a party hits a terminal status, emit one final event and close the stream; reconnects to a resolved party return **204** so `EventSource` stops retrying. A missing party row also returns 204 (orphaned cookie).
- **Undo.** Redis list `undo:tenant:<tenantId>`; 60-second per-frame eligibility enforced on `LPOP`. Shared across all host sessions for the tenant.
- **Redis connection split.** One shared subscribe connection multiplexed across SSE handlers; a separate pooled client for publishes + rate limiting. Don't mix subscribe and normal commands on one connection.
- **Slugs are immutable** after tenant creation (printed QRs must keep working); reserved names live in the slug validator.
- **Notifier TestSpy brand.** `packages/shared/src/notifier/index.ts` tags its spy with `Symbol.for("pila.notifier.testSpy")` so brand checks survive across Next.js route-bundle copies.
- **`/api/test/notifier/calls` is `export const dynamic = "force-dynamic"`**. Defeats Next's data cache between drain() calls in ops-notifier.spec.ts.

## Testing

- Unit tests live next to the module: `packages/**/src/**/*.test.ts`, `apps/web/**/*.test.ts`. Run a single file with `pnpm test -- <path>`.
- `vitest.setup.ts` wires test-only globals. `vitest.config.ts` is the source of truth for include/exclude (covers apps/web + packages + scripts).
- E2E (`e2e/specs/`) requires the docker services running and builds apps/web under `NODE_ENV=test`. The `/api/test/*` routes are only mounted when `NODE_ENV==="test"` OR `ENABLE_TEST_ROUTES=1`. CI sets the latter because `next start` forces `NODE_ENV=production` at runtime.
- CI (`.github/workflows/ci.yml`) runs format:check → lint → typecheck → migrate → unit → build → seed(demo) → e2e, with postgres / redis / rustfs as service containers. The Flutter job runs `flutter analyze` + `flutter test` in `apps/mobile` with Flutter 3.41.x.

## Conventions

- Prettier defaults (2-space, double quotes, semi, 80 cols, trailing commas "all") — do not hand-format.
- ESLint extends `next/core-web-vitals` + `plugin:@typescript-eslint/recommended`. `no-var` and `@typescript-eslint/no-empty-object-type` are intentionally off (needed for `declare global { var … }` and shadcn empty-interface patterns).
- Husky `pre-commit` runs `pnpm lint-staged` then `pnpm typecheck` — don't `--no-verify`.
- All user input validated with Zod on the server (not just client).
- UI strings live in `apps/web/lib/i18n/en.ts`; don't hardcode strings in JSX.
- Dates/times rendered via `Intl.DateTimeFormat` with `tenant.timezone`.
- Workspace package imports: `@pila/db/...`, `@pila/shared/...`. Inside `apps/web`, `@/...` resolves to `apps/web/...` (Next plugin).

## Git / collaboration

- Solo repo, pre-pilot. External PRs are not accepted yet (see README).
- Branch protection is on `main` with required status checks (`test`, `Analyze (javascript-typescript)`). Prefer PRs over direct pushes so CI gates run before code lands on `main`, even as a solo dev. Admin bypass is possible but defeats the point.
- Releases are tag-triggered: pushing `v*` builds and publishes a GHCR image (`.github/workflows/release.yml`); prod deploy is still manual — see `docs/RUNBOOK.md`.
