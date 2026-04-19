import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TenantHeader } from "@/components/tenant-branding";
import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-session";
import { clientIp } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { findWaitingPartyBySession } from "@/lib/parties/lookup";
import { waitUrlFor } from "@/lib/parties/join";
import { verifyQrToken, type QrVerification } from "@/lib/qr/token";
import { RateLimitError, consume } from "@/lib/ratelimit";
import { loadTenantBySlug } from "@/lib/tenants/display-token";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

type BannerKind =
  | "closed"
  | "invalid_token"
  | "expired_token"
  | "missing_token";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { t?: string };
}) {
  const ip = clientIp(headers());
  try {
    await consume("displayRequestsPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return <RateLimitedNotice retryAfterSec={err.retryAfterSec} />;
    }
    throw err;
  }

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) notFound();
  const tenant = lookup.tenant;

  const cookieJar = cookies();
  const session = cookieJar.get(GUEST_COOKIE_NAME)?.value;
  if (session) {
    let active: Awaited<ReturnType<typeof findWaitingPartyBySession>> = null;
    try {
      active = await findWaitingPartyBySession(tenant.id, session);
    } catch (err) {
      log.warn("r.page.session_lookup_failed", {
        slug: tenant.slug,
        err: String(err),
      });
    }
    if (active) redirect(waitUrlFor(tenant.slug, active.id));
  }

  if (!tenant.isOpen) {
    return (
      <PageShell tenant={tenant}>
        <Banner kind="closed" tenantName={tenant.name} />
      </PageShell>
    );
  }

  const rawToken = searchParams.t ?? "";
  if (!rawToken) {
    return (
      <PageShell tenant={tenant}>
        <Banner kind="missing_token" tenantName={tenant.name} />
      </PageShell>
    );
  }
  const verdict: QrVerification = verifyQrToken(tenant.slug, rawToken);
  if (!verdict.ok) {
    return (
      <PageShell tenant={tenant}>
        <Banner
          kind={
            verdict.reason === "expired" ? "expired_token" : "invalid_token"
          }
          tenantName={tenant.name}
        />
      </PageShell>
    );
  }

  return (
    <PageShell tenant={tenant}>
      <JoinForm slug={tenant.slug} token={rawToken} />
    </PageShell>
  );
}

function PageShell({
  tenant,
  children,
}: {
  tenant: { name: string; logoUrl: string | null; accentColor: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-12">
      <TenantHeader
        name={tenant.name}
        logoUrl={tenant.logoUrl}
        accentColor={tenant.accentColor}
      />
      {children}
    </main>
  );
}

function Banner({
  kind,
  tenantName,
}: {
  kind: BannerKind;
  tenantName: string;
}) {
  const content = messageFor(kind, tenantName);
  return (
    <section
      role="status"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center"
    >
      <h2 className="mb-2 text-xl font-semibold">{content.title}</h2>
      <p className="text-slate-600">{content.body}</p>
    </section>
  );
}

function messageFor(
  kind: BannerKind,
  tenantName: string,
): { title: string; body: string } {
  switch (kind) {
    case "closed":
      return {
        title: "Not accepting guests right now",
        body: `${tenantName} is currently closed. Please check back later.`,
      };
    case "expired_token":
      return {
        title: "This QR code has expired",
        body: "Please scan the code on the display again to join the queue.",
      };
    case "invalid_token":
      return {
        title: "This QR code isn't valid",
        body: "Please scan the code on the display to join the queue.",
      };
    case "missing_token":
      return {
        title: "Scan the QR code to join",
        body: "Open your camera and scan the code shown at the entrance.",
      };
  }
}

function RateLimitedNotice({ retryAfterSec }: { retryAfterSec: number }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Too many requests</h1>
      <p className="text-slate-600">
        Please try again in {retryAfterSec} seconds.
      </p>
    </main>
  );
}
