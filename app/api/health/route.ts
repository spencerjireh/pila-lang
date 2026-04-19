import { sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { redis } from "@pila/shared/redis/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);
    const pong = await redis().ping();
    if (pong !== "PONG") throw new Error("redis unhealthy");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
