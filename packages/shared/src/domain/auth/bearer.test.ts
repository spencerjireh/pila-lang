import { describe, expect, it } from "vitest";

import { parseBearer } from "./bearer";

describe("parseBearer", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer("")).toBeNull();
  });

  it("accepts `Bearer <token>` case-insensitively", () => {
    expect(parseBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearer("bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearer("BEARER abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("trims surrounding whitespace on the token", () => {
    expect(parseBearer("Bearer   abc  ")).toBe("abc");
  });

  it("returns null for non-bearer schemes", () => {
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer("Token abc")).toBeNull();
  });

  it("returns null when no token follows the scheme", () => {
    expect(parseBearer("Bearer")).toBeNull();
    expect(parseBearer("Bearer ")).toBeNull();
    expect(parseBearer("Bearer    ")).toBeNull();
  });
});
