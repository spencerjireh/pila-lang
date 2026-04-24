/* eslint-disable no-console */
import { eq } from "drizzle-orm";

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
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/domain/auth/password";
import { validateSlug } from "@pila/shared/primitives/validators/slug";

export interface UpsertTenantResult {
  id: string;
  slug: string;
  name: string;
  created: boolean;
  initialPassword: string | null;
}

export async function resetAllTables(): Promise<void> {
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

export async function upsertTenant(slug: string): Promise<UpsertTenantResult> {
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
  if (!slugCheck.ok) {
    throw new Error(`invalid slug "${slug}": ${slugCheck.reason}`);
  }

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
