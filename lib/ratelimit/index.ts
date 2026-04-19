import { RateLimiterRedis, RateLimiterMemory, type IRateLimiterOptions, type RateLimiterAbstract, type RateLimiterRes } from "rate-limiter-flexible";
import { redis } from "@/lib/redis/client";

export class RateLimitError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(`rate limited; retry after ${retryAfterSec}s`);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export type LimiterName =
  | "displayRequestsPerIp"
  | "joinPerPhone"
  | "joinPerIp"
  | "joinGlobalPerTenant"
  | "guestStreamPerIp"
  | "hostStreamPerIpSlug"
  | "loginPerIp"
  | "loginPerSlug";

interface Policy {
  points: number;
  durationSec: number;
}

const POLICIES: Record<LimiterName, Policy> = {
  displayRequestsPerIp: { points: 30, durationSec: 60 },
  joinPerPhone: { points: 10, durationSec: 60 * 60 },
  joinPerIp: { points: 10, durationSec: 60 * 60 },
  joinGlobalPerTenant: { points: 200, durationSec: 60 * 60 },
  guestStreamPerIp: { points: 10, durationSec: 60 },
  hostStreamPerIpSlug: { points: 30, durationSec: 60 },
  loginPerIp: { points: 10, durationSec: 60 * 60 },
  loginPerSlug: { points: 20, durationSec: 60 * 60 },
};

const CACHE = new Map<LimiterName, RateLimiterAbstract>();

function build(name: LimiterName, opts?: { useMemory?: boolean }): RateLimiterAbstract {
  const policy = POLICIES[name];
  const base: IRateLimiterOptions = {
    keyPrefix: `rl:${name}`,
    points: policy.points,
    duration: policy.durationSec,
  };
  if (opts?.useMemory) {
    return new RateLimiterMemory(base);
  }
  return new RateLimiterRedis({ ...base, storeClient: redis() });
}

export function getLimiter(name: LimiterName, opts?: { useMemory?: boolean }): RateLimiterAbstract {
  let l = CACHE.get(name);
  if (!l) {
    l = build(name, opts);
    CACHE.set(name, l);
  }
  return l;
}

export function _resetForTests() {
  CACHE.clear();
}

export async function consume(name: LimiterName, key: string, points: number = 1): Promise<void> {
  try {
    await getLimiter(name).consume(key, points);
  } catch (err) {
    const res = err as RateLimiterRes;
    if (res && typeof res.msBeforeNext === "number") {
      throw new RateLimitError(Math.ceil(res.msBeforeNext / 1000));
    }
    throw err;
  }
}

export function policy(name: LimiterName): Readonly<Policy> {
  return POLICIES[name];
}
