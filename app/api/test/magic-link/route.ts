import { NextRequest } from "next/server";

import { latestMagicLink } from "@pila/shared/auth/test-magic-link-store";
import { requireTestEnv } from "@pila/shared/test-api/guard";

export async function GET(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return Response.json({ error: "missing_email" }, { status: 400 });

  const entry = latestMagicLink(email);
  if (!entry) return Response.json({ error: "no_token" }, { status: 404 });

  return Response.json({ url: entry.url, at: entry.at });
}
