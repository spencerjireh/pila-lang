import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";

import { requireAdminApi } from "@pila/shared/auth/admin-guard";
import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/auth/password";
import { log } from "@pila/shared/log/logger";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const initialPassword = generateInitialPassword();
  const hostPasswordHash = await hashPassword(initialPassword);

  const [row] = await getDb()
    .update(tenants)
    .set({
      hostPasswordHash,
      hostPasswordVersion: sql`${tenants.hostPasswordVersion} + 1`,
    })
    .where(eq(tenants.id, id))
    .returning({
      id: tenants.id,
      slug: tenants.slug,
      hostPasswordVersion: tenants.hostPasswordVersion,
    });

  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  log.info("admin.tenant.password_reset", {
    tenantId: id,
    version: row.hostPasswordVersion,
  });
  return Response.json({ initialPassword });
}
