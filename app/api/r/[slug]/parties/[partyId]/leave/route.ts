import { NextRequest } from "next/server";

import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-session";
import { log } from "@/lib/log/logger";
import { leaveQueue } from "@/lib/parties/leave";
import { findPartyById } from "@/lib/parties/lookup";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (!cookie) return Response.json({ error: "unauthorized" }, { status: 401 });

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) return Response.json({ error: "not_found" }, { status: 404 });
  const tenant = lookup.tenant;

  const party = await findPartyById(tenant.id, params.partyId);
  if (!party) return Response.json({ error: "not_found" }, { status: 404 });
  if (party.tenantId !== tenant.id || party.sessionToken !== cookie) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
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
  return Response.json({ ok: true, resolvedAt: result.resolvedAt });
}
