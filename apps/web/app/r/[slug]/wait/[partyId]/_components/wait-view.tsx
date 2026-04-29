"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { TenantHeader } from "@/components/tenant-branding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { applyTenantEvent } from "@/lib/sse/apply-tenant-event";
import { useLiveStream } from "@/lib/sse/use-live-stream";
import { formatElapsed } from "@/lib/time";
import type { PartyStatus } from "@pila/db/schema";
import type { GuestStreamEvent } from "@pila/shared/domain/parties/stream-events";

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
  const t = en.guest.wait;
  const [tenant, setTenant] = useState<InitialTenant>(initialTenant);
  const [position, setPosition] = useState(initialPosition);
  const [terminal, setTerminal] = useState<Terminal | null>(
    terminalFromStatus(initialStatus),
  );
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  const onStreamEvent = useCallback((ev: GuestStreamEvent) => {
    if (ev.type === "snapshot") {
      setPosition(ev.position);
      const term = terminalFromStatus(ev.status);
      if (term) setTerminal(term);
      return;
    }
    if (ev.type === "position_changed") {
      setPosition(ev.position);
      return;
    }
    if (ev.type === "status_changed") {
      const term = terminalFromStatus(ev.status);
      if (term) setTerminal(term);
      return;
    }
    setTenant((prev) => {
      const outcome = applyTenantEvent(prev, ev);
      return outcome.kind === "patched" ? outcome.state : prev;
    });
  }, []);
  const { reconnecting, close: closeStream } = useLiveStream<GuestStreamEvent>({
    url: `/api/v1/r/${encodeURIComponent(slug)}/parties/${encodeURIComponent(partyId)}/stream`,
    onEvent: onStreamEvent,
    enabled: !terminal,
  });

  const joinedAtMs = useMemo(() => new Date(joinedAt).getTime(), [joinedAt]);
  const waitedLabel = formatElapsed(Math.max(0, now - joinedAtMs));

  const onConfirmLeave = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await fetch(
        `/api/v1/r/${encodeURIComponent(slug)}/parties/${encodeURIComponent(partyId)}/leave`,
        { method: "POST" },
      );
      if (res.ok || res.status === 409) {
        setTerminal("left");
        closeStream();
        setConfirmLeave(false);
        return;
      }
      setLeaveError("Couldn\u2019t leave right now. Try again.");
    } catch {
      setLeaveError("Network hiccup. Try again.");
    } finally {
      setLeaving(false);
    }
  }, [leaving, slug, partyId, closeStream]);

  if (terminal === "seated") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          eyebrow={en.designSystem.voice.seated}
          title={t.tableReady}
          body={t.tableReadyBody.replace("the host stand", `${tenant.name}`)}
        />
      </WaitShell>
    );
  }
  if (terminal === "left") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          eyebrow="Left the queue"
          title={en.designSystem.voice.seeYouSoon}
          body="Scan the QR again any time you change your mind."
        />
      </WaitShell>
    );
  }
  if (terminal === "session_ended") {
    return (
      <WaitShell tenant={tenant}>
        <TerminalCard
          eyebrow="Session ended"
          title={t.removed.title}
          body={t.removed.body}
        />
      </WaitShell>
    );
  }

  return (
    <WaitShell tenant={tenant}>
      {welcomeBack ? (
        <Alert>
          <AlertTitle>Welcome back, {partyName}.</AlertTitle>
          <AlertDescription>
            We held your spot. Position updates live below.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardDescription className="font-mono text-xs uppercase tracking-wide">
            {t.eyebrow}
          </CardDescription>
          <CardTitle className="font-display text-2xl">
            Hi {partyName}
          </CardTitle>
          <CardDescription>
            Party of {partySize} &middot; waiting {waitedLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-baseline gap-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="font-display text-7xl font-semibold tabular-nums text-foreground">
              {position}
            </span>
            <span className="text-muted-foreground">
              {position === 1 ? "you\u2019re next" : "in line"}
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t.waiting}</p>
        </CardContent>
      </Card>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-muted-foreground"
      >
        {reconnecting ? "Reconnecting\u2026" : ""}
      </p>

      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirmLeave(true)}
      >
        {t.leaveButton}
      </Button>

      <Dialog
        open={confirmLeave}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmLeave(false);
            setLeaveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.leaveConfirm.title}</DialogTitle>
            <DialogDescription>{t.leaveConfirm.body}</DialogDescription>
          </DialogHeader>
          {leaveError ? (
            <Alert variant="destructive">
              <AlertDescription>{leaveError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={leaving}
              onClick={() => {
                setConfirmLeave(false);
                setLeaveError(null);
              }}
            >
              {t.leaveConfirm.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={leaving}
              onClick={onConfirmLeave}
            >
              {leaving ? "Leaving\u2026" : t.leaveConfirm.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-mono text-xs uppercase tracking-wide">
          {eyebrow}
        </CardDescription>
        <CardTitle className="font-display text-3xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function terminalFromStatus(status: PartyStatus): Terminal | null {
  if (status === "seated") return "seated";
  if (status === "left") return "left";
  if (status === "no_show") return "session_ended";
  return null;
}
