import Redis from "ioredis";
import { env } from "../config/env";

declare global {
  var __redis: Redis | undefined;
  var __redisSub: Redis | undefined;
}

export function redis(): Redis {
  if (!globalThis.__redis) {
    globalThis.__redis = new Redis(env().REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  }
  return globalThis.__redis;
}

export function redisSub(): Redis {
  if (!globalThis.__redisSub) {
    globalThis.__redisSub = new Redis(env().REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
  }
  return globalThis.__redisSub;
}
