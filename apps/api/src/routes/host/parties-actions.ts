import { Router, type Request, type Response } from "express";

import { performHostAction } from "@pila/shared/domain/parties/host-actions";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostPartiesActionsRouter = Router();

const PAST_TENSE: Record<"seat" | "remove", "seated" | "removed"> = {
  seat: "seated",
  remove: "removed",
};

function handler(action: "seat" | "remove") {
  return asyncHandler(async (req: Request, res: Response) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;
    const partyId = String(req.params.partyId ?? "");
    if (!partyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "hostMutationPerSlug", key: slug },
    ]);
    if (limited) return;

    let result;
    try {
      result = await performHostAction(guard.tenant.id, slug, partyId, action);
    } catch (err) {
      log.error(`host.${action}.failed`, {
        slug,
        partyId,
        err: String(err),
      });
      res.status(500).json({ error: "internal" });
      return;
    }

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    log.info(`host.party.${PAST_TENSE[action]}`, { slug, partyId });
    res.json({ ok: true, resolvedAt: result.resolvedAt });
  });
}

hostPartiesActionsRouter.post(
  "/host/:slug/parties/:partyId/seat",
  requireHost,
  handler("seat"),
);
hostPartiesActionsRouter.post(
  "/host/:slug/parties/:partyId/remove",
  requireHost,
  handler("remove"),
);
