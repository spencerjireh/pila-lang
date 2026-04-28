import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { hashPassword } from "@pila/shared/domain/auth/password";
import { getDb } from "@pila/db/client";
import { parties, tenants } from "@pila/db/schema";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

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

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

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
          sessionToken: randomUUID(),
          joinedAt: new Date(now - (p.minutesAgo ?? 0) * 60_000),
        })),
      )
      .returning({ id: parties.id });
    partyIds = inserted.map((r) => r.id);
  }

  return Response.json({ id: tenantId, slug, password, partyIds });
}
