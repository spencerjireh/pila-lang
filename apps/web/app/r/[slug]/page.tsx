import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TenantHeader } from "@/components/tenant-branding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { en } from "@/lib/i18n/en";
import { GUEST_COOKIE_NAME } from "@pila/shared/domain/auth/guest-session";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { log } from "@pila/shared/infra/log/logger";
import { findWaitingPartyBySession } from "@pila/shared/domain/parties/lookup";
import { waitUrlFor } from "@pila/shared/domain/parties/join";
import {
  verifyQrToken,
  type QrVerification,
} from "@pila/shared/primitives/qr/token";
import { RateLimitError, consume } from "@pila/shared/infra/ratelimit";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import { JoinForm } from "./_components/join-form";

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
        <Banner kind="closed" />
      </PageShell>
    );
  }

  const rawToken = searchParams.t ?? "";
  if (!rawToken) {
    return (
      <PageShell tenant={tenant}>
        <Banner kind="missing_token" />
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
        />
      </PageShell>
    );
  }

  return (
    <PageShell tenant={tenant}>
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {en.designSystem.voice.welcome}
        </p>
        <h1 className="font-display text-4xl font-semibold text-foreground">
          {en.guest.join.title}
        </h1>
        <p className="text-muted-foreground">{en.guest.join.lede}</p>
      </header>
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

function Banner({ kind }: { kind: BannerKind }) {
  const content = messageFor(kind);
  return (
    <Alert variant="warning">
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>{content.body}</AlertDescription>
    </Alert>
  );
}

function messageFor(kind: BannerKind): { title: string; body: string } {
  switch (kind) {
    case "closed":
      return en.guest.join.closed;
    case "expired_token":
      return en.guest.join.expired;
    case "invalid_token":
      return en.guest.join.invalid;
    case "missing_token":
      return en.guest.join.mustScan;
  }
}

function RateLimitedNotice({ retryAfterSec }: { retryAfterSec: number }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Too many requests
      </h1>
      <p className="text-muted-foreground">
        Try again in {retryAfterSec} seconds.
      </p>
    </main>
  );
}
