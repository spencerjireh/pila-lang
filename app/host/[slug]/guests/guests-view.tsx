"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  GuestHistoryPage,
  GuestHistoryRow,
} from "@/lib/parties/guest-history";
import { formatInTenantTz } from "@/lib/time/format-in-tenant-tz";

interface Props {
  slug: string;
  tenantName: string;
  timezone: string;
  initial: GuestHistoryPage;
}

export function GuestsView({ slug, tenantName, timezone, initial }: Props) {
  const [rows, setRows] = useState<GuestHistoryRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/guests?cursor=${encodeURIComponent(cursor)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError("Could not load more.");
        return;
      }
      const body = (await res.json()) as GuestHistoryPage;
      setRows((prev) => {
        const existingIds = new Set(prev.map((r) => r.phone));
        const unique = body.rows.filter((r) => !existingIds.has(r.phone));
        return [...prev, ...unique];
      });
      setCursor(body.nextCursor);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [slug, cursor, loading]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !cursor) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    });
    io.observe(target);
    return () => io.disconnect();
  }, [loadMore, cursor]);

  const formatted = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        lastVisitLabel: formatInTenantTz(r.lastVisitAt, timezone),
      })),
    [rows, timezone],
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Guests</h1>
          <p className="text-sm text-slate-600">
            Phone-grouped history for {tenantName}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/host/${encodeURIComponent(slug)}/queue`}>
            Back to queue
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No guests with a phone number on file yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {formatted.map((row) => (
            <li
              key={row.phone}
              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{row.lastName}</p>
                <p className="text-sm text-slate-500">{row.phone}</p>
              </div>
              <div className="text-sm text-slate-600 sm:text-right">
                <p>
                  {row.visitCount} {row.visitCount === 1 ? "visit" : "visits"}
                </p>
                <p className="text-xs text-slate-500">
                  last seen {row.lastVisitLabel}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
      {loading ? (
        <p className="text-center text-sm text-slate-500" aria-live="polite">
          Loading…
        </p>
      ) : null}
    </main>
  );
}
