import { NextRequest } from "next/server";
import { z } from "zod";

import { GUEST_COOKIE_NAME } from "@pila/shared/domain/auth/guest-session";
import {
  GUEST_TOKEN_TTL_SECONDS,
  signGuestToken,
} from "@pila/shared/domain/auth/guest-token";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { log } from "@pila/shared/infra/log/logger";
import { findPartyById } from "@pila/shared/domain/parties/lookup";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  partyId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  if (!cookie) return errorResponse(401, "unauthorized");

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const limited = await enforceRateLimit([
    { bucket: "guestTokenPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

  const lookup = await loadTenantBySlug(parsed.data.slug);
  if (!lookup.ok) return errorResponse(404, "not_found");
  const tenant = lookup.tenant;

  const party = await findPartyById(tenant.id, parsed.data.partyId);
  if (!party) return errorResponse(404, "not_found");
  if (party.sessionToken !== cookie) return errorResponse(403, "forbidden");

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
