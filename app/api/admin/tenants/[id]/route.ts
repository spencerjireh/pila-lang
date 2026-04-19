import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth/admin-guard";
import { getDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { validateAccentColor } from "@/lib/validators/contrast";
import { isValidTimezone } from "@/lib/timezones";
import { updateTenantSchema } from "@/lib/admin/tenant-schema";
import { hardDeleteTenant } from "@/lib/admin/delete-tenant";
import { publish, channelForTenantQueue, channelForParty } from "@/lib/redis/pubsub";
import { log } from "@/lib/log/logger";

type Params = { params: { id: string } };

const TENANT_COLUMNS = {
  id: tenants.id,
  slug: tenants.slug,
  name: tenants.name,
  logoUrl: tenants.logoUrl,
  accentColor: tenants.accentColor,
  timezone: tenants.timezone,
  isOpen: tenants.isOpen,
  isDemo: tenants.isDemo,
  createdAt: tenants.createdAt,
} as const;

export async function GET(_req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const [row] = await getDb().select(TENANT_COLUMNS).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ tenant: row });
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data;

  if (patch.accentColor !== undefined) {
    const check = validateAccentColor(patch.accentColor);
    if (!check.ok) {
      return Response.json({ error: "invalid_accent_color", reason: check.reason }, { status: 422 });
    }
  }
  if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) {
    return Response.json({ error: "invalid_timezone" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no_fields" }, { status: 400 });
  }

  const [existing] = await getDb()
    .select({ slug: tenants.slug, isOpen: tenants.isOpen })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });

  const [row] = await getDb().update(tenants).set(patch).where(eq(tenants.id, id)).returning(TENANT_COLUMNS);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  if (patch.isOpen !== undefined && patch.isOpen !== existing.isOpen) {
    await publish(channelForTenantQueue(existing.slug), {
      type: patch.isOpen ? "tenant:opened" : "tenant:closed",
    });
  }

  log.info("admin.tenant.updated", { tenantId: id, fields: Object.keys(patch) });
  return Response.json({ tenant: row });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const result = await hardDeleteTenant(id);
  if (!result.ok) {
    if (result.reason === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ error: "internal" }, { status: 500 });
  }

  await publish(channelForTenantQueue(result.slug), { type: "tenant:closed" });
  const resolvedAt = new Date().toISOString();
  await Promise.all(
    result.affectedPartyIds.map((partyId) =>
      publish(channelForParty(partyId), { type: "status_changed", status: "no_show", resolvedAt }),
    ),
  );

  log.info("admin.tenant.deleted", {
    tenantId: id,
    slug: result.slug,
    affectedParties: result.affectedPartyIds.length,
  });
  return Response.json({ ok: true });
}
