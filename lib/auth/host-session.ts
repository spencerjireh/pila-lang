import { HOST_TOKEN_TTL_SECONDS } from "./host-token";

export const HOST_COOKIE_NAME = "host_session";

export interface HostCookieAttrs {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function hostCookieAttrs(maxAgeSeconds: number = HOST_TOKEN_TTL_SECONDS): HostCookieAttrs {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function serializeHostCookie(value: string, maxAgeSeconds: number = HOST_TOKEN_TTL_SECONDS): string {
  return [
    `${HOST_COOKIE_NAME}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearHostCookieHeader(): string {
  return [
    `${HOST_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}
