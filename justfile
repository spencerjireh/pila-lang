# Pila Lang task menu. Pure additive over pnpm / docker compose / flutter /
# xcrun — every recipe shells out to existing tools. Delete this file and the
# repo still works the same way. Run `just` (or `just --list`) to see all
# recipes.

set positional-arguments

# Show all recipes
default:
    @just --list

# === Setup ===

# Install JS deps via pnpm
install:
    pnpm install

# Install Playwright browsers (one-time)
e2e-install:
    pnpm e2e:install

# === Services (docker compose) ===

# Bring up postgres / redis / minio / migrator and wait for healthy
up:
    docker compose up -d --wait postgres redis minio migrator

# Stop services (volumes preserved)
down:
    docker compose down

# Wipe volumes and bring services back up — destructive, idempotent
reset:
    docker compose down -v
    docker compose up -d --wait postgres redis minio migrator

# Tail logs for one service (default: app)
logs svc="app":
    docker compose logs -f {{svc}}

# Tail web app logs
logs-app:
    docker compose logs -f app

# Tail postgres logs
logs-db:
    docker compose logs -f postgres

# === Dev loop ===

# Start the Next.js dev server (waits for services first)
dev: up
    pnpm dev

# Same as `dev` but with ENABLE_TEST_ROUTES=1 so /api/test/* is mounted (needed by sim-smoke)
dev-test: up
    ENABLE_TEST_ROUTES=1 pnpm dev

# Open Drizzle Studio
studio:
    pnpm db:studio

# === Quality gates ===

# Full check: format + lint + typecheck + JS tests + mobile analyze + mobile tests
check:
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm test
    just mobile-analyze
    just mobile-test

# Run tsc / turbo typecheck
typecheck:
    pnpm typecheck

# Run ESLint via turbo
lint:
    pnpm lint

# Format with Prettier (writes)
format:
    pnpm format

# Format check only (no writes)
format-check:
    pnpm format:check

# Run vitest. Pass an optional file path: `just test packages/shared/src/.../foo.test.ts`
test path="":
    pnpm test {{path}}

# Vitest in watch mode
test-watch:
    pnpm test:watch

# === Database ===

# Generate a new Drizzle migration from schema diffs
db-generate:
    pnpm db:generate

# Apply pending migrations (normally the migrator service does this)
db-migrate:
    pnpm db:migrate

# === Seed ===

# Examples: `just seed` (demo fixture), `just seed acme`, `just seed acme 5`
# Upsert a tenant — default demo tenant gets the 3-waiting + 10-history fixture
seed tenant="demo" waiters="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "{{waiters}}" ]; then
        pnpm seed --tenant={{tenant}} --with-waiters={{waiters}}
    else
        pnpm seed --tenant={{tenant}}
    fi

# === E2E (Playwright) ===

# Build + run full Playwright suite
e2e: up
    pnpm build
    pnpm e2e

# Playwright UI mode
e2e-ui: up
    pnpm e2e:ui

# === Mobile (Flutter) ===

# Static analysis on apps/mobile
[working-directory: 'apps/mobile']
mobile-analyze:
    flutter analyze

# Run apps/mobile unit tests
[working-directory: 'apps/mobile']
mobile-test:
    flutter test

# Launch the mobile app on a connected device or simulator
[working-directory: 'apps/mobile']
mobile-run:
    flutter run

# Mobile-side check: analyze + test
mobile-check: mobile-analyze mobile-test

# === Build / release ===

# Production build (turbo)
build:
    pnpm build

# Start the built Next.js server
start:
    pnpm start

# === Hygiene ===

# Wipe local build/cache artifacts
clean:
    rm -rf apps/web/.next
    rm -rf .turbo apps/*/.turbo packages/*/.turbo
    rm -rf node_modules/.cache

# Nuke and reinstall everything (slow; ~1-2 min)
fresh:
    docker compose down -v
    rm -rf node_modules apps/*/node_modules packages/*/node_modules
    pnpm install
    docker compose up -d --wait postgres redis minio migrator

# === iOS Simulator smoke (local only) ===

# Phases: cold | push | qr | all (default). Local-only — needs Accessibility-granted terminal.
# Run the cliclick-driven iOS Simulator smoke (4 scenarios, 3 verification modes)
sim-smoke phase="all": up seed
    ./scripts/sim-smoke.sh --phase={{phase}}
