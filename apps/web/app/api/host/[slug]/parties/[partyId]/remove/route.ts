import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/auth/host-guard";
import { log } from "@pila/shared/log/logger";
import { performHostAction } from "@pila/shared/parties/host-actions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);

  let result;
  try {
    result = await performHostAction(
      guard.tenant.id,
      guard.tenant.slug,
      params.partyId,
      "remove",
    );
  } catch (err) {
    log.error("host.remove.failed", {
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

  log.info("host.party.removed", {
    slug: params.slug,
    partyId: params.partyId,
  });
  return applyHostRefresh(
    Response.json({ ok: true, resolvedAt: result.resolvedAt }, { status: 200 }),
    guard,
  );
}
