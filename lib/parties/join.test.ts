import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { parties } from "@/lib/db/schema";
import { tenantDb } from "@/lib/db/tenant-scoped";
import {
  isPartyPhoneConflict,
  shouldSetWelcomeBack,
  waitUrlFor,
} from "./join";

const TENANT = "00000000-0000-0000-0000-000000000001";

describe("shouldSetWelcomeBack", () => {
  it("returns false when phone is missing", () => {
    expect(shouldSetWelcomeBack({ phone: null, priorCount: 5 })).toBe(false);
  });

  it("returns false when phone provided but no priors exist", () => {
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 0 })).toBe(false);
  });

  it("returns true when phone provided and at least one prior exists", () => {
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 1 })).toBe(true);
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 3 })).toBe(true);
  });
});

describe("isPartyPhoneConflict", () => {
  it("recognizes the Postgres 23505 unique-violation code", () => {
    expect(isPartyPhoneConflict({ code: "23505" })).toBe(true);
  });

  it("rejects any other error shape", () => {
    expect(isPartyPhoneConflict(null)).toBe(false);
    expect(isPartyPhoneConflict(undefined)).toBe(false);
    expect(isPartyPhoneConflict("boom")).toBe(false);
    expect(isPartyPhoneConflict(new Error("boom"))).toBe(false);
    expect(isPartyPhoneConflict({ code: "23503" })).toBe(false);
    expect(isPartyPhoneConflict({})).toBe(false);
  });
});

describe("waitUrlFor", () => {
  it("returns the guest wait path scoped to slug and party", () => {
    expect(waitUrlFor("demo", "abc")).toBe("/r/demo/wait/abc");
  });
});

describe("duplicate-phone pre-check query shape", () => {
  it("filters by tenant_id, phone, and status='waiting'", () => {
    const phone = "+14155550100";
    const q = tenantDb(TENANT).parties.select(
      and(eq(parties.phone, phone), eq(parties.status, "waiting")),
    );
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(sql).toMatch(/"parties"\."phone" = \$/);
    expect(sql).toMatch(/"parties"\."status" = \$/);
    expect(params).toContain(TENANT);
    expect(params).toContain(phone);
    expect(params).toContain("waiting");
  });
});
