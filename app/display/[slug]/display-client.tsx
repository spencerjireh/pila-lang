"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { TenantHeader } from "@/components/tenant-branding";

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

  useEffect(() => {
    const url = `/api/display/${encodeURIComponent(slug)}/stream`;
    const es = new EventSource(url);
    es.onmessage = (msg) => {
      let ev: { type?: string; name?: string; logoUrl?: string | null; accentColor?: string };
      try {
        ev = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (ev.type === "tenant:updated") {
        setTenant((prev) => ({
          ...prev,
          ...(ev.name !== undefined ? { name: ev.name } : {}),
          ...(ev.logoUrl !== undefined ? { logoUrl: ev.logoUrl } : {}),
          ...(ev.accentColor !== undefined ? { accentColor: ev.accentColor } : {}),
        }));
      } else if (ev.type === "tenant:closed") {
        setLiveIsOpen(false);
      } else if (ev.type === "tenant:opened") {
        setLiveIsOpen(true);
        void queryClient.invalidateQueries({ queryKey: ["display-token", slug] });
      }
    };
    return () => {
      es.close();
    };
  }, [slug, queryClient]);

  const isOpen = liveIsOpen ?? data.isOpen;
  const joinUrl =
    data.token === initialToken
      ? initialJoinUrl
      : `${origin}/r/${slug}?t=${encodeURIComponent(data.token)}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-10 p-8">
      <TenantHeader
        name={tenant.name}
        logoUrl={tenant.logoUrl}
        accentColor={tenant.accentColor}
        size="lg"
      />
      {isOpen ? (
        <section className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <QRCodeSVG
              value={joinUrl}
              size={320}
              level="M"
              includeMargin={false}
              aria-label={`QR code to join the queue at ${tenant.name}`}
            />
          </div>
          <p className="text-center text-lg text-slate-700">
            Scan to join the queue
          </p>
        </section>
      ) : (
        <ClosedBanner name={tenant.name} />
      )}
    </main>
  );
}

function ClosedBanner({ name }: { name: string }) {
  return (
    <section
      className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center"
      role="status"
    >
      <h2 className="text-2xl font-semibold">Not accepting guests right now</h2>
      <p className="text-slate-600">
        {name} is currently closed. Please check back later.
      </p>
    </section>
  );
}
