import { type JWTPayload } from "jose";

import { env } from "../../primitives/config/env";

import { createJwtModule, type JwtVerifyResult } from "./jwt-module";

export interface GuestClaims extends JWTPayload {
  slug: string;
  partyId: string;
  jti: string;
  iat: number;
  exp: number;
}

type GuestExtras = { slug: string; partyId: string };

const mod = createJwtModule<GuestExtras, GuestClaims>({
  secret: () => new TextEncoder().encode(env().GUEST_JWT_SECRET),
  ttlSeconds: 24 * 60 * 60,
  refreshWindowSeconds: 60 * 60,
  validate: (p): p is GuestClaims =>
    typeof p.slug === "string" &&
    typeof p.partyId === "string" &&
    typeof p.jti === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number",
  toExtras: (c) => ({ slug: c.slug, partyId: c.partyId }),
});

export type GuestTokenResult = JwtVerifyResult<GuestClaims>;

export function signGuestToken(params: {
  slug: string;
  partyId: string;
  jti?: string;
  now?: number;
}): Promise<string> {
  return mod.sign(
    { slug: params.slug, partyId: params.partyId },
    { jti: params.jti, now: params.now },
  );
}

export const verifyGuestToken = mod.verify;
export const maybeRefreshGuest = mod.maybeRefresh;
export const GUEST_TOKEN_TTL_SECONDS = mod.TTL_SECONDS;
export const GUEST_TOKEN_REFRESH_WINDOW_SECONDS = mod.REFRESH_WINDOW_SECONDS;
