import { and, eq } from "drizzle-orm";
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

    // parties.tenant_id FK is ON DELETE CASCADE; we only need the list of
    // waiting parties for the post-commit Redis fan-out.
    const affected = await tx
      .select({ id: parties.id })
      .from(parties)
      .where(
        and(eq(parties.tenantId, tenantId), eq(parties.status, "waiting")),
      );

    await tx.delete(tenants).where(eq(tenants.id, tenantId));

    return {
      ok: true,
      slug: tenant.slug,
      affectedPartyIds: affected.map((a) => a.id),
    } as const;
  });
}
