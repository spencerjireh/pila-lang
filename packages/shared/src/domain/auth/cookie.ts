/**
 * Canonical Set-Cookie helpers used by host and guest session modules.
 * All pila cookies share the same attributes (HttpOnly, Secure, SameSite=Lax,
 * Path=/); only name and TTL vary.
 */

export interface CookieAttrs {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function cookieAttrs(maxAgeSeconds: number): CookieAttrs {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function serializeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return [
    `${name}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", 0);
}
