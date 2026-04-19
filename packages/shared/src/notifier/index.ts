import type { Party } from "@pila/db/schema";
import { PushNotifier } from "../push/push-notifier";

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

function firebaseConfigured(): boolean {
  return (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim().length > 0;
}

export type NotifierCall =
  | { type: "onPartyJoined"; party: Party; at: string }
  | { type: "onPartyReady"; party: Party; at: string };

const TEST_SPY_BRAND = Symbol.for("pila.notifier.testSpy");

function isTestSpy(n: Notifier): n is TestSpyNotifier {
  return (n as { [TEST_SPY_BRAND]?: boolean })[TEST_SPY_BRAND] === true;
}

export class TestSpyNotifier implements Notifier {
  readonly [TEST_SPY_BRAND] = true;
  private calls: NotifierCall[] = [];

  async onPartyJoined(party: Party): Promise<void> {
    this.calls.push({
      type: "onPartyJoined",
      party,
      at: new Date().toISOString(),
    });
  }
  async onPartyReady(party: Party): Promise<void> {
    this.calls.push({
      type: "onPartyReady",
      party,
      at: new Date().toISOString(),
    });
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
  return (
    process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "1"
  );
}

function defaultImpl(): Notifier {
  if (shouldUseSpy()) return new TestSpyNotifier();
  if (firebaseConfigured()) return new PushNotifier();
  return new NoopNotifier();
}

function bootstrap(): Notifier {
  const useSpy = shouldUseSpy();
  if (globalThis.__notifier) {
    if (useSpy && !isTestSpy(globalThis.__notifier)) {
      globalThis.__notifier = new TestSpyNotifier();
    }
    return globalThis.__notifier;
  }
  globalThis.__notifier = defaultImpl();
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
  return isTestSpy(n) ? n : null;
}
