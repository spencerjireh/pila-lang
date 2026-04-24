import { getDb } from "@pila/db/client";
import { notifications, type Party } from "@pila/db/schema";
import { log } from "../../infra/log/logger";
import type { Notifier } from "../../domain/notifier";

import { sendFcmMessage, type SendOutcome } from "../../infra/push/firebase";
import { listActivePushTokensForParty, revokePushTokenById } from "./registry";

type DeliveryStatus = "sent" | "failed" | "token_revoked" | "skipped";

function deliveryStatus(outcome: SendOutcome): DeliveryStatus {
  if (outcome.ok) return "sent";
  if (outcome.reason === "disabled") return "skipped";
  if (outcome.reason === "invalid_token") return "token_revoked";
  return "failed";
}

export interface PushNotifierDeps {
  listTokens: typeof listActivePushTokensForParty;
  send: typeof sendFcmMessage;
  revoke: typeof revokePushTokenById;
  recordNotification: (payload: {
    partyId: string;
    status: DeliveryStatus;
    payload: Record<string, unknown>;
  }) => Promise<void>;
}

const defaultDeps: PushNotifierDeps = {
  listTokens: listActivePushTokensForParty,
  send: sendFcmMessage,
  revoke: revokePushTokenById,
  recordNotification: async ({ partyId, status, payload }) => {
    await getDb().insert(notifications).values({
      partyId,
      channel: "push",
      eventType: "party_ready",
      status,
      payload,
    });
  },
};

export class PushNotifier implements Notifier {
  private readonly deps: PushNotifierDeps;

  constructor(deps: PushNotifierDeps = defaultDeps) {
    this.deps = deps;
  }

  async onPartyJoined(_party: Party): Promise<void> {
    // v1.5: join is not wired for push. Host-push lands post-v1.5.
  }

  async onPartyReady(party: Party): Promise<void> {
    let tokens;
    try {
      tokens = await this.deps.listTokens(party.id);
    } catch (err) {
      log.error("push.notifier.list_failed", {
        partyId: party.id,
        err: String(err),
      });
      return;
    }

    if (tokens.length === 0) {
      await this.safeRecord({
        partyId: party.id,
        status: "skipped",
        payload: { reason: "no_tokens" },
      });
      return;
    }

    await Promise.all(
      tokens.map(async (token) => {
        const outcome = await this.deps.send({
          token: token.deviceToken,
          notification: {
            title: "Your table is ready",
            body: `${party.name}, head to the host.`,
          },
          data: {
            type: "party.seated",
            partyId: party.id,
            tenantId: party.tenantId,
          },
        });
        const status = deliveryStatus(outcome);
        if (status === "token_revoked") {
          try {
            await this.deps.revoke(token.id);
          } catch (err) {
            log.warn("push.notifier.revoke_failed", {
              tokenId: token.id,
              err: String(err),
            });
          }
        }
        await this.safeRecord({
          partyId: party.id,
          status,
          payload: {
            tokenId: token.id,
            platform: token.platform,
            detail: outcome.ok ? outcome.messageId : outcome.detail,
          },
        });
      }),
    );
  }

  private async safeRecord(input: {
    partyId: string;
    status: DeliveryStatus;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.deps.recordNotification(input);
    } catch (err) {
      log.error("push.notifier.record_failed", {
        partyId: input.partyId,
        err: String(err),
      });
    }
  }
}
