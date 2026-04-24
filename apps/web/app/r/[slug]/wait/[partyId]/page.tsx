import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GUEST_COOKIE_NAME } from "@pila/shared/domain/auth/guest-session";
import type { PartyStatus } from "@pila/db/schema";
import { findPartyById } from "@pila/shared/domain/parties/lookup";
import { computePosition } from "@pila/shared/domain/parties/position";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

import { WaitView } from "./_components/wait-view";

export const dynamic = "force-dynamic";

export default async function WaitPage({
  params,
}: {
  params: { slug: string; partyId: string };
}) {
  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) notFound();
  const tenant = lookup.tenant;

  const cookie = cookies().get(GUEST_COOKIE_NAME)?.value;
  if (!cookie) return <SessionEndedScreen />;

  const party = await findPartyById(tenant.id, params.partyId);
  if (!party) return <SessionEndedScreen />;
  if (party.tenantId !== tenant.id || party.sessionToken !== cookie) {
    return <SessionEndedScreen />;
  }

  if (party.status === "no_show") return <SessionEndedScreen />;

  const position =
    party.status === "waiting" ? await computePosition(tenant.id, party.id) : 0;

  return (
    <main
      lang="en"
      className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-12"
    >
      <WaitView
        slug={tenant.slug}
        initialTenant={{
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          accentColor: tenant.accentColor,
          isOpen: tenant.isOpen,
        }}
        partyId={party.id}
        partyName={party.name}
        partySize={party.partySize}
        initialStatus={party.status as PartyStatus}
        initialPosition={position}
        joinedAt={party.joinedAt.toISOString()}
      />
    </main>
  );
}

function SessionEndedScreen() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Session ended
      </p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Your wait session has ended
      </h1>
      <p className="text-muted-foreground">
        Scan the QR at the host stand to rejoin.
      </p>
    </main>
  );
}
