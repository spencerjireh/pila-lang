# Pila Lang

[![CI](https://github.com/spencerjireh/pila-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/spencerjireh/pila-lang/actions/workflows/ci.yml)
[![CodeQL](https://github.com/spencerjireh/pila-lang/actions/workflows/codeql.yml/badge.svg)](https://github.com/spencerjireh/pila-lang/actions/workflows/codeql.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

A hosted, QR-first waitlist for small restaurants. Guests scan a QR, join a queue, and watch their position update live. Hosts see the queue in real time and seat or remove parties in one tap. Admins provision new tenants.

The name is Tagalog shorthand for "just a line" — a nod to the universal Filipino waiting experience.

**Status:** v1 MVP. Pre-pilot. Public for transparency; breaking changes likely until the first paying deployment.

## Quickstart

```bash
cp .env.example .env
docker compose up -d postgres redis minio migrator
pnpm install
pnpm db:migrate
pnpm seed --tenant=demo
pnpm dev
```

Open:

- Display (QR): http://localhost:3000/display/demo
- Host: http://localhost:3000/host/demo
- Admin: http://localhost:3000/admin (use an email on `ADMIN_EMAILS`)

## Scripts

```bash
pnpm typecheck       # tsc --noEmit
pnpm lint            # next lint
pnpm test            # vitest unit suite
pnpm e2e:install     # one-time: install Playwright browsers
pnpm e2e             # end-to-end suite (docker services required)
pnpm seed --tenant=<slug> [--with-waiters=N]
```

## Architecture

- Next.js 14 App Router, React 18, Tailwind.
- Postgres 16 (Drizzle ORM), Redis 7 (pub/sub + rate limits), S3-compatible blob store (MinIO in dev).
- SSE for live updates, signed JWT cookies for host sessions, signed QR tokens for the display.
- Admin sign-in via NextAuth magic link (Resend).

## Testing

- Vitest unit tests live next to the modules they cover (`lib/**/*.test.ts`).
- Playwright E2E specs live in `e2e/specs/`. The suite requires running docker services (postgres, redis, minio) and builds the app via `pnpm build && pnpm start` under `NODE_ENV=test`. Test-only API routes at `/api/test/*` are gated on `NODE_ENV==="test"` and never ship to production.

## Production + ops

See `docs/RUNBOOK.md` for host bootstrap, backup/restore, environment reference, and the password-rotation recovery path.

## Drizzle migrations

Migrations live in `drizzle/migrations/`. **Do not import them at runtime.** The migrator service applies them at boot.

## Contributing

Not accepting external pull requests yet — the product is pre-pilot and moving fast. Bug reports and questions via [issues](https://github.com/spencerjireh/pila-lang/issues) are welcome.

## License

Apache License 2.0. See [LICENSE](LICENSE).
