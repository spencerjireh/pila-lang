import type { RequestLike } from "../../primitives/http/request-like";

import { parseBearer } from "./bearer";

export type AuthSource = "cookie" | "bearer" | null;

export interface AuthSourceResult {
  cookie: string | null;
  bearer: string | null;
  rawToken: string | null;
  source: AuthSource;
}

/**
 * Resolve the token on an incoming request, preferring the named cookie over
 * a bearer Authorization header. Neither presence nor validity of the token
 * is checked here — callers must verify.
 */
export function resolveAuthSource(
  req: RequestLike,
  cookieName: string,
): AuthSourceResult {
  const cookie = req.cookies.get(cookieName)?.value ?? null;
  const bearer = parseBearer(req.headers.get("authorization"));
  const source: AuthSource = cookie ? "cookie" : bearer ? "bearer" : null;
  return { cookie, bearer, rawToken: cookie ?? bearer, source };
}
