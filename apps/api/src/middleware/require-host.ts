import type { NextFunction, Request, Response } from "express";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
  type HostGuardOk,
} from "@pila/shared/domain/auth/host-guard";
import { clearHostCookieHeader } from "@pila/shared/domain/auth/host-session";

import { asyncHandler } from "../lib/async-handler.js";
import { expressToRequestLike } from "../lib/express-request-like.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Express's built-in `req.host` is the read-only Host header — pick
      // a distinct name so the guard payload doesn't collide.
      hostGuard?: HostGuardOk;
    }
  }
}

/**
 * Express middleware: verify the host JWT (cookie or bearer) for a `:slug`
 * route. On success, attaches `req.hostGuard` and writes refresh headers
 * (Set-Cookie for cookie auth, X-Refreshed-Token for bearer) onto `res`.
 */
export const requireHost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const guard = await guardHostRequest(expressToRequestLike(req), slug);
    if (!guard.ok) {
      if (guard.clearCookie) {
        res.setHeader("Set-Cookie", clearHostCookieHeader());
      }
      const error =
        guard.status === 401
          ? "unauthorized"
          : guard.status === 403
            ? "forbidden"
            : "not_found";
      res.status(guard.status).json({ error });
      return;
    }

    if (guard.refreshedCookie) {
      res.setHeader("Set-Cookie", guard.refreshedCookie);
    }
    if (guard.refreshedBearer) {
      res.setHeader(HOST_REFRESH_HEADER, guard.refreshedBearer);
    }

    req.hostGuard = guard;
    next();
  },
);
