import { type JWTPayload } from "jose";

import { env } from "../../primitives/config/env";

import { createJwtModule, type JwtVerifyResult } from "./jwt-module";

export interface AdminClaims extends JWTPayload {
  sub: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

type AdminExtras = { sub: string; email: string };

const mod = createJwtModule<AdminExtras, AdminClaims>({
  // Reused for cutover rollback parity. Sprint 7 renames to ADMIN_JWT_SECRET.
  secret: () => new TextEncoder().encode(env().NEXTAUTH_SECRET),
  ttlSeconds: 24 * 60 * 60,
  refreshWindowSeconds: 60 * 60,
  validate: (p): p is AdminClaims =>
    typeof p.sub === "string" &&
    typeof p.email === "string" &&
    typeof p.jti === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number",
  toExtras: (c) => ({ sub: c.sub, email: c.email }),
});

export type AdminTokenResult = JwtVerifyResult<AdminClaims>;

export function signAdminToken(params: {
  sub: string;
  email: string;
  jti?: string;
  now?: number;
}): Promise<string> {
  return mod.sign(
    { sub: params.sub, email: params.email },
    { jti: params.jti, now: params.now },
  );
}

export const verifyAdminToken = mod.verify;
export const ADMIN_TOKEN_TTL_SECONDS = mod.TTL_SECONDS;
