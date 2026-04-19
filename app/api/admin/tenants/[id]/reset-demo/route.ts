import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin-guard";
import { resetDemoFixture } from "@/lib/admin/demo-fixture";
import { channelForTenantQueue, publish } from "@/lib/redis/pubsub";
import { log } from "@/lib/log/logger";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, ctx: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = ctx.params;

  const result = await resetDemoFixture(id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  await publish(channelForTenantQueue(result.slug), { type: "tenant:reset" });
  log.info("admin.tenant.demo_reset", { tenantId: id, slug: result.slug });
  return Response.json({ ok: true });
}
