import { rateLimitResponse } from "../../infra/http/client-ip";

import { RateLimitError, consume, type LimiterName } from "./index";

export interface RateLimitBucket {
  bucket: LimiterName;
  key: string;
  /** Points to consume; defaults to 1. */
  points?: number;
}

/**
 * Consume each bucket in order. Returns a canonical 429 Response if any
 * bucket trips the limit; returns null when all buckets accept the request.
 * Any non-RateLimitError rethrows so infra failures surface as 500s.
 *
 * Example:
 *   const limited = await enforceRateLimit([
 *     { bucket: "loginPerIp", key: ip },
 *     { bucket: "loginPerSlug", key: slug },
 *   ]);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  buckets: readonly RateLimitBucket[],
): Promise<Response | null> {
  try {
    for (const b of buckets) await consume(b.bucket, b.key, b.points ?? 1);
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err.retryAfterSec);
    }
    throw err;
  }
}
