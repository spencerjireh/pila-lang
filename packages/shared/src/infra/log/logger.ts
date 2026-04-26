export type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const record = {
    t: new Date().toISOString(),
    level,
    msg,
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
  debug: (msg: string, fields?: Record<string, unknown>) =>
    write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) =>
    write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) =>
    write("error", msg, fields),
};
