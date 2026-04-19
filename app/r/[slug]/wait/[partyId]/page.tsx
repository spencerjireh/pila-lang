import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-session";
import type { PartyStatus } from "@/lib/db/schema";
import { findPartyById } from "@/lib/parties/lookup";
import { computePosition } from "@/lib/parties/position";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

import { WaitView } from "./wait-view";

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Your session has ended</h1>
      <p className="text-slate-600">
        This wait session is no longer active. Scan the QR code again to rejoin.
      </p>
    </main>
  );
}
