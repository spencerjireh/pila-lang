import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Use the platform-global Web Crypto API (Node 19+, Edge, browsers) so this
// module is importable from Next.js Edge middleware. node:crypto would force
// the bundle to fail Edge constraints even when sign() is never called.
const randomUUID = (): string => crypto.randomUUID();

export type JwtVerifyResult<C> =
  | { ok: true; claims: C }
  | { ok: false; reason: "invalid" | "expired" };

export type JwtRefreshResult<C> =
  | { refreshed: false; claims: C }
  | { refreshed: true; token: string; claims: C };

export interface JwtModule<Extras, C extends JWTPayload> {
  sign(extras: Extras, opts?: { jti?: string; now?: number }): Promise<string>;
  verify(token: string): Promise<JwtVerifyResult<C>>;
  maybeRefresh(
    token: string,
    now?: number,
  ): Promise<JwtRefreshResult<C> | null>;
  readonly TTL_SECONDS: number;
  readonly REFRESH_WINDOW_SECONDS: number;
}

export interface JwtModuleConfig<
  Extras extends Record<string, unknown>,
  C extends JWTPayload,
> {
  algorithm?: string;
  secret: () => Uint8Array;
  ttlSeconds: number;
  refreshWindowSeconds: number;
  /** Type-guard asserting the verified payload has all required claim fields. */
  validate: (payload: JWTPayload) => payload is C;
  /** Given verified claims, reconstruct the sign `Extras` for refresh re-signing. */
  toExtras: (claims: C) => Extras;
}

/**
 * Canonical HS256 JWT factory used by both host and guest token modules.
 * Captures the shared sign/verify/refresh scaffold so each concrete token
 * type (host, guest, future display-pairing, etc.) is just config.
 */
export function createJwtModule<
  Extras extends Record<string, unknown>,
  C extends JWTPayload,
>(config: JwtModuleConfig<Extras, C>): JwtModule<Extras, C> {
  const alg = config.algorithm ?? "HS256";

  async function sign(
    extras: Extras,
    opts?: { jti?: string; now?: number },
  ): Promise<string> {
    const nowMs = opts?.now ?? Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const jti = opts?.jti ?? randomUUID();
    return new SignJWT({ ...extras, jti })
      .setProtectedHeader({ alg })
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + config.ttlSeconds)
      .setJti(jti)
      .sign(config.secret());
  }

  async function verify(token: string): Promise<JwtVerifyResult<C>> {
    try {
      const { payload } = await jwtVerify(token, config.secret(), {
        algorithms: [alg],
      });
      if (!config.validate(payload)) return { ok: false, reason: "invalid" };
      return { ok: true, claims: payload };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
      return { ok: false, reason: "invalid" };
    }
  }

  async function maybeRefresh(
    token: string,
    nowMs: number = Date.now(),
  ): Promise<JwtRefreshResult<C> | null> {
    const result = await verify(token);
    if (!result.ok) return null;
    const { claims } = result;
    const secondsLeft = (claims.exp as number) - Math.floor(nowMs / 1000);
    if (secondsLeft > config.refreshWindowSeconds) {
      return { refreshed: false, claims };
    }
    const extras = config.toExtras(claims);
    const nowSec = Math.floor(nowMs / 1000);
    const fresh = await sign(extras, {
      jti: claims.jti as string,
      now: nowMs,
    });
    const refreshedClaims = {
      ...extras,
      jti: claims.jti,
      iat: nowSec,
      exp: nowSec + config.ttlSeconds,
    } as unknown as C;
    if (!config.validate(refreshedClaims)) return null;
    return { refreshed: true, token: fresh, claims: refreshedClaims };
  }

  return {
    sign,
    verify,
    maybeRefresh,
    TTL_SECONDS: config.ttlSeconds,
    REFRESH_WINDOW_SECONDS: config.refreshWindowSeconds,
  };
}
