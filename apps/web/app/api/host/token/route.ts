import { NextRequest } from "next/server";
import { z } from "zod";

import {
  HOST_TOKEN_TTL_SECONDS,
  signHostToken,
} from "@pila/shared/domain/auth/host-token";
import { verifyPassword } from "@pila/shared/domain/auth/password";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const limited = await enforceRateLimit([
    { bucket: "hostTokenPerIp", key: clientIp(req.headers) },
    { bucket: "hostTokenPerSlug", key: parsed.data.slug },
  ]);
  if (limited) return limited;

  const lookup = await loadTenantBySlug(parsed.data.slug);
  if (!lookup.ok) return errorResponse(401, "invalid_credentials");
  const tenant = lookup.tenant;

  const match = await verifyPassword(
    parsed.data.password,
    tenant.hostPasswordHash,
  );
  if (!match) {
    log.info("host.token.rejected", { slug: tenant.slug });
    return errorResponse(401, "invalid_credentials");
  }

  const token = await signHostToken({
    slug: tenant.slug,
    pwv: tenant.hostPasswordVersion,
  });

  log.info("host.token.issued", { slug: tenant.slug });
  return Response.json(
    {
      token,
      tokenType: "Bearer",
      expiresIn: HOST_TOKEN_TTL_SECONDS,
      slug: tenant.slug,
    },
    { status: 200 },
  );
}
