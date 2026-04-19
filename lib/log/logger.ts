import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface Ctx {
  requestId: string;
}

const als = new AsyncLocalStorage<Ctx>();

export function withRequestId<T>(fn: () => T, requestId: string = randomUUID()): T {
  return als.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

function write(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const record = {
    t: new Date().toISOString(),
    level,
    msg,
    requestId: currentRequestId(),
    ...fields,
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};

export function formatError(err: unknown): string {
  const lines: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur && depth < 5) {
    if (cur instanceof Error) {
      lines.push(`${depth === 0 ? "" : "caused by: "}${cur.name}: ${cur.message}`);
      if (cur.stack) lines.push(cur.stack.split("\n").slice(1).join("\n"));
      cur = (cur as { cause?: unknown }).cause;
    } else {
      lines.push(String(cur));
      break;
    }
    depth++;
  }
  return lines.join("\n");
}
