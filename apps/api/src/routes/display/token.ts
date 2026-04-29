import { Router } from "express";

import { resolveDisplayToken } from "@pila/shared/domain/tenants/display-token";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const displayTokenRouter = Router();

displayTokenRouter.get("/display/:slug/token", async (req, res) => {
  const slug = param(req, "slug");
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
    req.log.error({ slug, err: String(err) }, "display.token.failed");
    res.status(500).json({ error: "internal" });
  }
});
