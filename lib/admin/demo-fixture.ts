import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { notifications, parties, tenants } from "@/lib/db/schema";

export const DEMO_WAITING = [
  { name: "Priya Sharma", partySize: 2, minutesAgo: 12 },
  { name: "Raj Patel", partySize: 4, minutesAgo: 5 },
  { name: "Anya Lim", partySize: 2, minutesAgo: 1 },
] as const;

export const DEMO_HISTORICAL = [
  {
    name: "Vikram Singh",
    partySize: 3,
    daysAgo: 14,
    waitMinutes: 5,
    phone: null,
  },
  {
    name: "Meera Devi",
    partySize: 2,
    daysAgo: 13,
    waitMinutes: 10,
    phone: null,
  },
  {
    name: "Arjun Kumar",
    partySize: 5,
    daysAgo: 12,
    waitMinutes: 20,
    phone: null,
  },
  {
    name: "Sana Khan",
    partySize: 1,
    daysAgo: 10,
    waitMinutes: 15,
    phone: "+14155550101",
  },
  {
    name: "Rohan Gupta",
    partySize: 4,
    daysAgo: 8,
    waitMinutes: 30,
    phone: null,
  },
  {
    name: "Zara Ahmed",
    partySize: 2,
    daysAgo: 6,
    waitMinutes: 8,
    phone: "+14155550102",
  },
  {
    name: "Aditya Nair",
    partySize: 6,
    daysAgo: 4,
    waitMinutes: 40,
    phone: null,
  },
  {
    name: "Pooja Verma",
    partySize: 2,
    daysAgo: 3,
    waitMinutes: 12,
    phone: "+14155550103",
  },
  {
    name: "Deepak Reddy",
    partySize: 3,
    daysAgo: 2,
    waitMinutes: 18,
    phone: null,
  },
  {
    name: "Ayesha Malik",
    partySize: 4,
    daysAgo: 1,
    waitMinutes: 25,
    phone: null,
  },
] as const;

export type ResetDemoResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "not_found" | "not_demo" };

export async function resetDemoFixture(
  tenantId: string,
  now: Date = new Date(),
): Promise<ResetDemoResult> {
  return getDb().transaction(async (tx) => {
    const [tenant] = await tx
      .select({ slug: tenants.slug, isDemo: tenants.isDemo })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) return { ok: false, reason: "not_found" } as const;
    if (!tenant.isDemo) return { ok: false, reason: "not_demo" } as const;

    const partyIds = await tx
      .select({ id: parties.id })
      .from(parties)
      .where(eq(parties.tenantId, tenantId));
    if (partyIds.length > 0) {
      await tx.delete(notifications).where(
        inArray(
          notifications.partyId,
          partyIds.map((p) => p.id),
        ),
      );
    }
    await tx.delete(parties).where(eq(parties.tenantId, tenantId));

    const nowMs = now.getTime();
    const waitingRows = DEMO_WAITING.map((w) => ({
      tenantId,
      name: w.name,
      partySize: w.partySize,
      status: "waiting",
      sessionToken: randomUUID(),
      joinedAt: new Date(nowMs - w.minutesAgo * 60_000),
    }));

    const historicalRows = DEMO_HISTORICAL.map((h) => {
      const joinedAt = new Date(nowMs - h.daysAgo * 24 * 60 * 60_000);
      const seatedAt = new Date(joinedAt.getTime() + h.waitMinutes * 60_000);
      return {
        tenantId,
        name: h.name,
        phone: h.phone,
        partySize: h.partySize,
        status: "seated",
        sessionToken: randomUUID(),
        joinedAt,
        seatedAt,
        resolvedAt: seatedAt,
      };
    });

    await tx.insert(parties).values([...waitingRows, ...historicalRows]);

    return { ok: true, slug: tenant.slug } as const;
  });
}
