import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, validateSlug } from "./slug";

describe("validateSlug", () => {
  it.each([
    "abc",
    "pila-lang",
    "test-123",
    "a1b2",
    "my-restaurant-name",
    "a".repeat(32),
  ])("accepts valid slug %s", (s) => {
    expect(validateSlug(s)).toEqual({ ok: true });
  });

  it.each([
    ["", "too short"],
    ["ab", "2 chars"],
    ["-abc", "leading hyphen"],
    ["abc-", "trailing hyphen"],
    ["ABC", "uppercase"],
    ["a_b", "underscore"],
    ["a b", "space"],
    ["a".repeat(33), "33 chars"],
    ["a!", "punctuation"],
  ])("rejects invalid pattern %s (%s)", (s) => {
    expect(validateSlug(s)).toEqual({ ok: false, reason: "pattern" });
  });

  it("rejects reserved slugs", () => {
    for (const r of RESERVED_SLUGS) {
      const result = validateSlug(r);
      if (r.length < 3 || !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(r)) {
        expect(result).toEqual({ ok: false, reason: "pattern" });
      } else {
        expect(result).toEqual({ ok: false, reason: "reserved" });
      }
    }
  });

  it("reserved list includes core names", () => {
    for (const expected of ["admin", "api", "host", "display"]) {
      expect(RESERVED_SLUGS.has(expected)).toBe(true);
    }
  });
});
