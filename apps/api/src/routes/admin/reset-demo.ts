import { Router } from "express";

import { resetDemoFixture } from "@pila/shared/domain/admin/demo-fixture";
import { log } from "@pila/shared/infra/log/logger";
import {
  channelForTenantQueue,
  publish,
} from "@pila/shared/infra/redis/pubsub";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/require-admin.js";

export const adminResetDemoRouter = Router();

adminResetDemoRouter.post(
  "/admin/tenants/:id/reset-demo",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? "");
    const result = await resetDemoFixture(id);
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 403;
      res.status(status).json({ error: result.reason });
      return;
    }

    await publish(channelForTenantQueue(result.slug), { type: "tenant:reset" });
    log.info("admin.tenant.demo_reset", { tenantId: id, slug: result.slug });
    res.json({ ok: true });
  }),
);
