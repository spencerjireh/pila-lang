import { NextRequest } from "next/server";
import { z } from "zod";

import {
  HOST_TOKEN_TTL_SECONDS,
  signHostToken,
} from "@pila/shared/auth/host-token";
import { verifyPassword } from "@pila/shared/auth/password";
import { clientIp, rateLimitResponse } from "@pila/shared/http/client-ip";
import { log } from "@pila/shared/log/logger";
import { RateLimitError, consume } from "@pila/shared/ratelimit";
import { loadTenantBySlug } from "@pila/shared/tenants/display-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const ip = clientIp(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await consume("hostTokenPerIp", ip);
    await consume("hostTokenPerSlug", parsed.data.slug);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const lookup = await loadTenantBySlug(parsed.data.slug);
  if (!lookup.ok) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  const tenant = lookup.tenant;

  const match = await verifyPassword(
    parsed.data.password,
    tenant.hostPasswordHash,
  );
  if (!match) {
    log.info("host.token.rejected", { slug: tenant.slug });
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
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
