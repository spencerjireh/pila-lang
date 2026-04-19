import { describe, expect, it } from "vitest";
import { createTenantSchema, updateTenantSchema } from "./tenant-schema";

describe("createTenantSchema", () => {
  it("accepts valid input", () => {
    const result = createTenantSchema.safeParse({
      name: "Garden Table",
      slug: "garden-table",
      timezone: "Asia/Kolkata",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(createTenantSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(
      createTenantSchema.safeParse({ slug: "x", timezone: "UTC" }).success,
    ).toBe(false);
  });

  it("trims whitespace around strings", () => {
    const result = createTenantSchema.parse({
      name: "  Garden Table  ",
      slug: "garden-table",
      timezone: "UTC",
    });
    expect(result.name).toBe("Garden Table");
  });
});

describe("updateTenantSchema", () => {
  it("accepts partial updates", () => {
    expect(updateTenantSchema.safeParse({ name: "New" }).success).toBe(true);
    expect(updateTenantSchema.safeParse({ isOpen: false }).success).toBe(true);
    expect(updateTenantSchema.safeParse({ logoUrl: null }).success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const result = updateTenantSchema.safeParse({ slug: "new-slug" });
    expect(result.success).toBe(false);
  });

  it("rejects password-hash updates", () => {
    expect(
      updateTenantSchema.safeParse({ hostPasswordHash: "x" }).success,
    ).toBe(false);
    expect(
      updateTenantSchema.safeParse({ hostPasswordVersion: 2 }).success,
    ).toBe(false);
  });

  it("requires logoUrl to be a valid URL when provided", () => {
    expect(updateTenantSchema.safeParse({ logoUrl: "not a url" }).success).toBe(
      false,
    );
    expect(
      updateTenantSchema.safeParse({ logoUrl: "https://example.com/x.png" })
        .success,
    ).toBe(true);
  });
});
