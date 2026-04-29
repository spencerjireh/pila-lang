import type { ErrorRequestHandler, RequestHandler } from "express";

import { logger } from "./logger.js";

/**
 * Canonical error envelope, matching
 * `@pila/shared/infra/http/error-response.ts`.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not_found" });
};

function requestId(req: { id?: string | number }): string | undefined {
  return req.id !== undefined ? String(req.id) : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(
    {
      err: err instanceof Error ? err.message : String(err),
      path: req.path,
      reqId: (req as { id?: string | number }).id,
    },
    "request.failed",
  );
  if (res.headersSent) {
    res.end();
    return;
  }
  // Include requestId so users reporting a 500 can quote a token that maps
  // back to a specific log line. pino-http attaches the id to req.
  res
    .status(500)
    .json({ error: "internal", requestId: requestId(req as { id?: string }) });
};
