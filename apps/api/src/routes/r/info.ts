import { Router } from "express";

import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import { log } from "@pila/shared/infra/log/logger";
import { verifyQrToken } from "@pila/shared/primitives/qr/token";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const rInfoRouter = Router();

type TokenStatus = "ok" | "expired" | "invalid" | "missing" | "unchecked";

rInfoRouter.get(
  "/r/:slug/info",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "guestViewPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    let lookup;
    try {
      lookup = await loadTenantBySlug(slug);
    } catch (err) {
      log.error("r.info.lookup_failed", { slug, err: String(err) });
      res.status(500).json({ error: "internal" });
      return;
    }
    if (!lookup.ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const tenant = lookup.tenant;

    const rawToken =
      typeof req.query.t === "string"
        ? req.query.t
        : Array.isArray(req.query.t)
          ? null
          : req.query.t === undefined
            ? null
            : null;
    let tokenStatus: TokenStatus;
    if (rawToken === null) {
      tokenStatus = "unchecked";
    } else if (rawToken === "") {
      tokenStatus = "missing";
    } else {
      const verdict = verifyQrToken(tenant.slug, rawToken);
      if (verdict.ok) tokenStatus = "ok";
      else tokenStatus = verdict.reason === "expired" ? "expired" : "invalid";
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      accentColor: tenant.accentColor,
      isOpen: tenant.isOpen,
      tokenStatus,
    });
  }),
);
