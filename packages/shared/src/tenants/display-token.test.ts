import { describe, expect, it } from "vitest";

import {
  QR_TOKEN_ROTATE_AFTER_MS,
  QR_TOKEN_TTL_MS,
  verifyQrToken,
} from "../qr/token";
import { computeDisplayToken, toDisplayPayload } from "./display-token";

const baseTenant = {
  slug: "demo",
  currentQrToken: null as string | null,
  qrTokenIssuedAt: null as Date | null,
};

describe("computeDisplayToken", () => {
  it("signs a fresh token when none exists", () => {
    const now = 1_700_000_000_000;
    const d = computeDisplayToken({ ...baseTenant }, now);
    expect(d.reuse).toBe(false);
    expect(d.issuedAtMs).toBe(now);
    expect(d.validUntilMs).toBe(now + QR_TOKEN_TTL_MS);
    const v = verifyQrToken("demo", d.token, now);
    expect(v.ok).toBe(true);
  });

  it("reuses a token issued inside the 60-minute rotate window", () => {
    const now = 1_700_000_000_000;
    const issuedAtMs = now - (QR_TOKEN_ROTATE_AFTER_MS - 1_000);
    const existing = "existing.token";
    const d = computeDisplayToken(
      {
        slug: "demo",
        currentQrToken: existing,
        qrTokenIssuedAt: new Date(issuedAtMs),
      },
      now,
    );
    expect(d.reuse).toBe(true);
    expect(d.token).toBe(existing);
    expect(d.issuedAtMs).toBe(issuedAtMs);
    expect(d.validUntilMs).toBe(issuedAtMs + QR_TOKEN_TTL_MS);
  });

  it("rotates exactly at the 60-minute boundary", () => {
    const now = 1_700_000_000_000;
    const issuedAtMs = now - QR_TOKEN_ROTATE_AFTER_MS;
    const d = computeDisplayToken(
      {
        slug: "demo",
        currentQrToken: "stale",
        qrTokenIssuedAt: new Date(issuedAtMs),
      },
      now,
    );
    expect(d.reuse).toBe(false);
    expect(d.token).not.toBe("stale");
    expect(d.issuedAtMs).toBe(now);
  });

  it("rotates when no current token exists even if qrTokenIssuedAt is recent", () => {
    const now = 1_700_000_000_000;
    const d = computeDisplayToken(
      {
        slug: "demo",
        currentQrToken: null,
        qrTokenIssuedAt: new Date(now - 1_000),
      },
      now,
    );
    expect(d.reuse).toBe(false);
  });
});

describe("toDisplayPayload", () => {
  it("returns the server pre-fetch payload shape", () => {
    const decision = {
      reuse: true as const,
      token: "abc.def",
      issuedAtMs: 1_700_000_000_000,
      validUntilMs: 1_700_000_000_000 + QR_TOKEN_TTL_MS,
    };
    const payload = toDisplayPayload(decision, true);
    expect(payload).toEqual({
      token: "abc.def",
      validUntilMs: decision.validUntilMs,
      isOpen: true,
    });
    expect(Object.keys(payload).sort()).toEqual([
      "isOpen",
      "token",
      "validUntilMs",
    ]);
  });

  it("carries isOpen=false through", () => {
    const payload = toDisplayPayload(
      {
        reuse: false,
        token: "x.y",
        issuedAtMs: 0,
        validUntilMs: QR_TOKEN_TTL_MS,
      },
      false,
    );
    expect(payload.isOpen).toBe(false);
  });
});
