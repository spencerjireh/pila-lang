import { notFound, redirect } from "next/navigation";

import { guardHostPage } from "@/lib/auth/guard-host-page";

import { SettingsView } from "./_components/settings-view";

export const dynamic = "force-dynamic";

export default async function HostSettingsPage({
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
