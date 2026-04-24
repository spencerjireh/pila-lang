import { NextRequest } from "next/server";
import { z } from "zod";

import { GUEST_COOKIE_NAME } from "@pila/shared/auth/guest-session";
import {
  GUEST_TOKEN_TTL_SECONDS,
  signGuestToken,
} from "@pila/shared/auth/guest-token";
import { clientIp, rateLimitResponse } from "@pila/shared/http/client-ip";
import { log } from "@pila/shared/log/logger";
import { findPartyById } from "@pila/shared/parties/lookup";
import { RateLimitError, consume } from "@pila/shared/ratelimit";
import { loadTenantBySlug } from "@pila/shared/tenants/display-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  partyId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  if (!cookie) return Response.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await consume("guestTokenPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const lookup = await loadTenantBySlug(parsed.data.slug);
  if (!lookup.ok) return Response.json({ error: "not_found" }, { status: 404 });
  const tenant = lookup.tenant;

  const party = await findPartyById(tenant.id, parsed.data.partyId);
  if (!party) return Response.json({ error: "not_found" }, { status: 404 });
  if (party.sessionToken !== cookie)
    return Response.json({ error: "forbidden" }, { status: 403 });

  const token = await signGuestToken({
    slug: tenant.slug,
    partyId: party.id,
  });

  log.info("guest.token.issued", { slug: tenant.slug, partyId: party.id });
  return Response.json(
    {
      token,
      tokenType: "Bearer",
      expiresIn: GUEST_TOKEN_TTL_SECONDS,
      slug: tenant.slug,
      partyId: party.id,
    },
    { status: 200 },
  );
}
