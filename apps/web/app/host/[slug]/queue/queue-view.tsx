"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TenantHeader } from "@/components/tenant-branding";
import { Button } from "@/components/ui/button";
import type { PartyStatus } from "@pila/db/schema";
import type {
  HostRecentlyResolvedRow,
  HostSnapshotEvent,
  HostStreamDiff,
  HostStreamEvent,
  HostWaitingRow,
} from "@pila/shared/parties/host-stream";

interface QueueViewProps {
  slug: string;
  initialSnapshot: HostSnapshotEvent;
}

const RECENTLY_RESOLVED_WINDOW_MS = 30 * 60 * 1000;
const UNDO_TOAST_DURATION_MS = 5_000;

export function QueueView({ slug, initialSnapshot }: QueueViewProps) {
  const router = useRouter();
  const [tenantInfo, setTenantInfo] = useState(initialSnapshot.tenant);
  const [waiting, setWaiting] = useState<HostWaitingRow[]>(
    initialSnapshot.waiting,
  );
  const [resolved, setResolved] = useState<HostRecentlyResolvedRow[]>(
    initialSnapshot.recentlyResolved,
  );
  const [reconnecting, setReconnecting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const url = `/api/host/${encodeURIComponent(slug)}/queue/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setReconnecting(false);
    es.onerror = () => setReconnecting(true);
    es.onmessage = (msg) => {
      let ev: HostStreamEvent;
      try {
        ev = JSON.parse(msg.data) as HostStreamEvent;
      } catch {
        return;
      }
      applyEvent(ev);
    };

    function applyEvent(ev: HostStreamEvent) {
      if (ev.type === "snapshot") {
        setTenantInfo(ev.tenant);
        setWaiting(ev.waiting);
        setResolved(ev.recentlyResolved);
        return;
      }
      applyDiff(ev);
    }

    function applyDiff(ev: HostStreamDiff) {
      switch (ev.type) {
        case "party:joined":
          setWaiting((prev) => {
            if (prev.some((p) => p.id === ev.id)) return prev;
            const next: HostWaitingRow = {
              id: ev.id,
              name: ev.name,
              partySize: ev.partySize,
              phone: ev.phone,
              joinedAt: ev.joinedAt,
            };
            return [...prev, next].sort((a, b) =>
              a.joinedAt.localeCompare(b.joinedAt),
            );
          });
          return;
        case "party:seated":
        case "party:removed":
        case "party:left": {
          let removed: HostWaitingRow | undefined;
          setWaiting((prev) => {
            removed = prev.find((p) => p.id === ev.id);
            return prev.filter((p) => p.id !== ev.id);
          });
          if (removed) {
            const row: HostRecentlyResolvedRow = {
              id: ev.id,
              name: removed.name,
              partySize: removed.partySize,
              status: ev.status,
              resolvedAt: ev.resolvedAt,
            };
            setResolved((prev) => dedupeResolved([row, ...prev]));
          } else {
            setResolved((prev) =>
              prev.map((r) =>
                r.id === ev.id
                  ? { ...r, status: ev.status, resolvedAt: ev.resolvedAt }
                  : r,
              ),
            );
          }
          return;
        }
        case "party:restored":
          setResolved((prev) => prev.filter((r) => r.id !== ev.id));
          setWaiting((prev) => {
            if (prev.some((p) => p.id === ev.id)) return prev;
            const next: HostWaitingRow = {
              id: ev.id,
              name: ev.name,
              partySize: ev.partySize,
              phone: ev.phone,
              joinedAt: ev.joinedAt,
            };
            return [...prev, next].sort((a, b) =>
              a.joinedAt.localeCompare(b.joinedAt),
            );
          });
          return;
        case "tenant:opened":
          setTenantInfo((t) => ({ ...t, isOpen: true }));
          return;
        case "tenant:closed":
          setTenantInfo((t) => ({ ...t, isOpen: false }));
          return;
        case "tenant:reset":
          router.refresh();
          return;
        case "tenant:updated":
          setTenantInfo((t) => ({
            ...t,
            ...(ev.name !== undefined ? { name: ev.name } : {}),
            ...(ev.logoUrl !== undefined ? { logoUrl: ev.logoUrl } : {}),
            ...(ev.accentColor !== undefined
              ? { accentColor: ev.accentColor }
              : {}),
          }));
          return;
      }
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [slug, router]);

  const visibleResolved = useMemo(
    () =>
      resolved.filter(
        (r) =>
          now - new Date(r.resolvedAt).getTime() < RECENTLY_RESOLVED_WINDOW_MS,
      ),
    [resolved, now],
  );

  const actOn = useCallback(
    async (partyId: string, action: "seat" | "remove") => {
      if (actingOn) return;
      setActingOn(partyId);
      try {
        const res = await fetch(
          `/api/host/${encodeURIComponent(slug)}/parties/${encodeURIComponent(partyId)}/${action}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (res.ok) {
          const label = action === "seat" ? "Seated" : "Removed";
          toast.success(label, {
            duration: UNDO_TOAST_DURATION_MS,
            action: {
              label: "Undo",
              onClick: () => {
                void undoLatest(slug);
              },
            },
          });
        } else if (res.status === 409) {
          toast.error("Already handled on another device.");
        } else if (res.status === 401) {
          router.replace(`/host/${encodeURIComponent(slug)}`);
        } else {
          toast.error("Something went wrong. Try again.");
        }
      } catch {
        toast.error("Network error. Try again.");
      } finally {
        setActingOn(null);
      }
    },
    [actingOn, slug, router],
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`/api/host/${encodeURIComponent(slug)}/logout`, {
        method: "POST",
      });
    } catch {
      // fall through
    }
    router.replace(`/host/${encodeURIComponent(slug)}`);
  }, [slug, router]);

  const [toggleBusy, setToggleBusy] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const performToggle = useCallback(
    async (next: boolean) => {
      if (toggleBusy) return;
      setToggleBusy(true);
      try {
        const route = next ? "open" : "close";
        const res = await fetch(
          `/api/host/${encodeURIComponent(slug)}/${route}`,
          { method: "POST" },
        );
        if (res.status === 401) {
          router.replace(`/host/${encodeURIComponent(slug)}`);
          return;
        }
        if (!res.ok) {
          toast.error("Could not update queue state.");
          return;
        }
        toast.success(next ? "Queue opened." : "Queue closed.");
      } catch {
        toast.error("Network error.");
      } finally {
        setToggleBusy(false);
        setCloseConfirmOpen(false);
      }
    },
    [slug, router, toggleBusy],
  );

  const onToggleClick = useCallback(() => {
    if (tenantInfo.isOpen) {
      setCloseConfirmOpen(true);
    } else {
      void performToggle(true);
    }
  }, [tenantInfo.isOpen, performToggle]);

  const handleUndoFromResolved = useCallback(
    async (partyId: string) => {
      const row = resolved.find((r) => r.id === partyId);
      if (!row) return;
      const elapsed = now - new Date(row.resolvedAt).getTime();
      if (elapsed > 60_000) {
        toast.error("Too late to undo.");
        return;
      }
      await undoLatest(slug);
    },
    [resolved, now, slug],
  );

  return (
    <main
      lang="en"
      className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <TenantHeader
            name={tenantInfo.name}
            logoUrl={tenantInfo.logoUrl}
            accentColor={tenantInfo.accentColor}
          />
          <button
            type="button"
            disabled={toggleBusy}
            onClick={onToggleClick}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              tenantInfo.isOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={tenantInfo.isOpen ? "Close queue" : "Open queue"}
          >
            {tenantInfo.isOpen ? "Accepting guests" : "Closed"}
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/host/${encodeURIComponent(slug)}/guests`}>
              Guests
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/host/${encodeURIComponent(slug)}/settings`}>
              Settings
            </Link>
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      {closeConfirmOpen ? (
        <div
          role="alertdialog"
          aria-label="Close queue?"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <div>
            <p className="text-sm font-medium">Close the queue?</p>
            <p className="text-xs text-slate-600">
              New guests will see a closed banner. Waiting parties are not
              affected.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={toggleBusy}
              onClick={() => void performToggle(false)}
            >
              {toggleBusy ? "Closing…" : "Yes, close"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={toggleBusy}
              onClick={() => setCloseConfirmOpen(false)}
            >
              Keep open
            </Button>
          </div>
        </div>
      ) : null}

      <div
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-slate-500"
      >
        {reconnecting ? "Reconnecting…" : ""}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Waiting ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No one waiting right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((party, i) => (
              <li
                key={party.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="font-medium">{party.name}</span>
                    <span className="text-sm text-slate-500">
                      &middot; party of {party.partySize}
                    </span>
                    {party.phone ? (
                      <span
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        aria-label="phone on file"
                      >
                        phone
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    waited{" "}
                    {formatElapsed(now - new Date(party.joinedAt).getTime())}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={actingOn === party.id}
                    onClick={() => void actOn(party.id, "seat")}
                  >
                    Seat
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actingOn === party.id}
                    onClick={() => void actOn(party.id, "remove")}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Recently resolved ({visibleResolved.length})
        </h2>
        {visibleResolved.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Nothing resolved in the last 30 minutes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleResolved.map((row) => {
              const elapsed = now - new Date(row.resolvedAt).getTime();
              const undoOpen = elapsed < 60_000;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-sm text-slate-500">
                        &middot; party of {row.partySize}
                      </span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                        {labelForStatus(row.status)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatElapsed(elapsed)} ago
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!undoOpen}
                    onClick={() => void handleUndoFromResolved(row.id)}
                  >
                    Undo
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

async function undoLatest(slug: string) {
  try {
    const res = await fetch(`/api/host/${encodeURIComponent(slug)}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      toast.success("Undone.");
    } else if (res.status === 409) {
      toast.error("Too late to undo.");
    } else if (res.status === 401) {
      toast.error("Session expired. Please sign in again.");
    } else {
      toast.error("Could not undo.");
    }
  } catch {
    toast.error("Network error.");
  }
}

function dedupeResolved(
  rows: HostRecentlyResolvedRow[],
): HostRecentlyResolvedRow[] {
  const seen = new Set<string>();
  const out: HostRecentlyResolvedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function labelForStatus(status: PartyStatus): string {
  switch (status) {
    case "seated":
      return "seated";
    case "no_show":
      return "removed";
    case "left":
      return "left";
    default:
      return status;
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
