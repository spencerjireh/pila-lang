import { NextRequest } from "next/server";

import {
  applyGuestRefresh,
  guardGuestRequest,
  statusForGuestFailure,
} from "@/lib/auth/guest-guard";
import { log } from "@/lib/log/logger";
import { leaveQueue } from "@/lib/parties/leave";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const guard = await guardGuestRequest(req, params.slug, params.partyId);
  if (!guard.ok) {
    const status = statusForGuestFailure(guard.reason, "action");
    return Response.json({ error: guard.reason }, { status });
  }

  const { tenant, party } = guard;
  if (party.status !== "waiting") {
    return Response.json({ error: "conflict" }, { status: 409 });
  }

  let result;
  try {
    result = await leaveQueue(tenant.id, tenant.slug, params.partyId);
  } catch (err) {
    log.error("leave.failed", {
      slug: params.slug,
      partyId: params.partyId,
      err: String(err),
    });
    return Response.json({ error: "internal" }, { status: 500 });
  }

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return Response.json({ error: result.reason }, { status });
  }

  log.info("party.left", { slug: params.slug, partyId: params.partyId });
  return applyGuestRefresh(
    Response.json({ ok: true, resolvedAt: result.resolvedAt }),
    guard,
  );
}
