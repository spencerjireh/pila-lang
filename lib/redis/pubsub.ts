import { redis, redisSub } from "./client";

type Listener = (event: unknown, channel: string) => void;

declare global {
  var __pubsubListeners: Map<string, Set<Listener>> | undefined;
  var __pubsubWired: boolean | undefined;
}

function listeners(): Map<string, Set<Listener>> {
  if (!globalThis.__pubsubListeners) globalThis.__pubsubListeners = new Map();
  return globalThis.__pubsubListeners;
}

function ensureWired() {
  if (globalThis.__pubsubWired) return;
  globalThis.__pubsubWired = true;
  redisSub().on("message", (channel: string, payload: string) => {
    const set = listeners().get(channel);
    if (!set || set.size === 0) return;
    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      event = payload;
    }
    for (const fn of set) {
      try {
        fn(event, channel);
      } catch {
        // listener errors must not break fan-out
      }
    }
  });
}

export async function publish(channel: string, event: unknown): Promise<void> {
  await redis().publish(channel, JSON.stringify(event));
}

export async function subscribe(
  channels: string[],
  listener: Listener,
): Promise<() => Promise<void>> {
  ensureWired();
  const sub = redisSub();
  const added: string[] = [];
  for (const ch of channels) {
    const set = listeners().get(ch);
    if (set) {
      set.add(listener);
    } else {
      listeners().set(ch, new Set([listener]));
      added.push(ch);
    }
  }
  if (added.length > 0) await sub.subscribe(...added);

  return async () => {
    const toUnsubscribe: string[] = [];
    for (const ch of channels) {
      const set = listeners().get(ch);
      if (!set) continue;
      set.delete(listener);
      if (set.size === 0) {
        listeners().delete(ch);
        toUnsubscribe.push(ch);
      }
    }
    if (toUnsubscribe.length > 0) await sub.unsubscribe(...toUnsubscribe);
  };
}

export function channelForTenantQueue(slug: string): string {
  return `tenant:${slug}:queue`;
}

export function channelForParty(partyId: string): string {
  return `party:${partyId}`;
}
