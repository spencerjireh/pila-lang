export const HEX_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
export const AA_THRESHOLD = 4.5;

export type ContrastValidation =
  | { ok: true; blackRatio: number; whiteRatio: number }
  | { ok: false; reason: "format" | "contrast"; blackRatio?: number; whiteRatio?: number };

export function parseHex(hex: string): [number, number, number] | null {
  if (!HEX_PATTERN.test(hex)) return null;
  const h = hex.slice(1);
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateAccentColor(hex: string): ContrastValidation {
  const rgb = parseHex(hex);
  if (!rgb) return { ok: false, reason: "format" };
  const blackRatio = contrastRatio(rgb, [0, 0, 0]);
  const whiteRatio = contrastRatio(rgb, [255, 255, 255]);
  if (blackRatio < AA_THRESHOLD && whiteRatio < AA_THRESHOLD) {
    return { ok: false, reason: "contrast", blackRatio, whiteRatio };
  }
  return { ok: true, blackRatio, whiteRatio };
}

export function pickForeground(hex: string): "#000000" | "#ffffff" {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const blackRatio = contrastRatio(rgb, [0, 0, 0]);
  const whiteRatio = contrastRatio(rgb, [255, 255, 255]);
  return blackRatio >= whiteRatio ? "#000000" : "#ffffff";
}
