import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { signHostToken } from "./host-token";

vi.mock("../tenants/display-token", () => ({
  loadTenantBySlug: vi.fn(),
}));

const TENANT_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "demo",
  name: "Demo",
  logoUrl: null,
  accentColor: "#1F6FEB",
  hostPasswordHash: "hash",
  hostPasswordVersion: 1,
  timezone: "UTC",
  isOpen: true,
  isDemo: true,
  currentQrToken: null,
  qrTokenIssuedAt: null,
  createdAt: new Date(),
};

function makeRequest(opts: {
  cookieValue?: string | null;
  authorization?: string | null;
}) {
  return {
    cookies: {
      get: (name: string) =>
        name === "host_session" && opts.cookieValue
          ? { value: opts.cookieValue }
          : undefined,
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" && opts.authorization
          ? opts.authorization
          : null,
    },
  } as Parameters<typeof import("./host-guard").guardHostRequest>[0];
}

beforeAll(() => {
  process.env.HOST_JWT_SECRET =
    process.env.HOST_JWT_SECRET ??
    "test-host-jwt-secret-at-least-32-characters-long!";
});

async function loadGuard() {
  const mod = await import("./host-guard");
  const tenants = await import("../tenants/display-token");
  return { mod, tenants } as const;
}

describe("guardHostRequest bearer path", () => {
  beforeEach(async () => {
    const { tenants } = await loadGuard();
    vi.mocked(tenants.loadTenantBySlug).mockResolvedValue({
      ok: true,
      tenant: TENANT_ROW,
    } as never);
  });

  it("accepts a valid Authorization: Bearer when no cookie is present", async () => {
    const { mod } = await loadGuard();
    const token = await signHostToken({ slug: "demo", pwv: 1 });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const guard = await mod.guardHostRequest(req, "demo");
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.source).toBe("bearer");
      expect(guard.claims.slug).toBe("demo");
      expect(guard.refreshedCookie).toBeNull();
    }
  });

  it("prefers the cookie when both are present", async () => {
    const { mod } = await loadGuard();
    const cookieToken = await signHostToken({ slug: "demo", pwv: 1 });
    const bearerToken = await signHostToken({ slug: "other", pwv: 1 });
    const req = makeRequest({
      cookieValue: cookieToken,
      authorization: `Bearer ${bearerToken}`,
    });
    const guard = await mod.guardHostRequest(req, "demo");
    expect(guard.ok).toBe(true);
    if (guard.ok) expect(guard.source).toBe("cookie");
  });

  it("rejects stale pwv on bearer without setting a clear-cookie header", async () => {
    const { mod, tenants } = await loadGuard();
    vi.mocked(tenants.loadTenantBySlug).mockResolvedValue({
      ok: true,
      tenant: { ...TENANT_ROW, hostPasswordVersion: 5 },
    } as never);
    const token = await signHostToken({ slug: "demo", pwv: 1 });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const guard = await mod.guardHostRequest(req, "demo");
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.status).toBe(401);
      expect(guard.clearCookie).toBe(false);
    }
  });

  it("rejects wrong-slug bearer with 403", async () => {
    const { mod } = await loadGuard();
    const token = await signHostToken({ slug: "other", pwv: 1 });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const guard = await mod.guardHostRequest(req, "demo");
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.status).toBe(403);
  });

  it("refreshes a near-expiry bearer into refreshedBearer only", async () => {
    const { mod } = await loadGuard();
    const nowSec = Math.floor(Date.now() / 1000);
    const nearExp = nowSec - 11 * 60 * 60;
    const token = await signHostToken({
      slug: "demo",
      pwv: 1,
      now: nearExp * 1000,
    });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const guard = await mod.guardHostRequest(req, "demo", Date.now());
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.source).toBe("bearer");
      expect(guard.refreshedBearer).toBeTypeOf("string");
      expect(guard.refreshedCookie).toBeNull();
    }
  });

  it("returns 401 without clear-cookie when nothing is presented", async () => {
    const { mod } = await loadGuard();
    const req = makeRequest({});
    const guard = await mod.guardHostRequest(req, "demo");
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.status).toBe(401);
      expect(guard.clearCookie).toBe(false);
    }
  });
});
