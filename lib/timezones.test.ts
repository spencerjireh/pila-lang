import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, IANA_TIMEZONES, isValidTimezone } from "./timezones";

describe("timezones", () => {
  it("exposes a sorted IANA list that includes common zones", () => {
    expect(IANA_TIMEZONES.length).toBeGreaterThan(100);
    expect(IANA_TIMEZONES).toContain("Asia/Kolkata");
    expect(IANA_TIMEZONES).toContain("America/New_York");
    expect(IANA_TIMEZONES).toContain("Europe/London");
    const sorted = [...IANA_TIMEZONES].sort();
    expect(IANA_TIMEZONES).toEqual(sorted);
  });

  it("uses Asia/Kolkata as the default", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
    expect(IANA_TIMEZONES).toContain(DEFAULT_TIMEZONE);
  });

  it("isValidTimezone accepts known IANA zones", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("isValidTimezone rejects garbage", () => {
    expect(isValidTimezone("not/a_zone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});
