import { Router } from "express";

import {
  GUEST_HISTORY_DEFAULT_LIMIT,
  GUEST_HISTORY_MAX_LIMIT,
  decodeCursor,
  loadGuestHistory,
} from "@pila/shared/domain/parties/guest-history";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostGuestsRouter = Router();

hostGuestsRouter.get(
  "/host/:slug/guests",
  requireHost,
  asyncHandler(async (req, res) => {
    const guard = req.hostGuard!;
    const cursorParam =
      typeof req.query.cursor === "string" ? req.query.cursor : null;
    const limitParam =
      typeof req.query.limit === "string" ? req.query.limit : null;
    const cursor = decodeCursor(cursorParam);
    const limit = limitParam
      ? Math.min(Math.max(Number(limitParam) || 0, 1), GUEST_HISTORY_MAX_LIMIT)
      : GUEST_HISTORY_DEFAULT_LIMIT;

    try {
      const page = await loadGuestHistory(guard.tenant.id, { cursor, limit });
      res.json(page);
    } catch (err) {
      log.error("host.guests.failed", {
        slug: guard.tenant.slug,
        err: String(err),
      });
      res.status(500).json({ error: "internal" });
    }
  }),
);
