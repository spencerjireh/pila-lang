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
  const a = cookieAttrs(maxAgeSeconds);
  const sameSite = a.sameSite[0]!.toUpperCase() + a.sameSite.slice(1);
  const parts = [`${name}=${value}`, `Max-Age=${a.maxAge}`, `Path=${a.path}`];
  if (a.httpOnly) parts.push("HttpOnly");
  if (a.secure) parts.push("Secure");
  parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", 0);
}
