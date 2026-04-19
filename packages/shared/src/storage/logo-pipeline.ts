import { randomBytes } from "node:crypto";

import sharp from "sharp";

import {
  ALLOWED_MIME,
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  OUTPUT_SIZE,
} from "./logo-limits";

export {
  ALLOWED_MIME,
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  OUTPUT_SIZE,
};

export type LogoProcessFailure = "mime" | "size" | "decode" | "dims";

export type LogoProcessResult =
  | { ok: true; pngBuffer: Buffer; key: string }
  | { ok: false; reason: LogoProcessFailure };

export async function processLogoUpload(
  buffer: Buffer,
  mime: string,
  tenantId: string,
): Promise<LogoProcessResult> {
  if (!ALLOWED_MIME.has(mime.toLowerCase()))
    return { ok: false, reason: "mime" };
  if (buffer.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "size" };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    return { ok: false, reason: "decode" };
  }
  if (!meta.width || !meta.height) return { ok: false, reason: "decode" };
  if (meta.format === "svg") return { ok: false, reason: "mime" };
  if (
    meta.width < MIN_DIMENSION ||
    meta.height < MIN_DIMENSION ||
    meta.width > MAX_DIMENSION ||
    meta.height > MAX_DIMENSION
  ) {
    return { ok: false, reason: "dims" };
  }

  let pngBuffer: Buffer;
  try {
    pngBuffer = await sharp(buffer)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return { ok: false, reason: "decode" };
  }

  const key = `tenants/${tenantId}/logo-${randomBytes(6).toString("hex")}.png`;
  return { ok: true, pngBuffer, key };
}
