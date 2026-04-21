"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TenantHeader } from "@/components/tenant-branding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { en } from "@/lib/i18n/en";
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
  const t = en.host.queue;
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
          setTenantInfo((info) => ({ ...info, isOpen: true }));
          return;
        case "tenant:closed":
          setTenantInfo((info) => ({ ...info, isOpen: false }));
          return;
        case "tenant:reset":
          router.refresh();
          return;
        case "tenant:updated":
          setTenantInfo((info) => ({
            ...info,
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
          const label = action === "seat" ? t.seated : t.removed;
          toast.success(label, {
            duration: UNDO_TOAST_DURATION_MS,
            action: {
              label: t.undo,
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
        toast.error("Network hiccup. Try again.");
      } finally {
        setActingOn(null);
      }
    },
    [actingOn, slug, router, t.seated, t.removed, t.undo],
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
          toast.error("Couldn\u2019t update queue state.");
          return;
        }
        toast.success(next ? "Queue opened." : "Queue closed.");
      } catch {
        toast.error("Network hiccup.");
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
      className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6 py-10"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <TenantHeader
            name={tenantInfo.name}
            logoUrl={tenantInfo.logoUrl}
            accentColor={tenantInfo.accentColor}
          />
          <Button
            type="button"
            variant={tenantInfo.isOpen ? "outline" : "default"}
            size="sm"
            disabled={toggleBusy}
            onClick={onToggleClick}
            aria-label={
              tenantInfo.isOpen ? t.closeConfirm.title : t.openConfirm.title
            }
          >
            {tenantInfo.isOpen ? t.open : t.closed}
          </Button>
        </div>
        <nav className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/host/${encodeURIComponent(slug)}/guests`}>
              {en.host.nav.guests}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/host/${encodeURIComponent(slug)}/settings`}>
              {en.host.nav.settings}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            {en.host.nav.signOut}
          </Button>
        </nav>
      </header>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-muted-foreground"
      >
        {reconnecting ? "Reconnecting\u2026" : ""}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {t.waitingHeading} ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
            <Image
              src="/images/empty-states/empty-states-queue.svg"
              alt=""
              width={80}
              height={80}
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((party, i) => (
              <li key={party.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <CardTitle className="text-lg">{party.name}</CardTitle>
                        {party.phone ? (
                          <Badge variant="secondary">phone</Badge>
                        ) : null}
                      </div>
                      <CardDescription>
                        Party of {party.partySize} &middot; waiting{" "}
                        {formatElapsed(
                          now - new Date(party.joinedAt).getTime(),
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actingOn === party.id}
                        onClick={() => void actOn(party.id, "seat")}
                      >
                        {t.seat}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingOn === party.id}
                        onClick={() => void actOn(party.id, "remove")}
                      >
                        {t.remove}
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {t.resolvedHeading} ({visibleResolved.length})
        </h2>
        {visibleResolved.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing resolved in the last 30 minutes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleResolved.map((row) => {
              const elapsed = now - new Date(row.resolvedAt).getTime();
              const undoOpen = elapsed < 60_000;
              return (
                <li key={row.id}>
                  <Card className="bg-muted/40">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {row.name}
                          </CardTitle>
                          <Badge variant={badgeVariantForStatus(row.status)}>
                            {labelForStatus(row.status)}
                          </Badge>
                        </div>
                        <CardDescription>
                          Party of {row.partySize} &middot;{" "}
                          {formatElapsed(elapsed)} ago
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!undoOpen}
                        onClick={() => void handleUndoFromResolved(row.id)}
                      >
                        {t.undo}
                      </Button>
                    </CardHeader>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={closeConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setCloseConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.closeConfirm.title}</DialogTitle>
            <DialogDescription>{t.closeConfirm.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={toggleBusy}
              onClick={() => setCloseConfirmOpen(false)}
            >
              {t.closeConfirm.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={toggleBusy}
              onClick={() => void performToggle(false)}
            >
              {toggleBusy ? "Closing\u2026" : t.closeConfirm.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      toast.success(en.host.queue.undone);
    } else if (res.status === 409) {
      toast.error("Too late to undo.");
    } else if (res.status === 401) {
      toast.error("Session expired. Sign in again.");
    } else {
      toast.error("Couldn\u2019t undo.");
    }
  } catch {
    toast.error("Network hiccup.");
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

function badgeVariantForStatus(
  status: PartyStatus,
): "success" | "warning" | "secondary" {
  if (status === "seated") return "success";
  if (status === "no_show") return "warning";
  return "secondary";
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
