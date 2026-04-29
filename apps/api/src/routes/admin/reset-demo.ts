import { Router } from "express";

import { resetDemoFixture } from "@pila/shared/domain/admin/demo-fixture";
import {
  channelForTenantQueue,
  publish,
} from "@pila/shared/infra/redis/pubsub";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireAdmin } from "../../middleware/require-admin.js";

export const adminResetDemoRouter = Router();

adminResetDemoRouter.post(
  "/admin/tenants/:id/reset-demo",
  requireAdmin,
  async (req, res) => {
    const limited = await enforceRateLimits(res, [
      { bucket: "adminMutationPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    const id = param(req, "id");
    if (!id) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const result = await resetDemoFixture(id);
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 403;
      res.status(status).json({ error: result.reason });
      return;
    }

    await publish(channelForTenantQueue(result.slug), { type: "tenant:reset" });
    req.log.info(
      { tenantId: id, slug: result.slug },
      "admin.tenant.demo_reset",
    );
    res.json({ ok: true });
  },
);
