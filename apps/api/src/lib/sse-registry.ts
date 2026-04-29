import type { SseHandle } from "@pila/shared/infra/sse/stream";

import { logger } from "./logger.js";

/**
 * Tracks every open SSE handle so SIGTERM can drain them: send a terminal
 * `server_shutdown` event, then close, before the http server stops accepting.
 * EventSource clients reconnect to the next replica (or this one after restart)
 * — without the terminal event they'd retry against a closed socket and burn
 * a few seconds in the failed-connection backoff.
 */
const handles = new Set<SseHandle>();

export function register(handle: SseHandle): void {
  handles.add(handle);
}

export function unregister(handle: SseHandle): void {
  handles.delete(handle);
}

export function activeCount(): number {
  return handles.size;
}

export async function drainAll(timeoutMs: number): Promise<void> {
  const start = Date.now();
  const all = Array.from(handles);
  if (all.length === 0) return;

  logger.info({ count: all.length }, "sse.drain.start");

  for (const h of all) {
    try {
      h.close({
        event: "server_shutdown",
        data: { reason: "deploy" },
      });
    } catch {
      // best effort
    }
    handles.delete(h);
    if (Date.now() - start > timeoutMs) {
      logger.warn(
        { remaining: handles.size, elapsedMs: Date.now() - start },
        "sse.drain.timed_out",
      );
      return;
    }
  }

  logger.info(
    { closed: all.length, elapsedMs: Date.now() - start },
    "sse.drain.complete",
  );
}
