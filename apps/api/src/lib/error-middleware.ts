import type { ErrorRequestHandler, RequestHandler } from "express";

import { logger } from "./logger.js";

/**
 * Canonical error envelope, matching
 * `@pila/shared/infra/http/error-response.ts`.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not_found" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err), path: req.path },
    "request.failed",
  );
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(500).json({ error: "internal" });
};
