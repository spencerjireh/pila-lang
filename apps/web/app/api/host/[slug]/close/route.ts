import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  unauthorizedJson,
} from "@pila/shared/auth/host-guard";
import { setTenantOpen } from "@pila/shared/host/settings-actions";
import { log } from "@pila/shared/log/logger";

export const dynamic = "force-dynamic";

export async function POST(
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

  const result = await setTenantOpen(guard.tenant.id, guard.tenant.slug, false);
  if (!result) return Response.json({ error: "not_found" }, { status: 404 });

  log.info("host.tenant.closed", {
    slug: params.slug,
    changed: result.changed,
  });
  return applyHostRefresh(
    Response.json({ isOpen: result.isOpen }, { status: 200 }),
    guard,
  );
}

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}
