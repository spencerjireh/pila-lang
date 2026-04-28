import type { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { performHostAction } from "@pila/shared/domain/parties/host-actions";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";

const PAST_TENSE: Record<"seat" | "remove", "seated" | "removed"> = {
  seat: "seated",
  remove: "removed",
};

export function hostPartyActionHandler(action: "seat" | "remove") {
  return async (
    req: NextRequest,
    { params }: { params: { slug: string; partyId: string } },
  ) => {
    const limited = await enforceRateLimit([
      { bucket: "hostMutationPerSlug", key: params.slug },
    ]);
    if (limited) return limited;

    const guard = await guardHostRequest(req, params.slug);
    if (!guard.ok) return hostGuardErrorResponse(guard);

    let result;
    try {
      result = await performHostAction(
        guard.tenant.id,
        guard.tenant.slug,
        params.partyId,
        action,
      );
    } catch (err) {
      log.error(`host.${action}.failed`, {
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

    log.info(`host.party.${PAST_TENSE[action]}`, {
      slug: params.slug,
      partyId: params.partyId,
    });
    return applyHostRefresh(
      Response.json(
        { ok: true, resolvedAt: result.resolvedAt },
        { status: 200 },
      ),
      guard,
    );
  };
}
