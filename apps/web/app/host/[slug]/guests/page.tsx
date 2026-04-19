import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { HOST_COOKIE_NAME } from "@pila/shared/auth/host-session";
import { verifyHostToken } from "@pila/shared/auth/host-token";
import { loadGuestHistory } from "@pila/shared/parties/guest-history";
import { loadTenantBySlug } from "@pila/shared/tenants/display-token";

import { GuestsView } from "./guests-view";

export const dynamic = "force-dynamic";

export default async function HostGuestsPage({
  params,
}: {
  params: { slug: string };
}) {
  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) notFound();
  const tenant = lookup.tenant;

  const cookie = cookies().get(HOST_COOKIE_NAME)?.value;
  if (!cookie) redirect(`/host/${tenant.slug}`);
  const verified = await verifyHostToken(cookie);
  if (
    !verified.ok ||
    verified.claims.slug !== tenant.slug ||
    verified.claims.pwv < tenant.hostPasswordVersion
  ) {
    redirect(`/host/${tenant.slug}`);
  }

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
