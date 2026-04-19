const supported =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

const MODERN_ALIASES = [
  "Asia/Kolkata",
  "Asia/Yangon",
  "Asia/Ho_Chi_Minh",
  "Africa/Asmara",
  "Europe/Kyiv",
  "America/Nuuk",
];

export const IANA_TIMEZONES: readonly string[] = Object.freeze(
  Array.from(new Set([...supported, ...MODERN_ALIASES])).sort(),
);

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const lookup = new Set(IANA_TIMEZONES);

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  if (lookup.has(tz)) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
