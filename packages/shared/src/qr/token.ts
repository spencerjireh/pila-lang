import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export const QR_TOKEN_TTL_MS = 65 * 60 * 1000;
export const QR_TOKEN_ROTATE_AFTER_MS = 60 * 60 * 1000;

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64: string): string {
  return b64url(
    createHmac("sha256", env().QR_TOKEN_SECRET).update(payloadB64).digest(),
  );
}

export function signQrToken(
  slug: string,
  issuedAtMs: number = Date.now(),
): string {
  const payload = `${slug}:${issuedAtMs}`;
  const payloadB64 = b64url(Buffer.from(payload, "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export type QrVerification =
  | { ok: true; slug: string; issuedAtMs: number }
  | {
      ok: false;
      reason: "malformed" | "slug_mismatch" | "signature" | "expired";
    };

export function verifyQrToken(
  expectedSlug: string,
  token: string,
  now: number = Date.now(),
): QrVerification {
  const idx = token.indexOf(".");
  if (idx <= 0 || idx === token.length - 1)
    return { ok: false, reason: "malformed" };
  const payloadB64 = token.slice(0, idx);
  const sigB64 = token.slice(idx + 1);
  const expectedSigB64 = sign(payloadB64);

  const got = Buffer.from(sigB64);
  const want = Buffer.from(expectedSigB64);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return { ok: false, reason: "signature" };
  }

  let payload: string;
  try {
    payload = b64urlDecode(payloadB64).toString("utf8");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const sep = payload.indexOf(":");
  if (sep <= 0) return { ok: false, reason: "malformed" };
  const slug = payload.slice(0, sep);
  const issuedAtMs = Number(payload.slice(sep + 1));
  if (!Number.isFinite(issuedAtMs)) return { ok: false, reason: "malformed" };
  if (slug !== expectedSlug) return { ok: false, reason: "slug_mismatch" };
  if (now - issuedAtMs > QR_TOKEN_TTL_MS)
    return { ok: false, reason: "expired" };
  return { ok: true, slug, issuedAtMs };
}
