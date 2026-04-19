import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";

const ALG = "HS256";
const TTL_SECONDS = 24 * 60 * 60;
const REFRESH_WINDOW_SECONDS = 60 * 60;

export interface GuestClaims extends JWTPayload {
  slug: string;
  partyId: string;
  jti: string;
  iat: number;
  exp: number;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env().GUEST_JWT_SECRET);
}

export async function signGuestToken(params: {
  slug: string;
  partyId: string;
  jti?: string;
  now?: number;
}): Promise<string> {
  const now = Math.floor((params.now ?? Date.now()) / 1000);
  const jti = params.jti ?? randomUUID();
  return new SignJWT({ slug: params.slug, partyId: params.partyId, jti })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .setJti(jti)
    .sign(secret());
}

export type GuestTokenResult =
  | { ok: true; claims: GuestClaims }
  | { ok: false; reason: "invalid" | "expired" };

export async function verifyGuestToken(
  token: string,
): Promise<GuestTokenResult> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (
      typeof payload.slug !== "string" ||
      typeof payload.partyId !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, claims: payload as GuestClaims };
  } catch (err) {
    const name = (err as { code?: string }).code;
    if (name === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}

export async function maybeRefreshGuest(
  token: string,
  now: number = Date.now(),
): Promise<
  | { refreshed: false; claims: GuestClaims }
  | { refreshed: true; token: string; claims: GuestClaims }
  | null
> {
  const result = await verifyGuestToken(token);
  if (!result.ok) return null;
  const { claims } = result;
  const secondsLeft = claims.exp - Math.floor(now / 1000);
  if (secondsLeft > REFRESH_WINDOW_SECONDS) return { refreshed: false, claims };
  const fresh = await signGuestToken({
    slug: claims.slug,
    partyId: claims.partyId,
    jti: claims.jti,
    now,
  });
  const verified = await verifyGuestToken(fresh);
  if (!verified.ok) return null;
  return { refreshed: true, token: fresh, claims: verified.claims };
}

export const GUEST_TOKEN_TTL_SECONDS = TTL_SECONDS;
export const GUEST_TOKEN_REFRESH_WINDOW_SECONDS = REFRESH_WINDOW_SECONDS;
