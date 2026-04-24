import { notFound, redirect } from "next/navigation";

import { guardHostPage } from "@/lib/auth/guard-host-page";
import { loadGuestHistory } from "@pila/shared/domain/parties/guest-history";

import { GuestsView } from "./_components/guests-view";

export const dynamic = "force-dynamic";

export default async function HostGuestsPage({
  params,
}: {
  params: { slug: string };
}) {
  const guard = await guardHostPage(params.slug);
  if (!guard.ok) {
    if (guard.status === 404) notFound();
    redirect(`/host/${params.slug}`);
  }
  const { tenant } = guard;

  const initial = await loadGuestHistory(tenant.id, { limit: 25 });

  return (
    <GuestsView
      slug={tenant.slug}
      tenantName={tenant.name}
      timezone={tenant.timezone}
      initial={initial}
    />
  );
}
