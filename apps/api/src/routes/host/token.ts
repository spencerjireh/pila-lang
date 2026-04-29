import { Router } from "express";
import { z } from "zod";

import {
  HOST_TOKEN_TTL_SECONDS,
  signHostToken,
} from "@pila/shared/domain/auth/host-token";
import { verifyPassword } from "@pila/shared/domain/auth/password";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const hostTokenRouter = Router();

const Body = z.object({
  slug: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

hostTokenRouter.post(
  "/host/token",
  asyncHandler(async (req, res) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "hostTokenPerIp", key: req.ip ?? "unknown" },
      { bucket: "hostTokenPerSlug", key: parsed.data.slug },
    ]);
    if (limited) return;

    const lookup = await loadTenantBySlug(parsed.data.slug);
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
      log.info("host.token.rejected", { slug: tenant.slug });
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const token = await signHostToken({
      slug: tenant.slug,
      pwv: tenant.hostPasswordVersion,
    });

    log.info("host.token.issued", { slug: tenant.slug });
    res.json({
      token,
      tokenType: "Bearer",
      expiresIn: HOST_TOKEN_TTL_SECONDS,
      slug: tenant.slug,
    });
  }),
);
