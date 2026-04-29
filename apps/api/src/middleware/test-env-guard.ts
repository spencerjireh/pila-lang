import type { NextFunction, Request, Response } from "express";

/**
 * Mounted in front of the /api/v1/test/* routes. NEVER allow the test
 * harness to be reachable in production — this is the same gate as the
 * old apps/web/app/api/test/* routes.
 */
export function testEnvGuard(req: Request, res: Response, next: NextFunction) {
  const enabled =
    process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "1";
  if (!enabled) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
}
