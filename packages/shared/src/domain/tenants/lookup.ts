import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants, type Tenant } from "@pila/db/schema";

export type TenantLookup =
  | { ok: true; tenant: Tenant }
  | { ok: false; reason: "not_found" };

export async function loadTenantBySlug(slug: string): Promise<TenantLookup> {
  const [tenant] = await getDb()
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) return { ok: false, reason: "not_found" };
  return { ok: true, tenant };
}
