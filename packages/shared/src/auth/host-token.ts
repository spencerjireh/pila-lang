import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

const ALG = "HS256";
const TTL_SECONDS = 12 * 60 * 60;
const REFRESH_WINDOW_SECONDS = 60 * 60;

export interface HostClaims extends JWTPayload {
  slug: string;
  jti: string;
  pwv: number;
  iat: number;
  exp: number;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env().HOST_JWT_SECRET);
}

export async function signHostToken(params: {
  slug: string;
  pwv: number;
  jti?: string;
  now?: number;
}): Promise<string> {
  const now = Math.floor((params.now ?? Date.now()) / 1000);
  const jti = params.jti ?? randomUUID();
  return new SignJWT({ slug: params.slug, pwv: params.pwv, jti })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .setJti(jti)
    .sign(secret());
}

export type HostTokenResult =
  | { ok: true; claims: HostClaims }
  | { ok: false; reason: "invalid" | "expired" };

export async function verifyHostToken(token: string): Promise<HostTokenResult> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (
      typeof payload.slug !== "string" ||
      typeof payload.pwv !== "number" ||
      typeof payload.jti !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, claims: payload as HostClaims };
  } catch (err) {
    const name = (err as { code?: string }).code;
    if (name === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}

export async function maybeRefresh(
  token: string,
  now: number = Date.now(),
): Promise<
  | { refreshed: false; claims: HostClaims }
  | { refreshed: true; token: string; claims: HostClaims }
  | null
> {
  const result = await verifyHostToken(token);
  if (!result.ok) return null;
  const { claims } = result;
  const secondsLeft = claims.exp - Math.floor(now / 1000);
  if (secondsLeft > REFRESH_WINDOW_SECONDS) return { refreshed: false, claims };
  const fresh = await signHostToken({
    slug: claims.slug,
    pwv: claims.pwv,
    jti: claims.jti,
    now,
  });
  const verified = await verifyHostToken(fresh);
  if (!verified.ok) return null;
  return { refreshed: true, token: fresh, claims: verified.claims };
}

export const HOST_TOKEN_TTL_SECONDS = TTL_SECONDS;
export const HOST_TOKEN_REFRESH_WINDOW_SECONDS = REFRESH_WINDOW_SECONDS;
