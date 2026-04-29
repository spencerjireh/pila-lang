import { Router } from "express";
import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { hardDeleteTenant } from "@pila/shared/domain/admin/delete-tenant";
import { updateTenantSchema } from "@pila/shared/domain/admin/tenant-schema";
import {
  channelForParty,
  channelForTenantQueue,
  publish,
} from "@pila/shared/infra/redis/pubsub";
import { isValidTimezone } from "@pila/shared/primitives/timezones";
import { validateAccentColor } from "@pila/shared/primitives/validators/contrast";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireAdmin } from "../../middleware/require-admin.js";

import { TENANT_COLUMNS } from "./_columns.js";

export const adminTenantByIdRouter = Router();

adminTenantByIdRouter.get(
  "/admin/tenants/:id",
  requireAdmin,
  async (req, res) => {
    const limited = await enforceRateLimits(res, [
      { bucket: "adminReadPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    const id = param(req, "id");
    if (!id) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [row] = await getDb()
      .select(TENANT_COLUMNS)
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ tenant: row });
  },
);

adminTenantByIdRouter.patch(
  "/admin/tenants/:id",
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
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_body",
        issues: parsed.error.flatten(),
      });
      return;
    }
    const patch = parsed.data;

    if (patch.accentColor !== undefined) {
      const check = validateAccentColor(patch.accentColor);
      if (!check.ok) {
        res
          .status(422)
          .json({ error: "invalid_accent_color", reason: check.reason });
        return;
      }
    }
    if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) {
      res.status(400).json({ error: "invalid_timezone" });
      return;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "no_fields" });
      return;
    }

    const [existing] = await getDb()
      .select({ slug: tenants.slug, isOpen: tenants.isOpen })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const [row] = await getDb()
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning(TENANT_COLUMNS);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (patch.isOpen !== undefined && patch.isOpen !== existing.isOpen) {
      await publish(channelForTenantQueue(existing.slug), {
        type: patch.isOpen ? "tenant:opened" : "tenant:closed",
      });
    }

    req.log.info(
      {
        tenantId: id,
        fields: Object.keys(patch),
      },
      "admin.tenant.updated",
    );
    res.json({ tenant: row });
  },
);

adminTenantByIdRouter.delete(
  "/admin/tenants/:id",
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
    const result = await hardDeleteTenant(id);
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 500;
      res.status(status).json({ error: result.reason });
      return;
    }

    await publish(channelForTenantQueue(result.slug), {
      type: "tenant:closed",
    });
    const resolvedAt = new Date().toISOString();
    await Promise.all(
      result.affectedPartyIds.map((partyId) =>
        publish(channelForParty(partyId), {
          type: "status_changed",
          status: "no_show",
          resolvedAt,
        }),
      ),
    );

    req.log.info(
      {
        tenantId: id,
        slug: result.slug,
        affectedParties: result.affectedPartyIds.length,
      },
      "admin.tenant.deleted",
    );
    res.json({ ok: true });
  },
);
