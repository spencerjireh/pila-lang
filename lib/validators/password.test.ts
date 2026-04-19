import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordChangeSchema,
  passwordSchema,
} from "./password";

describe("passwordSchema", () => {
  it("rejects fewer than 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
  });

  it("accepts exactly 8 characters", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("rejects longer than 200 characters", () => {
    expect(
      passwordSchema.safeParse("a".repeat(MAX_PASSWORD_LENGTH + 1)).success,
    ).toBe(false);
  });

  it("has MIN_PASSWORD_LENGTH = 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});

describe("passwordChangeSchema", () => {
  it("requires newPassword for rotate", () => {
    expect(
      passwordChangeSchema.safeParse({ action: "rotate" }).success,
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({
        action: "rotate",
        newPassword: "supersecret",
      }).success,
    ).toBe(true);
  });

  it("rejects short newPassword on rotate", () => {
    expect(
      passwordChangeSchema.safeParse({ action: "rotate", newPassword: "tiny" })
        .success,
    ).toBe(false);
  });

  it("accepts logout-others with no newPassword", () => {
    expect(
      passwordChangeSchema.safeParse({ action: "logout-others" }).success,
    ).toBe(true);
  });

  it("rejects unknown actions", () => {
    expect(
      passwordChangeSchema.safeParse({ action: "delete" }).success,
    ).toBe(false);
  });
});
