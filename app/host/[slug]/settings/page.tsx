import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { HOST_COOKIE_NAME } from "@/lib/auth/host-session";
import { verifyHostToken } from "@/lib/auth/host-token";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function HostSettingsPage({
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

  return (
    <SettingsView
      slug={tenant.slug}
      initial={{
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        accentColor: tenant.accentColor,
        isOpen: tenant.isOpen,
      }}
    />
  );
}
