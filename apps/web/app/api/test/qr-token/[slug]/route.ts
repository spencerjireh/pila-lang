import { NextRequest } from "next/server";

import { signQrToken } from "@pila/shared/primitives/qr/token";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const issuedAtMs = Date.now();
  const token = signQrToken(params.slug, issuedAtMs);
  return Response.json({ slug: params.slug, token, issuedAtMs });
}
