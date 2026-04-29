import { Router } from "express";

import { leaveQueue } from "@pila/shared/domain/parties/leave";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireGuest } from "../../middleware/require-guest.js";

export const rLeaveRouter = Router();

rLeaveRouter.post(
  "/r/:slug/parties/:partyId/leave",
  requireGuest("action"),
  asyncHandler(async (req, res) => {
    const guard = req.guest!;
    const slug = guard.tenant.slug;
    const partyId = guard.party.id;

    let result;
    try {
      result = await leaveQueue(guard.tenant.id, slug, partyId);
    } catch (err) {
      log.error("leave.failed", { slug, partyId, err: String(err) });
      res.status(500).json({ error: "internal" });
      return;
    }

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    log.info("party.left", { slug, partyId });
    res.json({ ok: true, resolvedAt: result.resolvedAt });
  }),
);
