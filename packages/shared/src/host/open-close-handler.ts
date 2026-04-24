import type { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "../auth/host-guard";
import { log } from "../log/logger";

import { setTenantOpen } from "./settings-actions";

export function hostOpenCloseHandler(isOpen: boolean) {
  return async (req: NextRequest, { params }: { params: { slug: string } }) => {
    const guard = await guardHostRequest(req, params.slug);
    if (!guard.ok) return hostGuardErrorResponse(guard);

    const result = await setTenantOpen(
      guard.tenant.id,
      guard.tenant.slug,
      isOpen,
    );
    if (!result) return Response.json({ error: "not_found" }, { status: 404 });

    log.info(isOpen ? "host.tenant.opened" : "host.tenant.closed", {
      slug: params.slug,
      changed: result.changed,
    });
    return applyHostRefresh(
      Response.json({ isOpen: result.isOpen }, { status: 200 }),
      guard,
    );
  };
}
