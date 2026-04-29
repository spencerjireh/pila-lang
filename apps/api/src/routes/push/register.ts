import { Router } from "express";
import { z } from "zod";

import { authorizePushBearer } from "@pila/shared/domain/push/auth";
import { registerPushToken } from "@pila/shared/domain/push/registry";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const pushRegisterRouter = Router();

const Body = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().min(8).max(4096),
});

pushRegisterRouter.post(
  "/push/register",
  asyncHandler(async (req, res) => {
    const limited = await enforceRateLimits(res, [
      { bucket: "pushRegisterPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    // authorizePushBearer reads the standard `Authorization: Bearer …`
    // header from a Web Headers-like object; the Express headers object
    // exposes a structurally-compatible get().
    const headers = new Headers();
    const auth_h = req.headers.authorization;
    if (typeof auth_h === "string") headers.set("authorization", auth_h);
    const auth = await authorizePushBearer(headers);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }

    const row = await registerPushToken({
      tenantId: auth.tenantId,
      scope: auth.kind,
      scopeId: auth.scopeId,
      platform: parsed.data.platform,
      deviceToken: parsed.data.deviceToken,
    });

    log.info("push.token.registered", {
      slug: auth.slug,
      scope: auth.kind,
      platform: parsed.data.platform,
    });
    res.json({ id: row.id });
  }),
);
