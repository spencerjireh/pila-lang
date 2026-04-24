import { randomUUID } from "node:crypto";

import {
  clearCookie,
  cookieAttrs,
  serializeCookie,
  type CookieAttrs,
} from "./cookie";

export const GUEST_COOKIE_NAME = "party_session";
export const GUEST_COOKIE_MAX_AGE = 24 * 60 * 60;

export type GuestCookieAttrs = CookieAttrs;

export function generateGuestSessionToken(): string {
  return randomUUID();
}

export function guestCookieAttrs(
  maxAgeSeconds: number = GUEST_COOKIE_MAX_AGE,
): GuestCookieAttrs {
  return cookieAttrs(maxAgeSeconds);
}

export function serializeGuestCookie(
  value: string,
  maxAgeSeconds: number = GUEST_COOKIE_MAX_AGE,
): string {
  return serializeCookie(GUEST_COOKIE_NAME, value, maxAgeSeconds);
}

export function clearGuestCookieHeader(): string {
  return clearCookie(GUEST_COOKIE_NAME);
}
