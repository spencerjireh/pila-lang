import type { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { setTenantOpen } from "@pila/shared/domain/host/settings-actions";
import { log } from "@pila/shared/infra/log/logger";

export function hostOpenCloseHandler(isOpen: boolean) {
  return async (req: NextRequest, { params }: { params: { slug: string } }) => {
    const guard = await guardHostRequest(req, params.slug);
    if (!guard.ok) return hostGuardErrorResponse(guard);

    const result = await setTenantOpen(
      guard.tenant.id,
      guard.tenant.slug,
      isOpen,
    );
    if (!result) return errorResponse(404, "not_found");

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
