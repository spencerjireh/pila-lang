import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TenantHeader } from "@/components/tenant-branding";
import { HOST_COOKIE_NAME } from "@/lib/auth/host-session";
import { verifyHostToken } from "@/lib/auth/host-token";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

import { LoginForm } from "./_components/login-form";

export const dynamic = "force-dynamic";

export default async function HostLoginPage({ params }: { params: { slug: string } }) {
  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) notFound();
  const tenant = lookup.tenant;

  const cookie = cookies().get(HOST_COOKIE_NAME)?.value;
  if (cookie) {
    const verified = await verifyHostToken(cookie);
    if (
      verified.ok &&
      verified.claims.slug === tenant.slug &&
      verified.claims.pwv >= tenant.hostPasswordVersion
    ) {
      redirect(`/host/${tenant.slug}/queue`);
    }
  }

  return (
    <main
      lang="en"
      className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 p-6 pt-16"
    >
      <TenantHeader
        name={tenant.name}
        logoUrl={tenant.logoUrl}
        accentColor={tenant.accentColor}
        subtitle="Host sign-in"
      />
      <LoginForm slug={tenant.slug} />
    </main>
  );
}
