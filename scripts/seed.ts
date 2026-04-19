/* eslint-disable no-console */
// Seed CLI.
//
// Usage:
//   pnpm seed --reset                          Truncate all app tables.
//   pnpm seed --tenant=demo                    Upsert demo tenant + reset its fixture (3 waiting + 10 historical).
//   pnpm seed --tenant=<slug>                  Upsert a tenant. If --with-waiters=N, also seed N waiters.
//   pnpm seed --tenant=<slug> --with-waiters=5 Upsert tenant + 5 staggered waiters.
//   pnpm seed --json                           Emit a single JSON line instead of human text.
//
// Re-running with the same slug is idempotent: the tenant row is not duplicated; waiters / demo rows are
// cleared before re-inserting. The initial host password is generated on first create and cannot be retrieved
// later — the script prints it once, then subsequent runs print { passwordPreserved: true }.

import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  DEMO_WAITING,
  DEMO_HISTORICAL,
  resetDemoFixture,
} from "@pila/shared/admin/demo-fixture";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/auth/password";
import { getDb } from "@pila/db/client";
import {
  accounts,
  admins,
  notifications,
  parties,
  sessions,
  tenants,
  users,
  verificationTokens,
} from "@pila/db/schema";
import { validateSlug } from "@pila/shared/validators/slug";

interface Args {
  reset: boolean;
  tenant: string | null;
  withWaiters: number | null;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    reset: false,
    tenant: null,
    withWaiters: null,
    json: false,
  };
  for (const raw of argv) {
    if (raw === "--reset") args.reset = true;
    else if (raw === "--json") args.json = true;
    else if (raw.startsWith("--tenant="))
      args.tenant = raw.slice("--tenant=".length);
    else if (raw.startsWith("--with-waiters=")) {
      const n = Number(raw.slice("--with-waiters=".length));
      if (!Number.isFinite(n) || n < 0)
        throw new Error(`invalid --with-waiters: ${raw}`);
      args.withWaiters = Math.floor(n);
    } else {
      throw new Error(`unknown arg: ${raw}`);
    }
  }
  return args;
}

async function resetAll() {
  const db = getDb();
  // FK order: children first.
  await db.delete(notifications);
  await db.delete(parties);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verificationTokens);
  await db.delete(users);
  await db.delete(admins);
  await db.delete(tenants);
}

async function upsertTenant(slug: string): Promise<{
  id: string;
  slug: string;
  name: string;
  created: boolean;
  initialPassword: string | null;
}> {
  const db = getDb();
  const existing = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (existing[0]) {
    return { ...existing[0], created: false, initialPassword: null };
  }

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok)
    throw new Error(`invalid slug "${slug}": ${slugCheck.reason}`);

  const isDemo = slug === "demo";
  const name = isDemo ? "Demo Diner" : titleCase(slug);
  const initialPassword = generateInitialPassword();
  const hostPasswordHash = await hashPassword(initialPassword);

  const [row] = await db
    .insert(tenants)
    .values({
      slug,
      name,
      hostPasswordHash,
      isDemo,
      timezone: "Asia/Kolkata",
    })
    .returning({ id: tenants.id, slug: tenants.slug, name: tenants.name });

  return { ...row!, created: true, initialPassword };
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

async function seedWaiters(tenantId: string, count: number) {
  const db = getDb();
  // Fresh: clear any waiting rows first so the waiter count is exact.
  await db
    .delete(parties)
    .where(
      sql`${parties.tenantId} = ${tenantId} AND ${parties.status} = 'waiting'`,
    );

  if (count === 0) return;
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, i) => {
    const minutesAgo = (count - i) * 5;
    return {
      tenantId,
      name: `Guest ${i + 1}`,
      partySize: (i % 4) + 2,
      status: "waiting",
      sessionToken: randomUUID(),
      joinedAt: new Date(now - minutesAgo * 60_000),
    };
  });
  await db.insert(parties).values(rows);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result: Record<string, unknown> = {};

  if (args.reset) {
    await resetAll();
    result.reset = true;
  }

  if (args.tenant) {
    const t = await upsertTenant(args.tenant);
    result.tenant = {
      id: t.id,
      slug: t.slug,
      name: t.name,
      created: t.created,
    };
    if (t.initialPassword) result.initialPassword = t.initialPassword;

    if (t.slug === "demo") {
      const reset = await resetDemoFixture(t.id);
      if (!reset.ok) {
        throw new Error(`resetDemoFixture failed: ${reset.reason}`);
      }
      result.demoWaiting = DEMO_WAITING.length;
      result.demoHistorical = DEMO_HISTORICAL.length;
    } else if (args.withWaiters !== null) {
      await seedWaiters(t.id, args.withWaiters);
      result.waiters = args.withWaiters;
    }
  }

  if (!args.reset && !args.tenant) {
    result.noop = true;
    result.hint = "pass --reset or --tenant=<slug>";
  }

  if (args.json) {
    console.log(JSON.stringify(result));
  } else {
    if (result.reset) console.log("Truncated all app tables.");
    if (result.tenant) {
      const t = result.tenant as {
        slug: string;
        id: string;
        created: boolean;
        name: string;
      };
      console.log(
        `${t.created ? "Created" : "Found"} tenant "${t.slug}" (${t.id})`,
      );
      if (result.initialPassword) {
        console.log(`  Initial host password: ${result.initialPassword}`);
        console.log(
          "  (shown once; use admin reset-password to issue a new one)",
        );
      } else if (!t.created) {
        console.log(
          "  (existing tenant — password preserved; use admin reset-password if lost)",
        );
      }
      if (result.demoWaiting) {
        console.log(
          `  Demo fixture: ${result.demoWaiting} waiting, ${result.demoHistorical} historical`,
        );
      }
      if (typeof result.waiters === "number") {
        console.log(
          `  Seeded ${result.waiters} waiter${result.waiters === 1 ? "" : "s"}.`,
        );
      }
    }
    if (result.noop) {
      console.log("Nothing to do — pass --reset or --tenant=<slug>.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
