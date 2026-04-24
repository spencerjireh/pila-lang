import { channelForTenantQueue, publish } from "../../infra/redis/pubsub";

import type { TenantUpdated } from "./stream-events";

export async function publishTenantUpdated(
  slug: string,
  patch: Omit<TenantUpdated, "type">,
): Promise<void> {
  const event: TenantUpdated = { type: "tenant:updated", ...patch };
  await publish(channelForTenantQueue(slug), event);
}

export async function publishTenantOpenClose(
  slug: string,
  isOpen: boolean,
): Promise<void> {
  await publish(channelForTenantQueue(slug), {
    type: isOpen ? "tenant:opened" : "tenant:closed",
  });
}
