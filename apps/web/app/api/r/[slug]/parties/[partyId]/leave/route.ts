import { NextRequest } from "next/server";

import {
  applyGuestRefresh,
  guardGuestRequest,
  statusForGuestFailure,
} from "@pila/shared/domain/auth/guest-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { log } from "@pila/shared/infra/log/logger";
import { leaveQueue } from "@pila/shared/domain/parties/leave";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const guard = await guardGuestRequest(req, params.slug, params.partyId);
  if (!guard.ok) {
    const status = statusForGuestFailure(guard.reason, "action");
    return errorResponse(status, guard.reason);
  }

  const { tenant } = guard;

  let result;
  try {
    result = await leaveQueue(tenant.id, tenant.slug, params.partyId);
  } catch (err) {
    log.error("leave.failed", {
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

  log.info("party.left", { slug: params.slug, partyId: params.partyId });
  return applyGuestRefresh(
    Response.json({ ok: true, resolvedAt: result.resolvedAt }),
    guard,
  );
}
