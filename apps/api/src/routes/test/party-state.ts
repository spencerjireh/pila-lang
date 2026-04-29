import { Router } from "express";
import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { parties } from "@pila/db/schema";

import { asyncHandler } from "../../lib/async-handler.js";

export const testPartyStateRouter = Router();

// Diagnostic: read a party row by id without tenant scoping. The smoke flow
// knows partyId but not tenantId. Guarded by testEnvGuard upstream.
testPartyStateRouter.get(
  "/test/party-state/:partyId",
  asyncHandler(async (req, res) => {
    const partyId = String(req.params.partyId ?? "");
    if (!partyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const rows = await getDb()
      .select({
        id: parties.id,
        tenantId: parties.tenantId,
        name: parties.name,
        phone: parties.phone,
        partySize: parties.partySize,
        status: parties.status,
        joinedAt: parties.joinedAt,
        seatedAt: parties.seatedAt,
        resolvedAt: parties.resolvedAt,
      })
      .from(parties)
      .where(eq(parties.id, partyId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(row);
  }),
);
