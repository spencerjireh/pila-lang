export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "r",
  "host",
  "display",
  "www",
  "public",
  "static",
  "_next",
  "well-known",
  "health",
]);

export type SlugValidation =
  | { ok: true }
  | { ok: false; reason: "pattern" | "reserved" };

export function validateSlug(slug: string): SlugValidation {
  if (!SLUG_PATTERN.test(slug)) return { ok: false, reason: "pattern" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "reserved" };
  return { ok: true };
}
