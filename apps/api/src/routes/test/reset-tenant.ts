import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";

export const testResetTenantRouter = Router();

const Body = z.object({ slug: z.string().min(1) });

testResetTenantRouter.post("/test/reset-tenant", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_body", issues: parsed.error.flatten() });
    return;
  }
  // Schema cascades parties + notifications via FK ON DELETE CASCADE.
  await getDb().delete(tenants).where(eq(tenants.slug, parsed.data.slug));
  res.json({ ok: true });
});
