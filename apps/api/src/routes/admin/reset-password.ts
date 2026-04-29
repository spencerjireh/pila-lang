import { Router } from "express";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/domain/auth/password";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/require-admin.js";

export const adminResetPasswordRouter = Router();

adminResetPasswordRouter.post(
  "/admin/tenants/:id/reset-password",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? "");
    const initialPassword = generateInitialPassword();
    const hostPasswordHash = await hashPassword(initialPassword);

    const [row] = await getDb()
      .update(tenants)
      .set({
        hostPasswordHash,
        hostPasswordVersion: sql`${tenants.hostPasswordVersion} + 1`,
      })
      .where(eq(tenants.id, id))
      .returning({
        id: tenants.id,
        slug: tenants.slug,
        hostPasswordVersion: tenants.hostPasswordVersion,
      });

    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    log.info("admin.tenant.password_reset", {
      tenantId: id,
      version: row.hostPasswordVersion,
    });
    res.json({ initialPassword });
  }),
);
