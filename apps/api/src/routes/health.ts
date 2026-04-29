import { Router } from "express";
import { sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { redis } from "@pila/shared/infra/redis/client";

import { asyncHandler } from "../lib/async-handler.js";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    try {
      await getDb().execute(sql`SELECT 1`);
      const pong = await redis().ping();
      if (pong !== "PONG") throw new Error("redis unhealthy");
      res.json({ ok: true });
    } catch (err) {
      res.status(503).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }),
);
