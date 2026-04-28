import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { parties } from "@pila/db/schema";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

export const dynamic = "force-dynamic";

// Diagnostic: reads a party row by id without tenant scoping. The smoke flow
// knows partyId but not tenantId, so we read directly. Guarded by
// requireTestEnv so this never reaches production.
export async function GET(
  _req: NextRequest,
  { params }: { params: { partyId: string } },
) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const rows = await getDb()
    .select({
      id: parties.id,
      tenantId: parties.tenantId,
      name: parties.name,
      phone: parties.phone,
      partySize: parties.partySize,
      status: parties.status,
      joinedAt: parties.joinedAt,
      seatedAt: parties.seatedAt,
      resolvedAt: parties.resolvedAt,
    })
    .from(parties)
    .where(eq(parties.id, params.partyId))
    .limit(1);

  const row = rows[0];
  if (!row) return errorResponse(404, "not_found");
  return Response.json(row);
}
