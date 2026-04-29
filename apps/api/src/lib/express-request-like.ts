import type { Request as ExpressRequest } from "express";

import type { RequestLikeWithJson } from "@pila/shared/primitives/http/request-like";

/**
 * Adapt an Express request (cookie-parser-shaped `req.cookies`, plain
 * `req.headers`) to the runtime-agnostic RequestLike interface consumed by
 * `@pila/shared/domain/auth/*` guards and `parse-json-body`.
 *
 * `json()` resolves the already-parsed body from `express.json()` middleware
 * — for handlers that need JSON parsing the route must mount `express.json()`
 * (or the global parser) first.
 */
export function expressToRequestLike(req: ExpressRequest): RequestLikeWithJson {
  return {
    cookies: {
      get(name: string) {
        const value = (req.cookies as Record<string, string> | undefined)?.[
          name
        ];
        return value !== undefined ? { value } : undefined;
      },
    },
    headers: {
      get(name: string) {
        const v = req.headers[name.toLowerCase()];
        if (v === undefined) return null;
        return Array.isArray(v) ? (v[0] ?? null) : v;
      },
    },
    json() {
      return Promise.resolve(req.body);
    },
  };
}
