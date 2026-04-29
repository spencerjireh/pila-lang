import { Router, type Request, type Response } from "express";

import { setTenantOpen } from "@pila/shared/domain/host/settings-actions";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostOpenCloseRouter = Router();

function handler(isOpen: boolean) {
  return async (req: Request, res: Response) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;

    const limited = await enforceRateLimits(res, [
      { bucket: "hostMutationPerSlug", key: slug },
    ]);
    if (limited) return;

    const result = await setTenantOpen(guard.tenant.id, slug, isOpen);
    if (!result) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    req.log.info(
      {
        slug,
        changed: result.changed,
      },
      isOpen ? "host.tenant.opened" : "host.tenant.closed",
    );
    res.json({ isOpen: result.isOpen });
  };
}

hostOpenCloseRouter.post("/host/:slug/open", requireHost, handler(true));
hostOpenCloseRouter.post("/host/:slug/close", requireHost, handler(false));
