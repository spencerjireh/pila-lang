import { notFound, redirect } from "next/navigation";

import { guardHostPage } from "@/lib/auth/guard-host-page";
import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
} from "@pila/shared/domain/parties/host-stream";

import { QueueView } from "./_components/queue-view";

export const dynamic = "force-dynamic";

export default async function HostQueuePage({
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

  const [waiting, recentlyResolved] = await Promise.all([
    loadWaiting(tenant.id),
    loadRecentlyResolved(tenant.id),
  ]);
  const snapshot = buildHostSnapshot(tenant, waiting, recentlyResolved);

  return <QueueView slug={tenant.slug} initialSnapshot={snapshot} />;
}
