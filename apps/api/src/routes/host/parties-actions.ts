import { Router, type Request, type Response } from "express";

import { performHostAction } from "@pila/shared/domain/parties/host-actions";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostPartiesActionsRouter = Router();

const PAST_TENSE: Record<"seat" | "remove", "seated" | "removed"> = {
  seat: "seated",
  remove: "removed",
};

function handler(action: "seat" | "remove") {
  return async (req: Request, res: Response) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;
    const partyId = param(req, "partyId");
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
      req.log.error(
        {
          slug,
          partyId,
          err: String(err),
        },
        `host.${action}.failed`,
      );
      res.status(500).json({ error: "internal" });
      return;
    }

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    req.log.info({ slug, partyId }, `host.party.${PAST_TENSE[action]}`);
    res.json({ ok: true, resolvedAt: result.resolvedAt });
  };
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
