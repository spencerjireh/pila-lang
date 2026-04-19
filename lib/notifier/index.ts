import type { Party } from "@/lib/db/schema";

export interface Notifier {
  onPartyJoined(party: Party): Promise<void>;
  onPartyReady(party: Party): Promise<void>;
}

export class NoopNotifier implements Notifier {
  async onPartyJoined(_party: Party): Promise<void> {
    /* v1: no-op */
  }
  async onPartyReady(_party: Party): Promise<void> {
    /* v1: no-op */
  }
}

export type NotifierCall =
  | { type: "onPartyJoined"; party: Party; at: string }
  | { type: "onPartyReady"; party: Party; at: string };

export class TestSpyNotifier implements Notifier {
  private calls: NotifierCall[] = [];

  async onPartyJoined(party: Party): Promise<void> {
    this.calls.push({ type: "onPartyJoined", party, at: new Date().toISOString() });
  }
  async onPartyReady(party: Party): Promise<void> {
    this.calls.push({ type: "onPartyReady", party, at: new Date().toISOString() });
  }

  drain(): NotifierCall[] {
    const out = this.calls;
    this.calls = [];
    return out;
  }
}

declare global {
  var __notifier: Notifier | undefined;
}

function shouldUseSpy(): boolean {
  return process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "1";
}

function bootstrap(): Notifier {
  const useSpy = shouldUseSpy();
  if (globalThis.__notifier) {
    if (useSpy && !(globalThis.__notifier instanceof TestSpyNotifier)) {
      globalThis.__notifier = new TestSpyNotifier();
    }
    return globalThis.__notifier;
  }
  globalThis.__notifier = useSpy ? new TestSpyNotifier() : new NoopNotifier();
  return globalThis.__notifier;
}

export function notifier(): Notifier {
  return bootstrap();
}

export function setNotifier(n: Notifier) {
  globalThis.__notifier = n;
}

export function testSpyNotifier(): TestSpyNotifier | null {
  const n = bootstrap();
  return n instanceof TestSpyNotifier ? n : null;
}
