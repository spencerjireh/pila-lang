import { NextRequest } from "next/server";

import { clientIp, rateLimitResponse } from "@pila/shared/http/client-ip";
import { log } from "@pila/shared/log/logger";
import { verifyQrToken } from "@pila/shared/qr/token";
import { RateLimitError, consume } from "@pila/shared/ratelimit";
import { loadTenantBySlug } from "@pila/shared/tenants/display-token";

export const dynamic = "force-dynamic";

export type GuestInfoTokenStatus =
  | "ok"
  | "expired"
  | "invalid"
  | "missing"
  | "unchecked";

export interface GuestInfo {
  name: string;
  logoUrl: string | null;
  accentColor: string;
  isOpen: boolean;
  tokenStatus: GuestInfoTokenStatus;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const ip = clientIp(req.headers);
  try {
    await consume("displayRequestsPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err.retryAfterSec);
    }
    throw err;
  }

  let lookup;
  try {
    lookup = await loadTenantBySlug(params.slug);
  } catch (err) {
    log.error("r.info.lookup_failed", {
      slug: params.slug,
      err: String(err),
    });
    return Response.json({ error: "internal" }, { status: 500 });
  }
  if (!lookup.ok) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const tenant = lookup.tenant;

  const rawToken = req.nextUrl.searchParams.get("t");
  let tokenStatus: GuestInfoTokenStatus;
  if (rawToken === null) {
    tokenStatus = "unchecked";
  } else if (rawToken === "") {
    tokenStatus = "missing";
  } else {
    const verdict = verifyQrToken(tenant.slug, rawToken);
    if (verdict.ok) tokenStatus = "ok";
    else tokenStatus = verdict.reason === "expired" ? "expired" : "invalid";
  }

  const body: GuestInfo = {
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    accentColor: tenant.accentColor,
    isOpen: tenant.isOpen,
    tokenStatus,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
