import { Router } from "express";

import { HOST_REFRESH_HEADER } from "@pila/shared/domain/auth/host-guard";
import { serializeHostCookie } from "@pila/shared/domain/auth/host-session";
import { signHostToken } from "@pila/shared/domain/auth/host-token";
import { hashPassword } from "@pila/shared/domain/auth/password";
import { rotateHostPassword } from "@pila/shared/domain/host/settings-actions";
import { passwordChangeSchema } from "@pila/shared/primitives/validators/password";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostSettingsPasswordRouter = Router();

hostSettingsPasswordRouter.post(
  "/host/:slug/settings/password",
  requireHost,
  async (req, res) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;

    const limited = await enforceRateLimits(res, [
      { bucket: "hostPasswordRotatePerSlug", key: slug },
    ]);
    if (limited) return;

    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }

    let newHash: string | undefined;
    if (parsed.data.action === "rotate") {
      newHash = await hashPassword(parsed.data.newPassword);
    }

    const result = await rotateHostPassword(guard.tenant.id, { newHash });
    if (!result) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const token = await signHostToken({
      slug,
      pwv: result.newVersion,
      jti: guard.claims.jti,
    });

    if (guard.source === "cookie") {
      res.setHeader("Set-Cookie", serializeHostCookie(token));
    } else {
      res.setHeader(HOST_REFRESH_HEADER, token);
    }

    req.log.info(
      {
        slug,
        action: parsed.data.action,
        newVersion: result.newVersion,
      },
      "host.settings.password.rotated",
    );
    res.json({ ok: true, version: result.newVersion });
  },
);
