import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

const bodySchema = z.object({ slug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "invalid_body");

  // Schema cascades delete parties and notifications via FK.
  await getDb().delete(tenants).where(eq(tenants.slug, parsed.data.slug));
  return Response.json({ ok: true });
}
