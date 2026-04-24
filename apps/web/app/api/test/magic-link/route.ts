import { NextRequest } from "next/server";

import { latestMagicLink } from "@pila/shared/domain/auth/test-magic-link-store";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

export async function GET(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return errorResponse(400, "missing_email");

  const entry = latestMagicLink(email);
  if (!entry) return errorResponse(404, "no_token");

  return Response.json({ url: entry.url, at: entry.at });
}
