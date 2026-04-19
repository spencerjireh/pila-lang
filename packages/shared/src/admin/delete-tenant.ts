import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@pila/db/client";
import { parties, tenants } from "@pila/db/schema";

export type HardDeleteResult =
  | { ok: true; slug: string; affectedPartyIds: string[] }
  | { ok: false; reason: "not_found" };

export async function hardDeleteTenant(
  tenantId: string,
): Promise<HardDeleteResult> {
  return getDb().transaction(async (tx) => {
    const [tenant] = await tx
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) return { ok: false, reason: "not_found" } as const;

    await tx
      .update(tenants)
      .set({ isOpen: false })
      .where(eq(tenants.id, tenantId));

    const affected = await tx
      .update(parties)
      .set({ status: "no_show", resolvedAt: sql`now()` })
      .where(and(eq(parties.tenantId, tenantId), eq(parties.status, "waiting")))
      .returning({ id: parties.id });

    await tx.delete(tenants).where(eq(tenants.id, tenantId));

    return {
      ok: true,
      slug: tenant.slug,
      affectedPartyIds: affected.map((a) => a.id),
    } as const;
  });
}
