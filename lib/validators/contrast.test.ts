import { describe, expect, it } from "vitest";
import {
  AA_THRESHOLD,
  contrastRatio,
  parseHex,
  pickForeground,
  validateAccentColor,
} from "./contrast";

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#1F6FEB")).toEqual([31, 111, 235]);
  });
  it("parses 3-digit hex", () => {
    expect(parseHex("#f00")).toEqual([255, 0, 0]);
  });
  it("rejects missing #", () => {
    expect(parseHex("1F6FEB")).toBeNull();
  });
  it("rejects invalid chars", () => {
    expect(parseHex("#zzzzzz")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("is 21 between black and white", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });
  it("is 1 between same colors", () => {
    expect(contrastRatio([100, 100, 100], [100, 100, 100])).toBeCloseTo(1, 5);
  });
});

describe("validateAccentColor", () => {
  it("accepts the default accent #1F6FEB (passes AA against white)", () => {
    const r = validateAccentColor("#1F6FEB");
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(Math.max(r.blackRatio, r.whiteRatio)).toBeGreaterThanOrEqual(
        AA_THRESHOLD,
      );
  });

  it("accepts pure black (infinite contrast against white)", () => {
    const r = validateAccentColor("#000000");
    expect(r.ok).toBe(true);
  });

  it("accepts pure white (infinite contrast against black)", () => {
    const r = validateAccentColor("#ffffff");
    expect(r.ok).toBe(true);
  });

  it("always passes any valid hex (blackRatio * whiteRatio = 21 invariant)", () => {
    for (const hex of ["#808080", "#777777", "#767676", "#888888", "#123456"]) {
      const r = validateAccentColor(hex);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.blackRatio * r.whiteRatio).toBeCloseTo(21, 1);
    }
  });

  it("rejects malformed hex", () => {
    const r = validateAccentColor("not-a-color");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("format");
  });
});

describe("pickForeground", () => {
  it("picks white on deep blue", () => {
    expect(pickForeground("#1F6FEB")).toBe("#ffffff");
  });
  it("picks black on light yellow", () => {
    expect(pickForeground("#ffff99")).toBe("#000000");
  });
});
