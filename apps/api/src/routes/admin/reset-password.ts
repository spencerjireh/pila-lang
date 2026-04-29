import { Router } from "express";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/domain/auth/password";

import { param } from "../../lib/params.js";
import { requireAdmin } from "../../middleware/require-admin.js";

export const adminResetPasswordRouter = Router();

adminResetPasswordRouter.post(
  "/admin/tenants/:id/reset-password",
  requireAdmin,
  async (req, res) => {
    const id = param(req, "id");
    if (!id) {
      res.status(404).json({ error: "not_found" });
      return;
    }
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

    req.log.info(
      {
        tenantId: id,
        version: row.hostPasswordVersion,
      },
      "admin.tenant.password_reset",
    );
    res.json({ initialPassword });
  },
);
