import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { log } from "@pila/shared/infra/log/logger";
import { performHostAction } from "@pila/shared/domain/parties/host-actions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);

  let result;
  try {
    result = await performHostAction(
      guard.tenant.id,
      guard.tenant.slug,
      params.partyId,
      "remove",
    );
  } catch (err) {
    log.error("host.remove.failed", {
      slug: params.slug,
      partyId: params.partyId,
      err: String(err),
    });
    return errorResponse(500, "internal");
  }

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return errorResponse(status, result.reason);
  }

  log.info("host.party.removed", {
    slug: params.slug,
    partyId: params.partyId,
  });
  return applyHostRefresh(
    Response.json({ ok: true, resolvedAt: result.resolvedAt }, { status: 200 }),
    guard,
  );
}
