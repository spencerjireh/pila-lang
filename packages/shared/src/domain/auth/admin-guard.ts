import type { RequestLike } from "../../primitives/http/request-like";
import { isAdminEmail } from "../../primitives/validators/admin-allow-list";

import { ADMIN_COOKIE_NAME, verifyAdminSession } from "./admin-jwt-cookie";

export interface AdminSession {
  userId: string;
  email: string;
}

export type RequireAdminApiResult =
  | { ok: true; admin: AdminSession }
  | { ok: false; status: 401 | 403 };

/**
 * Runtime-agnostic admin guard for API contexts (Express handlers, route
 * handlers, anywhere a RequestLike is available). Checks the JWT cookie
 * and re-validates the email against the allow list (defence in depth —
 * the allow list could have shrunk since issuance).
 */
export async function requireAdminApi(
  req: RequestLike,
): Promise<RequireAdminApiResult> {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const result = await verifyAdminSession(cookie);
  if (!result.ok) return { ok: false, status: 401 };
  if (!isAdminEmail(result.claims.email)) return { ok: false, status: 403 };
  return {
    ok: true,
    admin: { userId: result.claims.sub, email: result.claims.email },
  };
}

/**
 * Lower-level helper for places that have already pulled the cookie value
 * out (e.g. Next.js Server Components using `cookies().get()`).
 */
export async function requireAdminFromCookie(
  cookieValue: string | null | undefined,
): Promise<RequireAdminApiResult> {
  const result = await verifyAdminSession(cookieValue);
  if (!result.ok) return { ok: false, status: 401 };
  if (!isAdminEmail(result.claims.email)) return { ok: false, status: 403 };
  return {
    ok: true,
    admin: { userId: result.claims.sub, email: result.claims.email },
  };
}
