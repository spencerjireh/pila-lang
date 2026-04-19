import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "./guest-history";

describe("guest history cursor", () => {
  it("round-trips a cursor through encode/decode", () => {
    const cursor = {
      lastVisitAt: "2026-04-19T12:00:00.000Z",
      phone: "+14155550100",
    };
    const encoded = encodeCursor(cursor);
    expect(typeof encoded).toBe("string");
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("returns null for null/empty cursor input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for malformed cursor input", () => {
    expect(decodeCursor("not-base64url!!!!")).toBeNull();
    expect(decodeCursor(Buffer.from("not json").toString("base64url"))).toBeNull();
  });

  it("rejects cursors missing required fields", () => {
    const encoded = Buffer.from(
      JSON.stringify({ lastVisitAt: "2026-04-19T12:00:00.000Z" }),
    ).toString("base64url");
    expect(decodeCursor(encoded)).toBeNull();
  });

  it("encoded cursors are URL-safe (no +,/,=)", () => {
    const cursor = {
      lastVisitAt: "2026-04-19T12:00:00.000Z",
      phone: "+14155550100",
    };
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
