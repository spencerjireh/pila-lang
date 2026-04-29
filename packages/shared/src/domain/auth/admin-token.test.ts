import { describe, expect, it } from "vitest";

import {
  ADMIN_TOKEN_TTL_SECONDS,
  signAdminToken,
  verifyAdminToken,
} from "./admin-token";

describe("admin-token", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signAdminToken({
      sub: "user-1",
      email: "admin@example.com",
    });
    const r = await verifyAdminToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.sub).toBe("user-1");
      expect(r.claims.email).toBe("admin@example.com");
      expect(typeof r.claims.jti).toBe("string");
      expect(r.claims.exp - r.claims.iat).toBe(ADMIN_TOKEN_TTL_SECONDS);
    }
  });

  it("rejects a tampered token", async () => {
    const token = await signAdminToken({
      sub: "user-1",
      email: "admin@example.com",
    });
    const parts = token.split(".");
    const bad = `${parts[0]}.${parts[1]}.AAAA${parts[2]!.slice(4)}`;
    const r = await verifyAdminToken(bad);
    expect(r.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const longAgo = Date.now() - (ADMIN_TOKEN_TTL_SECONDS + 60) * 1000;
    const token = await signAdminToken({
      sub: "user-1",
      email: "admin@example.com",
      now: longAgo,
    });
    const r = await verifyAdminToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("preserves jti across roundtrip", async () => {
    const token = await signAdminToken({
      sub: "user-1",
      email: "admin@example.com",
      jti: "stable-jti",
    });
    const r = await verifyAdminToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.jti).toBe("stable-jti");
  });
});
