import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth/admin-guard";
import { getDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { validateSlug } from "@/lib/validators/slug";
import { generateInitialPassword, hashPassword } from "@/lib/auth/password";
import { isValidTimezone } from "@/lib/timezones";
import { createTenantSchema } from "@/lib/admin/tenant-schema";
import { log } from "@/lib/log/logger";

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

  const body = await req.json().catch(() => null);
  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, slug, timezone } = parsed.data;

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) {
    return Response.json(
      { error: "invalid_slug", reason: slugCheck.reason },
      { status: 400 },
    );
  }
  if (!isValidTimezone(timezone)) {
    return Response.json({ error: "invalid_timezone" }, { status: 400 });
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
    if (isUniqueViolation(err)) {
      return Response.json({ error: "slug_taken" }, { status: 409 });
    }
    log.error("admin.tenant.create.failed", { err: String(err) });
    return Response.json({ error: "internal" }, { status: 500 });
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
