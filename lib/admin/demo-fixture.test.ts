import { describe, expect, it } from "vitest";
import { DEMO_HISTORICAL, DEMO_WAITING } from "./demo-fixture";

describe("demo fixture shape", () => {
  it("exposes exactly 3 waiting parties with deterministic names and party sizes", () => {
    expect(DEMO_WAITING).toHaveLength(3);
    expect(DEMO_WAITING.map((w) => w.name)).toEqual(["Priya Sharma", "Raj Patel", "Anya Lim"]);
    expect(DEMO_WAITING.map((w) => w.partySize)).toEqual([2, 4, 2]);
    const minutes = DEMO_WAITING.map((w) => w.minutesAgo);
    const sortedDesc = [...minutes].sort((a, b) => b - a);
    expect(minutes).toEqual(sortedDesc);
    for (const m of minutes) {
      expect(m).toBeGreaterThan(0);
    }
  });

  it("exposes exactly 10 historical parties with varied sizes and backdated joins", () => {
    expect(DEMO_HISTORICAL).toHaveLength(10);
    const sizes = new Set(DEMO_HISTORICAL.map((h) => h.partySize));
    expect(sizes.size).toBeGreaterThan(2);
    for (const h of DEMO_HISTORICAL) {
      expect(h.partySize).toBeGreaterThanOrEqual(1);
      expect(h.partySize).toBeLessThanOrEqual(6);
      expect(h.daysAgo).toBeGreaterThanOrEqual(1);
      expect(h.daysAgo).toBeLessThanOrEqual(14);
      expect(h.waitMinutes).toBeGreaterThanOrEqual(5);
      expect(h.waitMinutes).toBeLessThanOrEqual(45);
    }
  });

  it("covers both phone-present and phone-absent historical parties", () => {
    const withPhone = DEMO_HISTORICAL.filter((h) => h.phone !== null);
    const withoutPhone = DEMO_HISTORICAL.filter((h) => h.phone === null);
    expect(withPhone.length).toBeGreaterThan(0);
    expect(withoutPhone.length).toBeGreaterThan(0);
  });
});
