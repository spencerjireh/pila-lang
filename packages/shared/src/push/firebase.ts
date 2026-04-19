import type { App, ServiceAccount } from "firebase-admin/app";
import type { Messaging, Message } from "firebase-admin/messaging";

import { env } from "../config/env";
import { log } from "../log/logger";

declare global {
  var __firebaseApp: App | undefined;
  var __firebaseMessaging: Messaging | undefined;
}

function decodeServiceAccount(raw: string): ServiceAccount | null {
  const trimmed = raw.trim();
  try {
    const text = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (
      typeof parsed.project_id !== "string" ||
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

async function bootstrap(): Promise<Messaging | null> {
  if (globalThis.__firebaseMessaging) return globalThis.__firebaseMessaging;

  const raw = env().FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credential = decodeServiceAccount(raw);
  if (!credential) {
    log.warn("push.firebase.bad_credential");
    return null;
  }

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert(credential),
      });
    globalThis.__firebaseApp = app;
    const messaging = getMessaging(app);
    globalThis.__firebaseMessaging = messaging;
    return messaging;
  } catch (err) {
    log.error("push.firebase.init_failed", { err: String(err) });
    return null;
  }
}

export type SendOutcome =
  | { ok: true; messageId: string }
  | {
      ok: false;
      reason: "disabled" | "invalid_token" | "transport";
      detail?: string;
    };

export async function sendFcmMessage(message: Message): Promise<SendOutcome> {
  const messaging = await bootstrap();
  if (!messaging) return { ok: false, reason: "disabled" };
  try {
    const id = await messaging.send(message);
    return { ok: true, messageId: id };
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      return { ok: false, reason: "invalid_token", detail: code };
    }
    return {
      ok: false,
      reason: "transport",
      detail: String((err as Error).message ?? err),
    };
  }
}

export function isFirebaseConfigured(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "";
  return raw.trim().length > 0;
}
