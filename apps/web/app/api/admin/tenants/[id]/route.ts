import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@pila/shared/domain/auth/admin-guard";
import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { validateAccentColor } from "@pila/shared/primitives/validators/contrast";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { isValidTimezone } from "@pila/shared/primitives/timezones";
import { updateTenantSchema } from "@pila/shared/domain/admin/tenant-schema";
import { hardDeleteTenant } from "@pila/shared/domain/admin/delete-tenant";
import {
  publish,
  channelForTenantQueue,
  channelForParty,
} from "@pila/shared/infra/redis/pubsub";
import { log } from "@pila/shared/infra/log/logger";

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

  const [row] = await getDb()
    .select(TENANT_COLUMNS)
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!row) return errorResponse(404, "not_found");
  return Response.json({ tenant: row });
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const parsed = await parseJsonBody(req, updateTenantSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;

  if (patch.accentColor !== undefined) {
    const check = validateAccentColor(patch.accentColor);
    if (!check.ok) {
      return errorResponse(422, "invalid_accent_color", {
        reason: check.reason,
      });
    }
  }
  if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) {
    return errorResponse(400, "invalid_timezone");
  }
  if (Object.keys(patch).length === 0) {
    return errorResponse(400, "no_fields");
  }

  const [existing] = await getDb()
    .select({ slug: tenants.slug, isOpen: tenants.isOpen })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!existing) return errorResponse(404, "not_found");

  const [row] = await getDb()
    .update(tenants)
    .set(patch)
    .where(eq(tenants.id, id))
    .returning(TENANT_COLUMNS);
  if (!row) return errorResponse(404, "not_found");

  if (patch.isOpen !== undefined && patch.isOpen !== existing.isOpen) {
    await publish(channelForTenantQueue(existing.slug), {
      type: patch.isOpen ? "tenant:opened" : "tenant:closed",
    });
  }

  log.info("admin.tenant.updated", {
    tenantId: id,
    fields: Object.keys(patch),
  });
  return Response.json({ tenant: row });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const result = await hardDeleteTenant(id);
  if (!result.ok) {
    if (result.reason === "not_found") return errorResponse(404, "not_found");
    return errorResponse(500, "internal");
  }

  await publish(channelForTenantQueue(result.slug), { type: "tenant:closed" });
  const resolvedAt = new Date().toISOString();
  await Promise.all(
    result.affectedPartyIds.map((partyId) =>
      publish(channelForParty(partyId), {
        type: "status_changed",
        status: "no_show",
        resolvedAt,
      }),
    ),
  );

  log.info("admin.tenant.deleted", {
    tenantId: id,
    slug: result.slug,
    affectedParties: result.affectedPartyIds.length,
  });
  return Response.json({ ok: true });
}
