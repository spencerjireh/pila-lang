import { describe, expect, it } from "vitest";

import { decideHostGuard } from "./host-guard";
import type { HostClaims } from "./host-token";

const FAR_FUTURE_IAT = Math.floor(Date.now() / 1000);
const FAR_FUTURE_EXP = FAR_FUTURE_IAT + 12 * 60 * 60;

function claims(partial: Partial<HostClaims> = {}): HostClaims {
  return {
    slug: "demo",
    pwv: 1,
    jti: "abc",
    iat: FAR_FUTURE_IAT,
    exp: FAR_FUTURE_EXP,
    ...partial,
  };
}

const tenantV1 = { slug: "demo", hostPasswordVersion: 1 };

describe("decideHostGuard", () => {
  it("returns 401 with no cookie-clear when the cookie is missing", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: null,
      tenant: tenantV1,
      claims: null,
      reason: "missing",
    });
    expect(decision).toEqual({ ok: false, status: 401, clearCookie: false });
  });

  it("returns 401 and clears the cookie when the token is invalid", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "garbage",
      tenant: tenantV1,
      claims: null,
      reason: "invalid",
    });
    expect(decision).toEqual({ ok: false, status: 401, clearCookie: true });
  });

  it("returns 401 and clears the cookie when the token is expired", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "expired",
      tenant: tenantV1,
      claims: null,
      reason: "expired",
    });
    expect(decision).toEqual({ ok: false, status: 401, clearCookie: true });
  });

  it("returns 404 when the tenant is missing", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "token",
      tenant: null,
      claims: claims(),
      reason: "ok",
    });
    expect(decision).toEqual({ ok: false, status: 404, clearCookie: false });
  });

  it("returns 403 when the token's slug does not match the URL slug", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "token",
      tenant: tenantV1,
      claims: claims({ slug: "other" }),
      reason: "ok",
    });
    expect(decision).toEqual({ ok: false, status: 403, clearCookie: false });
  });

  it("returns 401 and clears the cookie when pwv is stale", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "token",
      tenant: { slug: "demo", hostPasswordVersion: 3 },
      claims: claims({ pwv: 1 }),
      reason: "ok",
    });
    expect(decision).toEqual({ ok: false, status: 401, clearCookie: true });
  });

  it("returns ok with the claims when everything matches", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "token",
      tenant: tenantV1,
      claims: claims(),
      reason: "ok",
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.claims.slug).toBe("demo");
      expect(decision.tenantVersion).toBe(1);
    }
  });

  it("accepts a newer pwv than the tenant (tolerates race during rotation)", () => {
    const decision = decideHostGuard({
      slug: "demo",
      cookie: "token",
      tenant: { slug: "demo", hostPasswordVersion: 2 },
      claims: claims({ pwv: 3 }),
      reason: "ok",
    });
    expect(decision.ok).toBe(true);
  });
});
