import {
  clearCookie,
  cookieAttrs,
  serializeCookie,
  type CookieAttrs,
} from "./cookie";
import { HOST_TOKEN_TTL_SECONDS } from "./host-token";

export const HOST_COOKIE_NAME = "host_session";

export type HostCookieAttrs = CookieAttrs;

export function hostCookieAttrs(
  maxAgeSeconds: number = HOST_TOKEN_TTL_SECONDS,
): HostCookieAttrs {
  return cookieAttrs(maxAgeSeconds);
}

export function serializeHostCookie(
  value: string,
  maxAgeSeconds: number = HOST_TOKEN_TTL_SECONDS,
): string {
  return serializeCookie(HOST_COOKIE_NAME, value, maxAgeSeconds);
}

export function clearHostCookieHeader(): string {
  return clearCookie(HOST_COOKIE_NAME);
}
