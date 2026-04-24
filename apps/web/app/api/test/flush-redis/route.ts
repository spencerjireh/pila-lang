import { redis } from "@pila/shared/infra/redis/client";
import { requireTestEnv } from "@pila/shared/primitives/test-api/guard";

export async function POST() {
  const guard = requireTestEnv();
  if (guard) return guard;

  await redis().flushall();
  return Response.json({ ok: true });
}
