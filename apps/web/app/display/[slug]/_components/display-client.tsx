"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";

import { TenantHeader } from "@/components/tenant-branding";
import { en } from "@/lib/i18n/en";
import {
  applyTenantEvent,
  type TenantLiveEvent,
} from "@/lib/sse/apply-tenant-event";
import { useLiveStream } from "@/lib/sse/use-live-stream";

interface TokenPayload {
  token: string;
  validUntilMs: number;
  isOpen: boolean;
}

interface DisplayTenant {
  name: string;
  logoUrl: string | null;
  accentColor: string;
}

interface DisplayClientProps {
  slug: string;
  origin: string;
  tenant: DisplayTenant;
  initialToken: string;
  initialValidUntilMs: number;
  initialIsOpen: boolean;
  initialJoinUrl: string;
}

const POLL_INTERVAL_MS = 60_000;

async function fetchToken(slug: string): Promise<TokenPayload> {
  const res = await fetch(`/api/display/${encodeURIComponent(slug)}/token`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token fetch failed: ${res.status}`);
  return (await res.json()) as TokenPayload;
}

export function DisplayClient({
  slug,
  origin,
  tenant: initialTenant,
  initialToken,
  initialValidUntilMs,
  initialIsOpen,
  initialJoinUrl,
}: DisplayClientProps) {
  const queryClient = useQueryClient();
  const [tenant, setTenant] = useState<DisplayTenant>(initialTenant);
  const [liveIsOpen, setLiveIsOpen] = useState<boolean | null>(null);

  const { data } = useQuery({
    queryKey: ["display-token", slug],
    queryFn: () => fetchToken(slug),
    initialData: {
      token: initialToken,
      validUntilMs: initialValidUntilMs,
      isOpen: initialIsOpen,
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
  });

  const onTenantEvent = useCallback(
    (ev: TenantLiveEvent) => {
      setTenant((prev) => applyTenantEvent(prev, ev));
      if (ev.type === "tenant:closed") setLiveIsOpen(false);
      if (ev.type === "tenant:opened") {
        setLiveIsOpen(true);
        void queryClient.invalidateQueries({
          queryKey: ["display-token", slug],
        });
      }
    },
    [slug, queryClient],
  );
  useLiveStream<TenantLiveEvent>({
    url: `/api/display/${encodeURIComponent(slug)}/stream`,
    onEvent: onTenantEvent,
  });

  const isOpen = liveIsOpen ?? data.isOpen;
  const joinUrl =
    data.token === initialToken
      ? initialJoinUrl
      : `${origin}/r/${slug}?t=${encodeURIComponent(data.token)}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-12 p-10 text-center">
      <header className="flex flex-col items-center gap-4">
        <TenantHeader
          name={tenant.name}
          logoUrl={tenant.logoUrl}
          accentColor={tenant.accentColor}
          size="lg"
        />
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {en.display.eyebrow}
        </p>
      </header>

      {isOpen ? (
        <section className="flex flex-col items-center gap-6">
          <div className="rounded-lg border border-border bg-popover p-8">
            <QRCodeSVG
              value={joinUrl}
              size={320}
              level="M"
              includeMargin={false}
              aria-label={`QR code to join the queue at ${tenant.name}`}
            />
          </div>
          <h1 className="font-display text-5xl font-semibold text-foreground">
            {en.display.title}
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            {en.display.body}
          </p>
        </section>
      ) : (
        <ClosedBanner />
      )}
    </main>
  );
}

function ClosedBanner() {
  return (
    <section
      role="status"
      className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-10 text-center"
    >
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Closed
      </p>
      <h2 className="font-display text-3xl font-semibold text-foreground">
        {en.display.closed.title}
      </h2>
      <p className="text-muted-foreground">{en.display.closed.body}</p>
    </section>
  );
}
