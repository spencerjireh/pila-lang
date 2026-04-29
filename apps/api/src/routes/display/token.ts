import { Router } from "express";

import { resolveDisplayToken } from "@pila/shared/domain/tenants/display-token";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const displayTokenRouter = Router();

displayTokenRouter.get(
  "/display/:slug/token",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "displayRequestsPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    try {
      const result = await resolveDisplayToken(slug);
      if (!result.ok) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(result.payload);
    } catch (err) {
      log.error("display.token.failed", { slug, err: String(err) });
      res.status(500).json({ error: "internal" });
    }
  }),
);
