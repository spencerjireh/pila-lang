import { Router } from "express";

import { leaveQueue } from "@pila/shared/domain/parties/leave";

import { requireGuest } from "../../middleware/require-guest.js";

export const rLeaveRouter = Router();

rLeaveRouter.post(
  "/r/:slug/parties/:partyId/leave",
  requireGuest("action"),
  async (req, res) => {
    const guard = req.guest!;
    const slug = guard.tenant.slug;
    const partyId = guard.party.id;

    let result;
    try {
      result = await leaveQueue(guard.tenant.id, slug, partyId);
    } catch (err) {
      req.log.error({ slug, partyId, err: String(err) }, "leave.failed");
      res.status(500).json({ error: "internal" });
      return;
    }

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    req.log.info({ slug, partyId }, "party.left");
    res.json({ ok: true, resolvedAt: result.resolvedAt });
  },
);
