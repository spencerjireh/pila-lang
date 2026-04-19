import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  unauthorizedJson,
} from "@/lib/auth/host-guard";
import {
  GUEST_HISTORY_DEFAULT_LIMIT,
  GUEST_HISTORY_MAX_LIMIT,
  decodeCursor,
  loadGuestHistory,
} from "@/lib/parties/guest-history";
import { log } from "@/lib/log/logger";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(
      guard.status,
      guard.clearCookie,
      guardError(guard.status),
    );
  }

  const url = new URL(req.url);
  const cursorParam = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const cursor = decodeCursor(cursorParam);
  const limit = limitParam
    ? Math.min(Math.max(Number(limitParam) || 0, 1), GUEST_HISTORY_MAX_LIMIT)
    : GUEST_HISTORY_DEFAULT_LIMIT;

  try {
    const page = await loadGuestHistory(guard.tenant.id, { cursor, limit });
    return applyHostRefresh(Response.json(page, { status: 200 }), guard);
  } catch (err) {
    log.error("host.guests.failed", { slug: params.slug, err: String(err) });
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}
