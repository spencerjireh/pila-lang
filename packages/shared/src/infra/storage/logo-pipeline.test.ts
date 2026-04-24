import { describe, expect, it } from "vitest";

import sharp from "sharp";

import {
  MAX_UPLOAD_BYTES,
  OUTPUT_SIZE,
  processLogoUpload,
} from "./logo-pipeline";

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 31, g: 111, b: 235, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

const TENANT = "t1";

describe("processLogoUpload", () => {
  it("accepts a valid PNG and outputs a 512x512 PNG", async () => {
    const input = await makePng(800, 800);
    const result = await processLogoUpload(input, "image/png", TENANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(OUTPUT_SIZE);
    expect(meta.height).toBe(OUTPUT_SIZE);
    expect(result.key).toMatch(/^tenants\/t1\/logo-[0-9a-f]{12}\.png$/);
  });

  it("accepts a JPEG and outputs a PNG", async () => {
    const input = await makeJpeg(600, 600);
    const result = await processLogoUpload(input, "image/jpeg", TENANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(OUTPUT_SIZE);
  });

  it("rejects SVG before decode by mime", async () => {
    const result = await processLogoUpload(
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      "image/svg+xml",
      TENANT,
    );
    expect(result).toEqual({ ok: false, reason: "mime" });
  });

  it("rejects payloads larger than 500KB", async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    const result = await processLogoUpload(big, "image/png", TENANT);
    expect(result).toEqual({ ok: false, reason: "size" });
  });

  it("rejects dimensions smaller than 64px", async () => {
    const tiny = await makePng(32, 32);
    const result = await processLogoUpload(tiny, "image/png", TENANT);
    expect(result).toEqual({ ok: false, reason: "dims" });
  });

  it("rejects dimensions larger than 4096px", async () => {
    const huge = await makePng(5000, 200);
    const result = await processLogoUpload(huge, "image/png", TENANT);
    expect(result).toEqual({ ok: false, reason: "dims" });
  });

  it("rejects undecodable bytes", async () => {
    const garbage = Buffer.from("not-an-image-just-text");
    const result = await processLogoUpload(garbage, "image/png", TENANT);
    expect(result).toEqual({ ok: false, reason: "decode" });
  });

  it("produces unique keys across calls for the same tenant", async () => {
    const input = await makePng(200, 200);
    const a = await processLogoUpload(input, "image/png", TENANT);
    const b = await processLogoUpload(input, "image/png", TENANT);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.key).not.toBe(b.key);
  });
});
