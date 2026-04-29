import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { parties, tenants } from "@pila/db/schema";
import { hashPassword } from "@pila/shared/domain/auth/password";

export const testSetupTenantRouter = Router();

const Body = z.object({
  slug: z.string().min(1),
  name: z.string().optional(),
  accentColor: z.string().optional(),
  timezone: z.string().optional(),
  isOpen: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  password: z.string().min(4).optional(),
  waitingParties: z
    .array(
      z.object({
        name: z.string(),
        partySize: z.number().int().min(1).max(20),
        phone: z.string().optional(),
        minutesAgo: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
});

testSetupTenantRouter.post("/test/setup-tenant", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_body", issues: parsed.error.flatten() });
    return;
  }

  const {
    slug,
    name = `Test ${parsed.data.slug}`,
    accentColor = "#1F6FEB",
    timezone = "Asia/Kolkata",
    isOpen = true,
    isDemo = false,
    password = "e2e-test-pw-1234",
    waitingParties = [],
  } = parsed.data;

  const db = getDb();
  const hash = await hashPassword(password);

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  let tenantId: string;
  if (existing[0]) {
    tenantId = existing[0].id;
    await db.delete(parties).where(eq(parties.tenantId, tenantId));
    await db
      .update(tenants)
      .set({
        name,
        accentColor,
        timezone,
        isOpen,
        isDemo,
        hostPasswordHash: hash,
      })
      .where(eq(tenants.id, tenantId));
  } else {
    const [row] = await db
      .insert(tenants)
      .values({
        slug,
        name,
        accentColor,
        timezone,
        isOpen,
        isDemo,
        hostPasswordHash: hash,
      })
      .returning({ id: tenants.id });
    tenantId = row!.id;
  }

  let partyIds: string[] = [];
  if (waitingParties.length > 0) {
    const now = Date.now();
    const inserted = await db
      .insert(parties)
      .values(
        waitingParties.map((p) => ({
          tenantId,
          name: p.name,
          phone: p.phone ?? null,
          partySize: p.partySize,
          status: "waiting" as const,
          sessionToken: crypto.randomUUID(),
          joinedAt: new Date(now - (p.minutesAgo ?? 0) * 60_000),
        })),
      )
      .returning({ id: parties.id });
    partyIds = inserted.map((r) => r.id);
  }

  res.json({ id: tenantId, slug, password, partyIds });
});
