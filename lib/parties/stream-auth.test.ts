import { describe, expect, it } from "vitest";

import { guestStreamAuth } from "./stream-auth";

const tenant = { id: "tenant-1" };
const waitingParty = {
  id: "p1",
  tenantId: "tenant-1",
  sessionToken: "cookie-value",
  status: "waiting" as const,
};

describe("guestStreamAuth", () => {
  it("returns 404 when the tenant is missing", () => {
    expect(
      guestStreamAuth({
        tenant: null,
        party: waitingParty,
        cookie: "cookie-value",
      }),
    ).toEqual({ ok: false, status: 404 });
  });

  it("returns 401 when the cookie is absent", () => {
    expect(
      guestStreamAuth({ tenant, party: waitingParty, cookie: undefined }),
    ).toEqual({ ok: false, status: 401 });
    expect(
      guestStreamAuth({ tenant, party: waitingParty, cookie: null }),
    ).toEqual({ ok: false, status: 401 });
  });

  it("returns 204 when the party row is missing (orphaned cookie)", () => {
    expect(
      guestStreamAuth({ tenant, party: null, cookie: "cookie-value" }),
    ).toEqual({ ok: false, status: 204 });
  });

  it("returns 403 when the cookie does not match the session token", () => {
    expect(
      guestStreamAuth({ tenant, party: waitingParty, cookie: "wrong-cookie" }),
    ).toEqual({ ok: false, status: 403 });
  });

  it("returns 403 when the party belongs to a different tenant", () => {
    expect(
      guestStreamAuth({
        tenant,
        party: { ...waitingParty, tenantId: "tenant-other" },
        cookie: "cookie-value",
      }),
    ).toEqual({ ok: false, status: 403 });
  });

  it("returns 204 when the party is in a terminal status", () => {
    for (const status of ["seated", "no_show", "left"] as const) {
      expect(
        guestStreamAuth({
          tenant,
          party: { ...waitingParty, status },
          cookie: "cookie-value",
        }),
      ).toEqual({ ok: false, status: 204 });
    }
  });

  it("returns ok with the waiting party when everything matches", () => {
    const result = guestStreamAuth({
      tenant,
      party: waitingParty,
      cookie: "cookie-value",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.party.id).toBe("p1");
  });
});
