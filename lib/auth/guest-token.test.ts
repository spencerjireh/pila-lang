import { beforeAll, describe, expect, it } from "vitest";

import {
  GUEST_TOKEN_REFRESH_WINDOW_SECONDS,
  GUEST_TOKEN_TTL_SECONDS,
  maybeRefreshGuest,
  signGuestToken,
  verifyGuestToken,
} from "./guest-token";

beforeAll(() => {
  process.env.GUEST_JWT_SECRET =
    process.env.GUEST_JWT_SECRET ??
    "test-guest-jwt-secret-at-least-32-characters-long!";
});

describe("guest-token", () => {
  it("signs and verifies a well-formed token", async () => {
    const token = await signGuestToken({ slug: "demo", partyId: "p-123" });
    const result = await verifyGuestToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.slug).toBe("demo");
      expect(result.claims.partyId).toBe("p-123");
      expect(result.claims.jti).toBeTypeOf("string");
    }
  });

  it("rejects a tampered token", async () => {
    const token = await signGuestToken({ slug: "demo", partyId: "p-1" });
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p}xxx.${s}`;
    const result = await verifyGuestToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  it("rejects garbage", async () => {
    const result = await verifyGuestToken("not-a-token");
    expect(result.ok).toBe(false);
  });

  it("reports expiry distinctly", async () => {
    const past = Date.now() - (GUEST_TOKEN_TTL_SECONDS + 60) * 1000;
    const token = await signGuestToken({
      slug: "demo",
      partyId: "p-1",
      now: past,
    });
    const result = await verifyGuestToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("does not refresh when plenty of time remains", async () => {
    const token = await signGuestToken({ slug: "demo", partyId: "p-1" });
    const refresh = await maybeRefreshGuest(token);
    expect(refresh?.refreshed).toBe(false);
  });

  it("refreshes inside the last hour, preserving jti and partyId", async () => {
    const now = Date.now();
    const issuedAt =
      now -
      (GUEST_TOKEN_TTL_SECONDS - GUEST_TOKEN_REFRESH_WINDOW_SECONDS + 5) * 1000;
    const token = await signGuestToken({
      slug: "demo",
      partyId: "p-1",
      now: issuedAt,
    });
    const refresh = await maybeRefreshGuest(token, now);
    expect(refresh?.refreshed).toBe(true);
    if (refresh?.refreshed) {
      const [, before] = token.split(".");
      const [, after] = refresh.token.split(".");
      expect(before).not.toBe(after);
      expect(refresh.claims.partyId).toBe("p-1");
      expect(refresh.claims.slug).toBe("demo");
    }
  });
});
