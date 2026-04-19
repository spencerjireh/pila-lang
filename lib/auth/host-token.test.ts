import { describe, expect, it } from "vitest";
import {
  HOST_TOKEN_REFRESH_WINDOW_SECONDS,
  HOST_TOKEN_TTL_SECONDS,
  maybeRefresh,
  signHostToken,
  verifyHostToken,
} from "./host-token";

describe("host-token", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signHostToken({ slug: "demo", pwv: 1 });
    const r = await verifyHostToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.slug).toBe("demo");
      expect(r.claims.pwv).toBe(1);
      expect(typeof r.claims.jti).toBe("string");
      expect(r.claims.exp - r.claims.iat).toBe(HOST_TOKEN_TTL_SECONDS);
    }
  });

  it("rejects a tampered token", async () => {
    const token = await signHostToken({ slug: "demo", pwv: 1 });
    const parts = token.split(".");
    const bad = `${parts[0]}.${parts[1]}.AAAA${parts[2]!.slice(4)}`;
    const r = await verifyHostToken(bad);
    expect(r.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const longAgo = Date.now() - (HOST_TOKEN_TTL_SECONDS + 60) * 1000;
    const token = await signHostToken({ slug: "demo", pwv: 1, now: longAgo });
    const r = await verifyHostToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("maybeRefresh does NOT refresh when more than 1h remains", async () => {
    const token = await signHostToken({ slug: "demo", pwv: 1 });
    const r = await maybeRefresh(token);
    expect(r && r.refreshed).toBe(false);
  });

  it("maybeRefresh DOES refresh when less than 1h remains", async () => {
    const issuedAt =
      Date.now() -
      (HOST_TOKEN_TTL_SECONDS - HOST_TOKEN_REFRESH_WINDOW_SECONDS + 60) * 1000;
    const token = await signHostToken({ slug: "demo", pwv: 1, now: issuedAt });
    const r = await maybeRefresh(token);
    expect(r).not.toBeNull();
    expect(r!.refreshed).toBe(true);
    if (r!.refreshed) {
      expect(r!.token).not.toBe(token);
      expect(r!.claims.slug).toBe("demo");
      expect(r!.claims.pwv).toBe(1);
    }
  });

  it("maybeRefresh preserves jti across refresh", async () => {
    const issuedAt =
      Date.now() -
      (HOST_TOKEN_TTL_SECONDS - HOST_TOKEN_REFRESH_WINDOW_SECONDS + 60) * 1000;
    const token = await signHostToken({
      slug: "demo",
      pwv: 2,
      jti: "stable-jti",
      now: issuedAt,
    });
    const r = await maybeRefresh(token);
    expect(r && r.refreshed).toBe(true);
    if (r && r.refreshed) expect(r.claims.jti).toBe("stable-jti");
  });
});
