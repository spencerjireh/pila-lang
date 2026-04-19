import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { HOST_COOKIE_NAME } from "@pila/shared/auth/host-session";
import { verifyHostToken } from "@pila/shared/auth/host-token";
import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
} from "@pila/shared/parties/host-stream";
import { loadTenantBySlug } from "@pila/shared/tenants/display-token";

import { QueueView } from "./queue-view";

export const dynamic = "force-dynamic";

export default async function HostQueuePage({
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

  const [waiting, recentlyResolved] = await Promise.all([
    loadWaiting(tenant.id),
    loadRecentlyResolved(tenant.id),
  ]);
  const snapshot = buildHostSnapshot(tenant, waiting, recentlyResolved);

  return <QueueView slug={tenant.slug} initialSnapshot={snapshot} />;
}
