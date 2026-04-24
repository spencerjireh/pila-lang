import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  hostCookieAttrs,
  HOST_COOKIE_NAME,
} from "@pila/shared/domain/auth/host-session";
import { signHostToken } from "@pila/shared/domain/auth/host-token";
import { verifyPassword } from "@pila/shared/domain/auth/password";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const limited = await enforceRateLimit([
    { bucket: "loginPerIp", key: clientIp(req.headers) },
    { bucket: "loginPerSlug", key: params.slug },
  ]);
  if (limited) return limited;

  const parsed = await parseJsonBody(req, loginSchema);
  if (!parsed.ok) return parsed.response;

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) return errorResponse(401, "invalid_credentials");
  const tenant = lookup.tenant;

  const match = await verifyPassword(
    parsed.data.password,
    tenant.hostPasswordHash,
  );
  if (!match) {
    log.info("host.login.rejected", { slug: tenant.slug });
    return errorResponse(401, "invalid_credentials");
  }

  const token = await signHostToken({
    slug: tenant.slug,
    pwv: tenant.hostPasswordVersion,
  });
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set({
    name: HOST_COOKIE_NAME,
    value: token,
    ...hostCookieAttrs(),
  });
  log.info("host.login.ok", { slug: tenant.slug });
  return res;
}
