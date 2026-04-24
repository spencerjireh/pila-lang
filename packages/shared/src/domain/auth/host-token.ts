import { type JWTPayload } from "jose";

import { env } from "../../primitives/config/env";

import { createJwtModule, type JwtVerifyResult } from "./jwt-module";

export interface HostClaims extends JWTPayload {
  slug: string;
  jti: string;
  pwv: number;
  iat: number;
  exp: number;
}

type HostExtras = { slug: string; pwv: number };

const mod = createJwtModule<HostExtras, HostClaims>({
  secret: () => new TextEncoder().encode(env().HOST_JWT_SECRET),
  ttlSeconds: 12 * 60 * 60,
  refreshWindowSeconds: 60 * 60,
  validate: (p): p is HostClaims =>
    typeof p.slug === "string" &&
    typeof p.pwv === "number" &&
    typeof p.jti === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number",
  toExtras: (c) => ({ slug: c.slug, pwv: c.pwv }),
});

export type HostTokenResult = JwtVerifyResult<HostClaims>;

export function signHostToken(params: {
  slug: string;
  pwv: number;
  jti?: string;
  now?: number;
}): Promise<string> {
  return mod.sign(
    { slug: params.slug, pwv: params.pwv },
    { jti: params.jti, now: params.now },
  );
}

export const verifyHostToken = mod.verify;
export const maybeRefresh = mod.maybeRefresh;
export const HOST_TOKEN_TTL_SECONDS = mod.TTL_SECONDS;
export const HOST_TOKEN_REFRESH_WINDOW_SECONDS = mod.REFRESH_WINDOW_SECONDS;
