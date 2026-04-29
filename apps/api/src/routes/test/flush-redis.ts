import { Router } from "express";

import { redis } from "@pila/shared/infra/redis/client";

import { asyncHandler } from "../../lib/async-handler.js";

export const testFlushRedisRouter = Router();

testFlushRedisRouter.post(
  "/test/flush-redis",
  asyncHandler(async (_req, res) => {
    await redis().flushall();
    res.json({ ok: true });
  }),
);
