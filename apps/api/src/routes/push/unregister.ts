import { Router } from "express";
import { z } from "zod";

import { authorizePushBearer } from "@pila/shared/domain/push/auth";
import { unregisterPushToken } from "@pila/shared/domain/push/registry";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const pushUnregisterRouter = Router();

const Body = z.object({
  deviceToken: z.string().min(8).max(4096),
});

pushUnregisterRouter.post(
  "/push/unregister",
  asyncHandler(async (req, res) => {
    const limited = await enforceRateLimits(res, [
      { bucket: "pushRegisterPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

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

    const result = await unregisterPushToken({
      scopeId: auth.scopeId,
      deviceToken: parsed.data.deviceToken,
    });

    log.info("push.token.unregistered", {
      slug: auth.slug,
      scope: auth.kind,
      revoked: result.revoked,
    });
    res.json(result);
  }),
);
