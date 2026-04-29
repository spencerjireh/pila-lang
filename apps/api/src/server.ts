import { env } from "@pila/shared/primitives/config/env";
import { redis, redisSub } from "@pila/shared/infra/redis/client";

import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { drainAll } from "./lib/sse-registry.js";

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

  // 1. Stop accepting new connections — server.close() is graceful (waits
  //    for in-flight requests). SSE connections are long-lived; drain them
  //    explicitly below.
  server.close();

  // 2. Drain SSE: send `server_shutdown` to every open stream, then close.
  try {
    await drainAll(20_000);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "api.shutdown.drain_failed",
    );
  }

  // 3. Close Redis (subscribe + publish/rate-limit). Quit waits for
  //    pending replies; if it stalls, the hard timeout below kicks in.
  try {
    await Promise.all([redisSub().quit(), redis().quit()]);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "api.shutdown.redis_quit_failed",
    );
  }

  logger.info("api.shutdown.complete");
  process.exit(0);
}

// Hard cap so a stuck connection can't pin the process forever.
function armForceExit(): void {
  setTimeout(() => {
    logger.warn("api.shutdown.forced_exit");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", (s) => {
  armForceExit();
  void shutdown(s);
});
process.on("SIGINT", (s) => {
  armForceExit();
  void shutdown(s);
});
