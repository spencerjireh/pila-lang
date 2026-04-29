import { Router } from "express";
import { z } from "zod";

import { authorizePushBearer } from "@pila/shared/domain/push/auth";
import { registerPushToken } from "@pila/shared/domain/push/registry";

import { bearerHeaders } from "../../lib/express-bearer.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const pushRegisterRouter = Router();

const Body = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().min(8).max(4096),
});

pushRegisterRouter.post("/push/register", async (req, res) => {
  const limited = await enforceRateLimits(res, [
    { bucket: "pushRegisterPerIp", key: req.ip ?? "unknown" },
  ]);
  if (limited) return;

  const auth = await authorizePushBearer(bearerHeaders(req));
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

  req.log.info(
    {
      slug: auth.slug,
      scope: auth.kind,
      platform: parsed.data.platform,
    },
    "push.token.registered",
  );
  res.json({ id: row.id });
});
