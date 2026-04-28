import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

const bodySchema = z.object({ slug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  // Schema cascades delete parties and notifications via FK.
  await getDb().delete(tenants).where(eq(tenants.slug, parsed.data.slug));
  return Response.json({ ok: true });
}
