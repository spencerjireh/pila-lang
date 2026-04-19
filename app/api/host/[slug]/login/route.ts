import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hostCookieAttrs, HOST_COOKIE_NAME } from "@/lib/auth/host-session";
import { signHostToken } from "@/lib/auth/host-token";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { RateLimitError, consume } from "@/lib/ratelimit";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const ip = clientIp(req.headers);
  try {
    await consume("loginPerIp", ip);
    await consume("loginPerSlug", params.slug);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok)
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  const tenant = lookup.tenant;

  const match = await verifyPassword(
    parsed.data.password,
    tenant.hostPasswordHash,
  );
  if (!match) {
    log.info("host.login.rejected", { slug: tenant.slug });
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
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
