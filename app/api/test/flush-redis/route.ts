import { redis } from "@pila/shared/redis/client";
import { requireTestEnv } from "@pila/shared/test-api/guard";

export async function POST() {
  const guard = requireTestEnv();
  if (guard) return guard;

  await redis().flushall();
  return Response.json({ ok: true });
}
