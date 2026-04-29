import type { NextFunction, Request, Response } from "express";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@pila/shared/domain/auth/admin-jwt-cookie";
import { isAdminEmail } from "@pila/shared/primitives/validators/admin-allow-list";

import { asyncHandler } from "../lib/async-handler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: { userId: string; email: string };
    }
  }
}

export const requireAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const token = cookies[ADMIN_COOKIE_NAME];
    const result = await verifyAdminSession(token);

    if (!result.ok) {
      res.status(401).json({ error: "unauthorized", reason: result.reason });
      return;
    }
    if (!isAdminEmail(result.claims.email)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    req.admin = { userId: result.claims.sub, email: result.claims.email };
    next();
  },
);
