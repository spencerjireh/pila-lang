import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";

export interface GuestHistoryCursor {
  lastVisitAt: string;
  phone: string;
}

export interface GuestHistoryRow {
  phone: string;
  lastName: string;
  visitCount: number;
  lastVisitAt: string;
}

export interface GuestHistoryPage {
  rows: GuestHistoryRow[];
  nextCursor: string | null;
}

export const GUEST_HISTORY_DEFAULT_LIMIT = 25;
export const GUEST_HISTORY_MAX_LIMIT = 100;

export function encodeCursor(cursor: GuestHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(
  raw: string | null | undefined,
): GuestHistoryCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.lastVisitAt === "string" &&
      typeof parsed.phone === "string"
    ) {
      return { lastVisitAt: parsed.lastVisitAt, phone: parsed.phone };
    }
    return null;
  } catch {
    return null;
  }
}

type RawRow = {
  phone: string;
  last_name: string;
  visit_count: string | number;
  last_visit_at: Date | string;
} & Record<string, unknown>;

export async function loadGuestHistory(
  tenantId: string,
  opts: { cursor?: GuestHistoryCursor | null; limit?: number } = {},
): Promise<GuestHistoryPage> {
  const limit = Math.min(
    Math.max(opts.limit ?? GUEST_HISTORY_DEFAULT_LIMIT, 1),
    GUEST_HISTORY_MAX_LIMIT,
  );
  const cursorAt = opts.cursor?.lastVisitAt ?? null;
  const cursorPhone = opts.cursor?.phone ?? null;

  const result = await getDb().execute<RawRow>(sql`
    WITH agg AS (
      SELECT phone,
             COUNT(*)::int AS visit_count,
             MAX(joined_at) AS last_visit_at
      FROM parties
      WHERE tenant_id = ${tenantId} AND phone IS NOT NULL
      GROUP BY phone
    )
    SELECT a.phone,
           p.name AS last_name,
           a.visit_count,
           a.last_visit_at
    FROM agg a
    JOIN LATERAL (
      SELECT name FROM parties
      WHERE tenant_id = ${tenantId} AND phone = a.phone
      ORDER BY joined_at DESC
      LIMIT 1
    ) p ON true
    WHERE (
      ${cursorAt}::timestamptz IS NULL
      OR a.last_visit_at < ${cursorAt}::timestamptz
      OR (a.last_visit_at = ${cursorAt}::timestamptz AND a.phone < ${cursorPhone})
    )
    ORDER BY a.last_visit_at DESC, a.phone DESC
    LIMIT ${limit}
  `);

  const raw: RawRow[] = Array.isArray(result)
    ? (result as RawRow[])
    : ((result as { rows: RawRow[] }).rows ?? []);

  const rows: GuestHistoryRow[] = raw.map((r) => ({
    phone: r.phone,
    lastName: r.last_name,
    visitCount: Number(r.visit_count),
    lastVisitAt: toIso(r.last_visit_at),
  }));

  const nextCursor =
    rows.length === limit
      ? encodeCursor({
          lastVisitAt: rows[rows.length - 1]!.lastVisitAt,
          phone: rows[rows.length - 1]!.phone,
        })
      : null;

  return { rows, nextCursor };
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}
