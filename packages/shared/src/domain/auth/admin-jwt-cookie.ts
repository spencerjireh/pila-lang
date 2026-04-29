import {
  clearCookie,
  cookieAttrs,
  serializeCookie,
  type CookieAttrs,
} from "./cookie";
import {
  ADMIN_TOKEN_TTL_SECONDS,
  signAdminToken,
  verifyAdminToken,
  type AdminClaims,
} from "./admin-token";

/**
 * Admin session cookie. Distinct name from NextAuth's `__Secure-authjs.session-token`
 * so both can briefly coexist during the cutover (NextAuth still wired in
 * apps/web until Sprint 4) without colliding.
 */
export const ADMIN_COOKIE_NAME = "admin_session";

export type AdminCookieAttrs = CookieAttrs;

export function adminCookieAttrs(
  maxAgeSeconds: number = ADMIN_TOKEN_TTL_SECONDS,
): AdminCookieAttrs {
  return cookieAttrs(maxAgeSeconds);
}

export function serializeAdminCookie(
  value: string,
  maxAgeSeconds: number = ADMIN_TOKEN_TTL_SECONDS,
): string {
  return serializeCookie(ADMIN_COOKIE_NAME, value, maxAgeSeconds);
}

export function clearAdminCookieHeader(): string {
  return clearCookie(ADMIN_COOKIE_NAME);
}

export async function issueAdminSession(
  sub: string,
  email: string,
): Promise<string> {
  return signAdminToken({ sub, email });
}

export type AdminSessionVerifyResult =
  | { ok: true; claims: AdminClaims }
  | { ok: false; reason: "missing" | "invalid" | "expired" };

export async function verifyAdminSession(
  cookieValue: string | null | undefined,
): Promise<AdminSessionVerifyResult> {
  if (!cookieValue) return { ok: false, reason: "missing" };
  const result = await verifyAdminToken(cookieValue);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, claims: result.claims };
}
