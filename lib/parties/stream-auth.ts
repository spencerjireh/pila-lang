import type { Party, PartyStatus, Tenant } from "@pila/db/schema";

import { isTerminalStatus } from "./stream-events";

export type StreamAuthDecision =
  | { ok: true; party: Party }
  | { ok: false; status: 204 | 401 | 403 | 404 };

export interface StreamAuthInput {
  tenant: Pick<Tenant, "id"> | null;
  party: Pick<Party, "id" | "tenantId" | "sessionToken" | "status"> | null;
  cookie: string | null | undefined;
}

export function guestStreamAuth(input: StreamAuthInput): StreamAuthDecision {
  if (!input.tenant) return { ok: false, status: 404 };
  if (!input.cookie) return { ok: false, status: 401 };
  if (!input.party) return { ok: false, status: 204 };
  if (input.party.tenantId !== input.tenant.id)
    return { ok: false, status: 403 };
  if (input.party.sessionToken !== input.cookie)
    return { ok: false, status: 403 };
  if (isTerminalStatus(input.party.status as PartyStatus)) {
    return { ok: false, status: 204 };
  }
  return { ok: true, party: input.party as Party };
}
