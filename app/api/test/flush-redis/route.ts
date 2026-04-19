import { redis } from "@/lib/redis/client";
import { requireTestEnv } from "@/lib/test-api/guard";

export async function POST() {
  const guard = requireTestEnv();
  if (guard) return guard;

  await redis().flushall();
  return Response.json({ ok: true });
}
