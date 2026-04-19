import { redis } from "../redis/client";

export type UndoAction = "seat" | "remove";
export type UndoablePreviousStatus = "waiting";

export interface UndoFrame {
  action: UndoAction;
  partyId: string;
  previousStatus: UndoablePreviousStatus;
  timestamp: number;
}

export const UNDO_WINDOW_MS = 60_000;
export const UNDO_KEY_TTL_SECONDS = 5 * 60;

export function undoKey(tenantId: string): string {
  return `undo:tenant:${tenantId}`;
}

export function isWithinUndoWindow(
  frame: UndoFrame,
  now: number = Date.now(),
): boolean {
  return now - frame.timestamp <= UNDO_WINDOW_MS;
}

export function parseFrame(
  payload: string | null | undefined,
): UndoFrame | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<UndoFrame>;
    if (
      (parsed.action !== "seat" && parsed.action !== "remove") ||
      typeof parsed.partyId !== "string" ||
      parsed.partyId.length === 0 ||
      parsed.previousStatus !== "waiting" ||
      typeof parsed.timestamp !== "number"
    ) {
      return null;
    }
    return parsed as UndoFrame;
  } catch {
    return null;
  }
}

export async function pushUndoFrame(
  tenantId: string,
  frame: UndoFrame,
): Promise<void> {
  const key = undoKey(tenantId);
  const client = redis();
  await client.lpush(key, JSON.stringify(frame));
  await client.expire(key, UNDO_KEY_TTL_SECONDS);
}

export async function popUndoFrame(
  tenantId: string,
): Promise<UndoFrame | null> {
  const payload = await redis().lpop(undoKey(tenantId));
  return parseFrame(payload);
}
