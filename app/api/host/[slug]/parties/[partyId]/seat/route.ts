import { NextRequest } from "next/server";

import { guardHostRequest, unauthorizedJson } from "@/lib/auth/host-guard";
import { log } from "@/lib/log/logger";
import { performHostAction } from "@/lib/parties/host-actions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(guard.status, guard.clearCookie, guardError(guard.status));
  }

  let result;
  try {
    result = await performHostAction(guard.tenant.id, guard.tenant.slug, params.partyId, "seat");
  } catch (err) {
    log.error("host.seat.failed", {
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

  log.info("host.party.seated", { slug: params.slug, partyId: params.partyId });
  return withRefresh(
    Response.json({ ok: true, resolvedAt: result.resolvedAt }, { status: 200 }),
    guard.refreshedCookie,
  );
}

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}

function withRefresh(res: Response, cookie: string | null): Response {
  if (!cookie) return res;
  res.headers.append("Set-Cookie", cookie);
  return res;
}
