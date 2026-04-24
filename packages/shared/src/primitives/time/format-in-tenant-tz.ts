export function formatInTenantTz(
  instant: Date | string,
  timezone: string,
  style: "datetime" | "date" = "datetime",
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions =
    style === "date"
      ? { timeZone: timezone, dateStyle: "medium" }
      : { timeZone: timezone, dateStyle: "medium", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: opts.dateStyle,
      timeStyle: opts.timeStyle,
    }).format(date);
  }
}
