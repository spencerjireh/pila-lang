import { Router } from "express";
import { z } from "zod";

import { serializeHostCookie } from "@pila/shared/domain/auth/host-session";
import { signHostToken } from "@pila/shared/domain/auth/host-token";
import { verifyPassword } from "@pila/shared/domain/auth/password";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const hostLoginRouter = Router();

const Body = z.object({ password: z.string().min(1).max(200) });

hostLoginRouter.post("/host/:slug/login", async (req, res) => {
  const slug = param(req, "slug");
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
    req.log.info({ slug: tenant.slug }, "host.login.rejected");
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const token = await signHostToken({
    slug: tenant.slug,
    pwv: tenant.hostPasswordVersion,
  });
  res.setHeader("Set-Cookie", serializeHostCookie(token));
  req.log.info({ slug: tenant.slug }, "host.login.ok");
  res.json({ ok: true });
});
