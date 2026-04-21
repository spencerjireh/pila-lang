"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { en } from "@/lib/i18n/en";
import type {
  GuestHistoryPage,
  GuestHistoryRow,
} from "@pila/shared/parties/guest-history";
import { formatInTenantTz } from "@pila/shared/time/format-in-tenant-tz";

interface Props {
  slug: string;
  tenantName: string;
  timezone: string;
  initial: GuestHistoryPage;
}

export function GuestsView({ slug, tenantName, timezone, initial }: Props) {
  const t = en.host.guests;
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
        setError("Couldn\u2019t load more.");
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
      setError("Network hiccup.");
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tenantName}
          </p>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Phone-grouped history. Repeat guests show their visit count.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/host/${encodeURIComponent(slug)}/queue`}>
            &larr; Back to queue
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {formatted.map((row) => (
            <li key={row.phone}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{row.lastName}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {row.phone}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground">
                      {row.visitCount}{" "}
                      {row.visitCount === 1 ? "visit" : "visits"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      last seen {row.lastVisitLabel}
                    </p>
                  </div>
                </CardHeader>
                <CardContent />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
      {loading ? (
        <p
          className="text-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading\u2026
        </p>
      ) : null}
    </main>
  );
}
