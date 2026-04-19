import { and, eq, inArray, type SQL } from "drizzle-orm";
import { getDb } from "./client";
import { notifications, parties, type NewNotification, type NewParty } from "./schema";

export class TenantScopeError extends Error {
  constructor(message = "tenant-scoped query requires a non-empty tenantId") {
    super(message);
    this.name = "TenantScopeError";
  }
}

function assertTenantId(tenantId: unknown): asserts tenantId is string {
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new TenantScopeError();
  }
}

export function tenantDb(tenantId: string) {
  assertTenantId(tenantId);
  const db = getDb();

  const scopeParty = () => eq(parties.tenantId, tenantId);
  const partyIdsSubquery = () =>
    db.select({ id: parties.id }).from(parties).where(scopeParty());

  return {
    tenantId,

    parties: {
      select(extra?: SQL) {
        const where = extra ? and(scopeParty(), extra) : scopeParty();
        return db.select().from(parties).where(where);
      },
      insert(values: Omit<NewParty, "tenantId">) {
        return db.insert(parties).values({ ...values, tenantId });
      },
      update(set: Partial<NewParty>, extra?: SQL) {
        const sanitized = { ...set };
        delete (sanitized as { tenantId?: unknown }).tenantId;
        const where = extra ? and(scopeParty(), extra) : scopeParty();
        return db.update(parties).set(sanitized).where(where);
      },
      delete(extra?: SQL) {
        const where = extra ? and(scopeParty(), extra) : scopeParty();
        return db.delete(parties).where(where);
      },
    },

    notifications: {
      select(extra?: SQL) {
        const scope = inArray(notifications.partyId, partyIdsSubquery());
        const where = extra ? and(scope, extra) : scope;
        return db.select().from(notifications).where(where);
      },
      insert(values: NewNotification) {
        return db.insert(notifications).values(values);
      },
      delete(extra?: SQL) {
        const scope = inArray(notifications.partyId, partyIdsSubquery());
        const where = extra ? and(scope, extra) : scope;
        return db.delete(notifications).where(where);
      },
    },
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;
