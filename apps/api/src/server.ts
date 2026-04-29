import { env } from "@pila/shared/primitives/config/env";

import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

// Fail fast on bad env before binding the port.
env();

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port }, "api.listening");
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "api.shutdown.start");

  // Sprint 3 wires SSE drain (drainAll) and Redis subscriber close here.
  // For now: stop accepting new connections, then exit.
  server.close((err) => {
    if (err) {
      logger.error({ err: err.message }, "api.shutdown.server_close_failed");
      process.exit(1);
    }
    logger.info("api.shutdown.complete");
    process.exit(0);
  });

  // Hard cap so a stuck connection can't pin the process forever.
  setTimeout(() => {
    logger.warn("api.shutdown.forced_exit");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
