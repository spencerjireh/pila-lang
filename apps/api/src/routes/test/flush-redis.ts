import { Router } from "express";

import { redis } from "@pila/shared/infra/redis/client";

export const testFlushRedisRouter = Router();

testFlushRedisRouter.post("/test/flush-redis", async (_req, res) => {
  await redis().flushall();
  res.json({ ok: true });
});
