import { Router } from "express";
import { z } from "zod";

import {
  HOST_COOKIE_NAME,
  serializeHostCookie,
} from "@pila/shared/domain/auth/host-session";
import { signHostToken } from "@pila/shared/domain/auth/host-token";
import { verifyPassword } from "@pila/shared/domain/auth/password";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const hostLoginRouter = Router();

const Body = z.object({ password: z.string().min(1).max(200) });

hostLoginRouter.post(
  "/host/:slug/login",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "loginPerIp", key: req.ip ?? "unknown" },
      { bucket: "loginPerSlug", key: slug },
    ]);
    if (limited) return;

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }

    const lookup = await loadTenantBySlug(slug);
    if (!lookup.ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const tenant = lookup.tenant;

    const match = await verifyPassword(
      parsed.data.password,
      tenant.hostPasswordHash,
    );
    if (!match) {
      log.info("host.login.rejected", { slug: tenant.slug });
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const token = await signHostToken({
      slug: tenant.slug,
      pwv: tenant.hostPasswordVersion,
    });
    res.setHeader("Set-Cookie", serializeHostCookie(token));
    log.info("host.login.ok", { slug: tenant.slug });
    res.json({ ok: true });

    // Reference HOST_COOKIE_NAME so a stale name doesn't sneak past tree-shake.
    void HOST_COOKIE_NAME;
  }),
);
