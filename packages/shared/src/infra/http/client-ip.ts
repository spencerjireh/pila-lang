import { errorResponse } from "./error-response";

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return errorResponse(429, "rate_limited", { retryAfterSec });
}
