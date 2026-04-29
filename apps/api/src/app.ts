import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import pinoHttp from "pino-http";

import { env } from "@pila/shared/primitives/config/env";

import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./lib/error-middleware.js";
import { v1Router } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(pinoHttp({ logger }));

  app.use(cookieParser());

  // SSE responses must not be buffered. Compression buffers chunks until
  // the threshold or close, breaking the live stream invariant.
  app.use(
    compression({
      filter(req, res) {
        if (
          res
            .getHeader("Content-Type")
            ?.toString()
            .includes("text/event-stream")
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Locked to the web app's origin. Same-origin in prod via Traefik means
  // CORS is rarely exercised, but the explicit allowlist guards against
  // accidental cross-origin reads if a misconfig sneaks in.
  app.use(
    cors({
      origin: env().APP_BASE_URL,
      credentials: true,
    }),
  );

  // Default JSON parser (1MB). Multipart routes (e.g., logo upload) opt out
  // by mounting their own parser before this hits.
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
