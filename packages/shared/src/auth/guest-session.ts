import { randomUUID } from "node:crypto";

export const GUEST_COOKIE_NAME = "party_session";
export const GUEST_COOKIE_MAX_AGE = 24 * 60 * 60;

export interface GuestCookieAttrs {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function generateGuestSessionToken(): string {
  return randomUUID();
}

export function guestCookieAttrs(
  maxAgeSeconds: number = GUEST_COOKIE_MAX_AGE,
): GuestCookieAttrs {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
