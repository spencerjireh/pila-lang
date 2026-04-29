import type { Response } from "express";

import {
  consume,
  RateLimitError,
  type LimiterName,
} from "@pila/shared/infra/ratelimit/index";

export interface RateLimitBucket {
  bucket: LimiterName;
  key: string;
  points?: number;
}

/**
 * Express-shaped wrapper around the shared rate-limit consume(). On hit,
 * writes a canonical 429 with `Retry-After` and returns true so the caller
 * can early-exit.
 */
export async function enforceRateLimits(
  res: Response,
  buckets: readonly RateLimitBucket[],
): Promise<boolean> {
  try {
    for (const b of buckets) await consume(b.bucket, b.key, b.points ?? 1);
    return false;
  } catch (err) {
    if (err instanceof RateLimitError) {
      res.setHeader("Retry-After", String(err.retryAfterSec));
      res
        .status(429)
        .json({ error: "rate_limited", retryAfterSec: err.retryAfterSec });
      return true;
    }
    throw err;
  }
}
