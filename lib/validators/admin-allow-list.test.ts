import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("isAdminEmail", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_EMAILS = "Alice@Example.com, bob@example.com ,carol@example.com";
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.resetModules();
  });

  it("matches case-insensitive with trimming", async () => {
    const { isAdminEmail } = await import("./admin-allow-list");
    expect(isAdminEmail("alice@example.com")).toBe(true);
    expect(isAdminEmail("  BOB@example.COM ")).toBe(true);
    expect(isAdminEmail("carol@example.com")).toBe(true);
  });

  it("rejects emails not on the list", async () => {
    const { isAdminEmail } = await import("./admin-allow-list");
    expect(isAdminEmail("mallory@example.com")).toBe(false);
  });

  it("rejects empty or whitespace-only input", async () => {
    const { isAdminEmail } = await import("./admin-allow-list");
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("   ")).toBe(false);
  });
});
