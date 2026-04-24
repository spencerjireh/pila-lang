import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { parties } from "@pila/db/schema";

export async function seedWaiters(
  tenantId: string,
  count: number,
): Promise<void> {
  const db = getDb();
  // Fresh: clear any waiting rows first so the waiter count is exact.
  await db
    .delete(parties)
    .where(
      sql`${parties.tenantId} = ${tenantId} AND ${parties.status} = 'waiting'`,
    );

  if (count === 0) return;
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, i) => {
    const minutesAgo = (count - i) * 5;
    return {
      tenantId,
      name: `Guest ${i + 1}`,
      partySize: (i % 4) + 2,
      status: "waiting" as const,
      sessionToken: randomUUID(),
      joinedAt: new Date(now - minutesAgo * 60_000),
    };
  });
  await db.insert(parties).values(rows);
}
