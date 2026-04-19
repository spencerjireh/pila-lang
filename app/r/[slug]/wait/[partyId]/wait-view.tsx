"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TenantHeader } from "@/components/tenant-branding";
import { Button } from "@/components/ui/button";
import type { PartyStatus } from "@/lib/db/schema";
import type { GuestStreamEvent } from "@/lib/parties/stream-events";

interface InitialTenant {
  name: string;
  logoUrl: string | null;
  accentColor: string;
  isOpen: boolean;
}

interface WaitViewProps {
  slug: string;
  initialTenant: InitialTenant;
  partyId: string;
  partyName: string;
  partySize: number;
  initialStatus: PartyStatus;
  initialPosition: number;
  joinedAt: string;
}

type Terminal = "seated" | "left" | "session_ended";

export function WaitView({
  slug,
  initialTenant,
  partyId,
  partyName,
  partySize,
  initialStatus,
  initialPosition,
  joinedAt,
}: WaitViewProps) {
  const [tenant, setTenant] = useState<InitialTenant>(initialTenant);
  const [position, setPosition] = useState(initialPosition);
  const [terminal, setTerminal] = useState<Terminal | null>(
    terminalFromStatus(initialStatus),
  );
  const [reconnecting, setReconnecting] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const match = document.cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("welcome_back="));
    if (match && match.endsWith("=1")) {
      setWelcomeBack(true);
      document.cookie = "welcome_back=; Max-Age=0; Path=/; SameSite=Lax";
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminal) return;
    const url = `/api/r/${encodeURIComponent(slug)}/parties/${encodeURIComponent(partyId)}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setReconnecting(false);
    es.onerror = () => setReconnecting(true);
    es.onmessage = (msg) => {
      let ev: GuestStreamEvent | null = null;
      try {
        ev = JSON.parse(msg.data) as GuestStreamEvent;
      } catch {
        return;
      }
      if (ev.type === "snapshot") {
        setPosition(ev.position);
        const t = terminalFromStatus(ev.status);
        if (t) {
          setTerminal(t);
          es.close();
        }
      } else if (ev.type === "position_changed") {
        setPosition(ev.position);
      } else if (ev.type === "status_changed") {
        const t = terminalFromStatus(ev.status);
        if (t) {
          setTerminal(t);
          es.close();
        }
      } else if (ev.type === "tenant:updated") {
        setTenant((prev) => ({
          ...prev,
          ...(ev.name !== undefined ? { name: ev.name } : {}),
          ...(ev.logoUrl !== undefined ? { logoUrl: ev.logoUrl } : {}),
          ...(ev.accentColor !== undefined ? { accentColor: ev.accentColor } : {}),
        }));
      } else if (ev.type === "tenant:opened") {
        setTenant((prev) => ({ ...prev, isOpen: true }));
      } else if (ev.type === "tenant:closed") {
        setTenant((prev) => ({ ...prev, isOpen: false }));
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [slug, partyId, terminal]);

  const joinedAtMs = useMemo(() => new Date(joinedAt).getTime(), [joinedAt]);
  const waitedLabel = formatElapsed(Math.max(0, now - joinedAtMs));

  async function onConfirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await fetch(
        `/api/r/${encodeURIComponent(slug)}/parties/${encodeURIComponent(partyId)}/leave`,
        { method: "POST" },
      );
      if (res.ok || res.status === 409) {
        setTerminal("left");
        esRef.current?.close();
        return;
      }
      setLeaveError("Could not leave right now. Please try again.");
    } catch {
      setLeaveError("Network error. Please try again.");
    } finally {
      setLeaving(false);
    }
  }

  if (terminal === "seated") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          title="Your table is ready"
          body={`Head to the host at ${tenant.name}.`}
          tone="success"
        />
      </WaitShell>
    );
  }
  if (terminal === "left") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          title="You've left the queue"
          body="You can scan the QR code again if you change your mind."
          tone="neutral"
        />
      </WaitShell>
    );
  }
  if (terminal === "session_ended") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          title="Your session has ended"
          body="This wait session is no longer active."
          tone="neutral"
        />
      </WaitShell>
    );
  }

  return (
    <WaitShell tenant={tenant}>
      {welcomeBack ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
        >
          Welcome back, {partyName}.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Hi {partyName}</p>
        <p className="mt-1 text-sm text-slate-500">
          Party of {partySize} &middot; waiting {waitedLabel}
        </p>
        <div
          className="mt-5 flex items-baseline gap-2"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="text-5xl font-semibold tabular-nums">{position}</span>
          <span className="text-slate-600">
            {position === 1 ? "you're next" : "in line"}
          </span>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem] text-sm text-slate-500">
        {reconnecting ? "Reconnecting…" : ""}
      </div>

      {confirmLeave ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm">Leave the queue?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={leaving}
              onClick={onConfirmLeave}
            >
              {leaving ? "Leaving…" : "Yes, leave"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={leaving}
              onClick={() => {
                setConfirmLeave(false);
                setLeaveError(null);
              }}
            >
              Stay
            </Button>
          </div>
          {leaveError ? (
            <p className="text-xs text-red-600" role="alert">
              {leaveError}
            </p>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmLeave(true)}
        >
          Leave queue
        </Button>
      )}
    </WaitShell>
  );
}

function WaitShell({
  tenant,
  children,
}: {
  tenant: InitialTenant;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <TenantHeader
        name={tenant.name}
        logoUrl={tenant.logoUrl}
        accentColor={tenant.accentColor}
      />
      {children}
    </section>
  );
}

function TerminalCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "success" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : "border-slate-200 bg-slate-50";
  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-2xl border p-8 text-center ${toneClass}`}
    >
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="text-slate-600">{body}</p>
    </section>
  );
}

function terminalFromStatus(status: PartyStatus): Terminal | null {
  if (status === "seated") return "seated";
  if (status === "left") return "left";
  if (status === "no_show") return "session_ended";
  return null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
