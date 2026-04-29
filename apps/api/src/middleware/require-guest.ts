import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
  GUEST_REFRESH_HEADER,
  guardGuestRequest,
  statusForGuestFailure,
  type GuestGuardOk,
} from "@pila/shared/domain/auth/guest-guard";

import { expressToRequestLike } from "../lib/express-request-like.js";
import { param } from "../lib/params.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      guest?: GuestGuardOk;
    }
  }
}

/**
 * Express middleware: verify the guest session (cookie or bearer) for a
 * `:slug/:partyId` route. Accepts a `mode` so the failure → status mapping
 * matches the original Web-Streams behaviour (stream returns 204 on
 * party_not_found, action returns 404).
 */
export function requireGuest(
  mode: "stream" | "action" = "action",
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const slug = param(req, "slug");
    const partyId = param(req, "partyId");
    if (!slug || !partyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const guard = await guardGuestRequest(
      expressToRequestLike(req),
      slug,
      partyId,
    );
    if (!guard.ok) {
      const status = statusForGuestFailure(guard.reason, mode);
      res.status(status).json({ error: guard.reason });
      return;
    }

    if (guard.refreshedBearer) {
      res.setHeader(GUEST_REFRESH_HEADER, guard.refreshedBearer);
    }

    req.guest = guard;
    next();
  };
}
