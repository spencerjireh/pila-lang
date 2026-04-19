import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db/client";
import { parties, tenants } from "@/lib/db/schema";
import { requireTestEnv } from "@/lib/test-api/guard";

const bodySchema = z.object({
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

export async function POST(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    slug,
    name = `Test ${slug}`,
    accentColor = "#1F6FEB",
    timezone = "Asia/Kolkata",
    isOpen = true,
    isDemo = false,
    password = "e2e-test-pw-1234",
    waitingParties = [],
  } = parsed.data;

  const db = getDb();
  const hash = await hashPassword(password);

  // Upsert: if slug exists, reset fully.
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

  if (waitingParties.length > 0) {
    const now = Date.now();
    await db.insert(parties).values(
      waitingParties.map((p) => ({
        tenantId,
        name: p.name,
        phone: p.phone ?? null,
        partySize: p.partySize,
        status: "waiting" as const,
        sessionToken: randomUUID(),
        joinedAt: new Date(now - (p.minutesAgo ?? 0) * 60_000),
      })),
    );
  }

  return Response.json({ id: tenantId, slug, password });
}
