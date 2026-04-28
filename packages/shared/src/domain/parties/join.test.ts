import { describe, expect, it } from "vitest";

import { isPartyPhoneConflict, shouldSetWelcomeBack, waitUrlFor } from "./join";

describe("shouldSetWelcomeBack", () => {
  it("returns false when phone is missing", () => {
    expect(shouldSetWelcomeBack({ phone: null, priorCount: 5 })).toBe(false);
  });

  it("returns false when phone provided but no priors exist", () => {
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 0 })).toBe(
      false,
    );
  });

  it("returns true when phone provided and at least one prior exists", () => {
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 1 })).toBe(
      true,
    );
    expect(shouldSetWelcomeBack({ phone: "+14155550100", priorCount: 3 })).toBe(
      true,
    );
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

describe("duplicate-phone enforcement", () => {
  // joinQueue removed the pre-insert SELECT and now relies on the partial
  // unique index idx_parties_one_waiting_per_phone (schema.ts) plus the
  // 23505 catch in joinQueue. The pre-check was a redundant round-trip that
  // could not close the race the unique index closes.
  it("isPartyPhoneConflict still maps 23505 → already_waiting", () => {
    expect(isPartyPhoneConflict({ code: "23505" })).toBe(true);
  });
});
