import type { Request as ExpressRequest } from "express";

/**
 * Adapt an Express request's `Authorization` header to a Web `Headers` object
 * — the shape `authorizePushBearer` (and other shared bearer-aware helpers)
 * expect. Centralized so the snake_case `auth_h` boilerplate doesn't sprawl.
 */
export function bearerHeaders(req: ExpressRequest): Headers {
  const h = new Headers();
  const v = req.headers.authorization;
  if (typeof v === "string") h.set("authorization", v);
  return h;
}
