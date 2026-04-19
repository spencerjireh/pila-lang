import { NextRequest } from "next/server";

import { guardHostRequest, unauthorizedJson } from "@/lib/auth/host-guard";
import { setTenantOpen } from "@/lib/host/settings-actions";
import { log } from "@/lib/log/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(guard.status, guard.clearCookie, guardError(guard.status));
  }

  const result = await setTenantOpen(guard.tenant.id, guard.tenant.slug, true);
  if (!result) return Response.json({ error: "not_found" }, { status: 404 });

  log.info("host.tenant.opened", { slug: params.slug, changed: result.changed });
  return withRefresh(
    Response.json({ isOpen: result.isOpen }, { status: 200 }),
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
