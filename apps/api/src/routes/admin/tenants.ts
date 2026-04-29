import { Router } from "express";
import { desc } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { createTenantSchema } from "@pila/shared/domain/admin/tenant-schema";
import {
  generateInitialPassword,
  hashPassword,
} from "@pila/shared/domain/auth/password";
import { isValidTimezone } from "@pila/shared/primitives/timezones";
import { validateSlug } from "@pila/shared/primitives/validators/slug";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireAdmin } from "../../middleware/require-admin.js";

import { TENANT_COLUMNS } from "./_columns.js";

export const adminTenantsRouter = Router();

adminTenantsRouter.get("/admin/tenants", requireAdmin, async (req, res) => {
  const limited = await enforceRateLimits(res, [
    { bucket: "adminReadPerIp", key: req.ip ?? "unknown" },
  ]);
  if (limited) return;

  const rows = await getDb()
    .select(TENANT_COLUMNS)
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
  res.json({ tenants: rows });
});

adminTenantsRouter.post("/admin/tenants", requireAdmin, async (req, res) => {
  const limited = await enforceRateLimits(res, [
    { bucket: "adminMutationPerIp", key: req.ip ?? "unknown" },
  ]);
  if (limited) return;

  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.flatten(),
    });
    return;
  }
  const { name, slug, timezone } = parsed.data;

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) {
    res.status(400).json({ error: "invalid_slug", reason: slugCheck.reason });
    return;
  }
  if (!isValidTimezone(timezone)) {
    res.status(400).json({ error: "invalid_timezone" });
    return;
  }

  const initialPassword = generateInitialPassword();
  const hostPasswordHash = await hashPassword(initialPassword);

  try {
    const [row] = await getDb()
      .insert(tenants)
      .values({ name, slug, hostPasswordHash, timezone })
      .returning(TENANT_COLUMNS);
    req.log.info({ tenantId: row!.id, slug }, "admin.tenant.created");
    res.status(201).json({ tenant: row, initialPassword });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "slug_taken" });
      return;
    }
    req.log.error({ err: String(err) }, "admin.tenant.create.failed");
    res.status(500).json({ error: "internal" });
  }
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
