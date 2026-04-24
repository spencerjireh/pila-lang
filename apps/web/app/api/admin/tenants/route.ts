import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { requireAdminApi } from "@pila/shared/domain/auth/admin-guard";
import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { validateSlug } from "@pila/shared/primitives/validators/slug";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/domain/auth/password";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { isValidTimezone } from "@pila/shared/primitives/timezones";
import { createTenantSchema } from "@pila/shared/domain/admin/tenant-schema";
import { log } from "@pila/shared/infra/log/logger";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const rows = await getDb()
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      logoUrl: tenants.logoUrl,
      accentColor: tenants.accentColor,
      timezone: tenants.timezone,
      isOpen: tenants.isOpen,
      isDemo: tenants.isDemo,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
  return Response.json({ tenants: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, createTenantSchema);
  if (!parsed.ok) return parsed.response;
  const { name, slug, timezone } = parsed.data;

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) {
    return errorResponse(400, "invalid_slug", { reason: slugCheck.reason });
  }
  if (!isValidTimezone(timezone)) {
    return errorResponse(400, "invalid_timezone");
  }

  const initialPassword = generateInitialPassword();
  const hostPasswordHash = await hashPassword(initialPassword);

  try {
    const [row] = await getDb()
      .insert(tenants)
      .values({ name, slug, hostPasswordHash, timezone })
      .returning({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        logoUrl: tenants.logoUrl,
        accentColor: tenants.accentColor,
        timezone: tenants.timezone,
        isOpen: tenants.isOpen,
        isDemo: tenants.isDemo,
        createdAt: tenants.createdAt,
      });
    log.info("admin.tenant.created", { tenantId: row!.id, slug });
    return Response.json({ tenant: row, initialPassword }, { status: 201 });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) return errorResponse(409, "slug_taken");
    log.error("admin.tenant.create.failed", { err: String(err) });
    return errorResponse(500, "internal");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
