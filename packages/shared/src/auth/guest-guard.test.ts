import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { signGuestToken } from "./guest-token";

vi.mock("../tenants/display-token", () => ({
  loadTenantBySlug: vi.fn(),
}));

vi.mock("../parties/lookup", () => ({
  findPartyById: vi.fn(),
  findWaitingPartyBySession: vi.fn(),
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PARTY_ID = "22222222-2222-2222-2222-222222222222";
const SESSION_TOKEN = "cookie-session-token-abc";

const TENANT_ROW = {
  id: TENANT_ID,
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

const PARTY_ROW = {
  id: PARTY_ID,
  tenantId: TENANT_ID,
  name: "Alice",
  phone: null,
  partySize: 2,
  status: "waiting",
  sessionToken: SESSION_TOKEN,
  joinedAt: new Date(),
  seatedAt: null,
  resolvedAt: null,
};

function makeRequest(opts: {
  cookieValue?: string | null;
  authorization?: string | null;
}) {
  return {
    cookies: {
      get: (name: string) =>
        name === "party_session" && opts.cookieValue
          ? { value: opts.cookieValue }
          : undefined,
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" && opts.authorization
          ? opts.authorization
          : null,
    },
  } as Parameters<typeof import("./guest-guard").guardGuestRequest>[0];
}

beforeAll(() => {
  process.env.GUEST_JWT_SECRET = process.env.GUEST_JWT_SECRET ?? "z".repeat(40);
});

async function loadMocks() {
  const mod = await import("./guest-guard");
  const tenants = await import("../tenants/display-token");
  const lookup = await import("../parties/lookup");
  return { mod, tenants, lookup } as const;
}

describe("guardGuestRequest", () => {
  beforeEach(async () => {
    const { tenants, lookup } = await loadMocks();
    vi.mocked(tenants.loadTenantBySlug).mockResolvedValue({
      ok: true,
      tenant: TENANT_ROW,
    } as never);
    vi.mocked(lookup.findPartyById).mockResolvedValue(PARTY_ROW as never);
  });

  it("accepts cookie whose value matches party.sessionToken", async () => {
    const { mod } = await loadMocks();
    const req = makeRequest({ cookieValue: SESSION_TOKEN });
    const g = await mod.guardGuestRequest(req, "demo", PARTY_ID);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.source).toBe("cookie");
      expect(g.refreshedBearer).toBeNull();
      expect(g.claims).toBeNull();
    }
  });

  it("accepts Authorization: Bearer with matching claims", async () => {
    const { mod } = await loadMocks();
    const token = await signGuestToken({ slug: "demo", partyId: PARTY_ID });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const g = await mod.guardGuestRequest(req, "demo", PARTY_ID);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.source).toBe("bearer");
      expect(g.claims?.slug).toBe("demo");
      expect(g.claims?.partyId).toBe(PARTY_ID);
      expect(g.refreshedBearer).toBeNull();
    }
  });

  it("prefers cookie when both are present", async () => {
    const { mod } = await loadMocks();
    const bearer = await signGuestToken({
      slug: "demo",
      partyId: "00000000-0000-0000-0000-000000000000",
    });
    const req = makeRequest({
      cookieValue: SESSION_TOKEN,
      authorization: `Bearer ${bearer}`,
    });
    const g = await mod.guardGuestRequest(req, "demo", PARTY_ID);
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.source).toBe("cookie");
  });

  it("returns unauthenticated when neither cookie nor bearer is present", async () => {
    const { mod } = await loadMocks();
    const g = await mod.guardGuestRequest(makeRequest({}), "demo", PARTY_ID);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("unauthenticated");
  });

  it("returns tenant_not_found when the slug does not resolve", async () => {
    const { mod, tenants } = await loadMocks();
    vi.mocked(tenants.loadTenantBySlug).mockResolvedValue({
      ok: false,
    } as never);
    const g = await mod.guardGuestRequest(
      makeRequest({ cookieValue: SESSION_TOKEN }),
      "demo",
      PARTY_ID,
    );
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("tenant_not_found");
  });

  it("returns invalid_token for a mangled bearer", async () => {
    const { mod } = await loadMocks();
    const req = makeRequest({ authorization: "Bearer not-a-jwt" });
    const g = await mod.guardGuestRequest(req, "demo", PARTY_ID);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("invalid_token");
  });

  it("returns slug_mismatch when bearer's slug claim disagrees", async () => {
    const { mod } = await loadMocks();
    const token = await signGuestToken({
      slug: "other",
      partyId: PARTY_ID,
    });
    const g = await mod.guardGuestRequest(
      makeRequest({ authorization: `Bearer ${token}` }),
      "demo",
      PARTY_ID,
    );
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("slug_mismatch");
  });

  it("returns party_mismatch when bearer's partyId claim disagrees", async () => {
    const { mod } = await loadMocks();
    const token = await signGuestToken({
      slug: "demo",
      partyId: "99999999-9999-9999-9999-999999999999",
    });
    const g = await mod.guardGuestRequest(
      makeRequest({ authorization: `Bearer ${token}` }),
      "demo",
      PARTY_ID,
    );
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("party_mismatch");
  });

  it("returns party_not_found when the party is deleted", async () => {
    const { mod, lookup } = await loadMocks();
    vi.mocked(lookup.findPartyById).mockResolvedValue(null);
    const g = await mod.guardGuestRequest(
      makeRequest({ cookieValue: SESSION_TOKEN }),
      "demo",
      PARTY_ID,
    );
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("party_not_found");
  });

  it("returns session_mismatch when the cookie value doesn't match party.sessionToken", async () => {
    const { mod } = await loadMocks();
    const g = await mod.guardGuestRequest(
      makeRequest({ cookieValue: "wrong-cookie" }),
      "demo",
      PARTY_ID,
    );
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toBe("session_mismatch");
  });

  it("refreshes a near-expiry bearer via refreshedBearer", async () => {
    const { mod } = await loadMocks();
    const nowSec = Math.floor(Date.now() / 1000);
    const nearExpIatSec = nowSec - 23 * 60 * 60 - 30 * 60;
    const token = await signGuestToken({
      slug: "demo",
      partyId: PARTY_ID,
      now: nearExpIatSec * 1000,
    });
    const g = await mod.guardGuestRequest(
      makeRequest({ authorization: `Bearer ${token}` }),
      "demo",
      PARTY_ID,
      Date.now(),
    );
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.source).toBe("bearer");
      expect(g.refreshedBearer).toBeTypeOf("string");
    }
  });
});

describe("statusForGuestFailure", () => {
  it("maps auth failures to 401", async () => {
    const { mod } = await loadMocks();
    expect(mod.statusForGuestFailure("unauthenticated", "stream")).toBe(401);
    expect(mod.statusForGuestFailure("invalid_token", "action")).toBe(401);
  });

  it("maps identity mismatches to 403", async () => {
    const { mod } = await loadMocks();
    expect(mod.statusForGuestFailure("slug_mismatch", "stream")).toBe(403);
    expect(mod.statusForGuestFailure("party_mismatch", "stream")).toBe(403);
    expect(mod.statusForGuestFailure("wrong_tenant", "action")).toBe(403);
    expect(mod.statusForGuestFailure("session_mismatch", "action")).toBe(403);
  });

  it("maps party_not_found to 204 for stream and 404 for action", async () => {
    const { mod } = await loadMocks();
    expect(mod.statusForGuestFailure("party_not_found", "stream")).toBe(204);
    expect(mod.statusForGuestFailure("party_not_found", "action")).toBe(404);
  });
});
