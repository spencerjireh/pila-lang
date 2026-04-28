import { NextRequest } from "next/server";

import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { log } from "@pila/shared/infra/log/logger";
import { verifyQrToken } from "@pila/shared/primitives/qr/token";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

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
  const limited = await enforceRateLimit([
    { bucket: "guestViewPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

  let lookup;
  try {
    lookup = await loadTenantBySlug(params.slug);
  } catch (err) {
    log.error("r.info.lookup_failed", {
      slug: params.slug,
      err: String(err),
    });
    return errorResponse(500, "internal");
  }
  if (!lookup.ok) return errorResponse(404, "not_found");
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
