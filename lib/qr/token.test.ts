import { describe, expect, it } from "vitest";
import { QR_TOKEN_TTL_MS, signQrToken, verifyQrToken } from "./token";

describe("qr-token", () => {
  it("signs and verifies a fresh token", () => {
    const t = signQrToken("demo");
    const r = verifyQrToken("demo", t);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("demo");
  });

  it("rejects tampered signature", () => {
    const t = signQrToken("demo");
    const bad = `${t.slice(0, -2)}AA`;
    const r = verifyQrToken("demo", bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature");
  });

  it("rejects slug mismatch", () => {
    const t = signQrToken("demo");
    const r = verifyQrToken("other", t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("slug_mismatch");
  });

  it("rejects expired token", () => {
    const t = signQrToken("demo", Date.now() - (QR_TOKEN_TTL_MS + 1000));
    const r = verifyQrToken("demo", t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects malformed tokens", () => {
    expect(verifyQrToken("demo", "").ok).toBe(false);
    expect(verifyQrToken("demo", "not-a-token").ok).toBe(false);
    expect(verifyQrToken("demo", ".justsig").ok).toBe(false);
    expect(verifyQrToken("demo", "payload.").ok).toBe(false);
  });

  it("accepts token issued just inside the 65-minute window", () => {
    const t = signQrToken("demo", Date.now() - (QR_TOKEN_TTL_MS - 1000));
    expect(verifyQrToken("demo", t).ok).toBe(true);
  });
});
