import { and, eq } from "drizzle-orm";

import { parties, type Party } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";

export async function findWaitingPartyBySession(
  tenantId: string,
  sessionToken: string,
): Promise<Party | null> {
  const rows = await tenantDb(tenantId).parties.select(
    and(eq(parties.sessionToken, sessionToken), eq(parties.status, "waiting")),
  );
  return (rows[0] as Party | undefined) ?? null;
}

export async function findPartyById(
  tenantId: string,
  partyId: string,
): Promise<Party | null> {
  const rows = await tenantDb(tenantId).parties.select(eq(parties.id, partyId));
  return (rows[0] as Party | undefined) ?? null;
}
