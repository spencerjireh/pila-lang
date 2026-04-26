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

import {
  DEMO_HISTORICAL,
  DEMO_WAITING,
  resetDemoFixture,
} from "@pila/shared/domain/admin/demo-fixture";

import { seedWaiters } from "./parties";
import { resetAllTables, upsertTenant } from "./tenant";

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

function out(line: string): void {
  process.stdout.write(line + "\n");
}

function printHumanOutput(result: Record<string, unknown>): void {
  if (result.reset) out("Truncated all app tables.");
  if (result.tenant) {
    const t = result.tenant as {
      slug: string;
      id: string;
      created: boolean;
      name: string;
    };
    out(`${t.created ? "Created" : "Found"} tenant "${t.slug}" (${t.id})`);
    if (result.initialPassword) {
      out(`  Initial host password: ${result.initialPassword}`);
      out("  (shown once; use admin reset-password to issue a new one)");
    } else if (!t.created) {
      out(
        "  (existing tenant — password preserved; use admin reset-password if lost)",
      );
    }
    if (result.demoWaiting) {
      out(
        `  Demo fixture: ${result.demoWaiting} waiting, ${result.demoHistorical} historical`,
      );
    }
    if (typeof result.waiters === "number") {
      out(
        `  Seeded ${result.waiters} waiter${result.waiters === 1 ? "" : "s"}.`,
      );
    }
  }
  if (result.noop) {
    out("Nothing to do — pass --reset or --tenant=<slug>.");
  }
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result: Record<string, unknown> = {};

  if (args.reset) {
    await resetAllTables();
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
    out(JSON.stringify(result));
  } else {
    printHumanOutput(result);
  }
}
