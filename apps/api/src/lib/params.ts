import type { Request as ExpressRequest } from "express";

/**
 * Read a named path param from an Express request, normalizing the awkward
 * `string | string[] | undefined` shape Express 5 introduced for repeating
 * optional params. Returns null when the param is missing or empty so callers
 * can do `if (!slug) res.status(404)...` consistently.
 */
export function param(req: ExpressRequest, name: string): string | null {
  const v = (req.params as Record<string, string | string[] | undefined>)[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}
