import { notFound } from "next/navigation";

import { env } from "@pila/shared/primitives/config/env";
import { resolveDisplayToken } from "@pila/shared/domain/tenants/display-token";
import { DisplayClient } from "./_components/display-client";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await resolveDisplayToken(params.slug);
  if (!result.ok) notFound();

  const origin = env().NEXTAUTH_URL.replace(/\/$/u, "");
  const joinUrl = `${origin}/r/${params.slug}?t=${encodeURIComponent(result.payload.token)}`;

  return (
    <DisplayClient
      slug={params.slug}
      origin={origin}
      tenant={{
        name: result.tenant.name,
        logoUrl: result.tenant.logoUrl,
        accentColor: result.tenant.accentColor,
      }}
      initialToken={result.payload.token}
      initialValidUntilMs={result.payload.validUntilMs}
      initialIsOpen={result.payload.isOpen}
      initialJoinUrl={joinUrl}
    />
  );
}
