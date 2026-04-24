import { describe, expect, it } from "vitest";
import {
  generateInitialPassword,
  hashPassword,
  verifyPassword,
} from "./password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("hunter2-correct-horse");
    expect(await verifyPassword("hunter2-correct-horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("generates 12-char alphanumeric with no look-alikes", () => {
    const pw = generateInitialPassword();
    expect(pw).toHaveLength(12);
    expect(pw).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/);
    expect(pw).not.toMatch(/[0OIl1io]/);
  });

  it("generates different passwords on each call", () => {
    const a = generateInitialPassword();
    const b = generateInitialPassword();
    expect(a).not.toBe(b);
  });
});
