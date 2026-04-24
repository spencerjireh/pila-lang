import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { getDb } from "./client";
import {
  notifications,
  parties,
  pushTokens,
  type NewParty,
  type NewPushToken,
} from "./schema";

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

type Db = ReturnType<typeof getDb>;

function combineScope(scope: SQL, extra?: SQL): SQL {
  return extra ? (and(scope, extra) as SQL) : scope;
}

function scopedCrud<Table extends PgTable, New extends Record<string, unknown>>(
  db: Db,
  table: Table,
  scope: () => SQL,
  tenantId: string,
) {
  return {
    select(extra?: SQL) {
      return db.select().from(table).where(combineScope(scope(), extra));
    },
    insert(values: Omit<New, "tenantId">) {
      return db.insert(table).values({ ...values, tenantId } as never);
    },
    update(set: Partial<New>, extra?: SQL) {
      const { tenantId: _drop, ...rest } = set as Partial<New> & {
        tenantId?: unknown;
      };
      void _drop;
      return db
        .update(table)
        .set(rest as never)
        .where(combineScope(scope(), extra));
    },
    delete(extra?: SQL) {
      return db.delete(table).where(combineScope(scope(), extra));
    },
  };
}

export function tenantDb(tenantId: string) {
  assertTenantId(tenantId);
  const db = getDb();

  const scopeParty = () => eq(parties.tenantId, tenantId);
  const scopePushToken = () => eq(pushTokens.tenantId, tenantId);
  const notificationsScope = () =>
    inArray(
      notifications.partyId,
      db.select({ id: parties.id }).from(parties).where(scopeParty()),
    );

  return {
    tenantId,
    parties: scopedCrud<typeof parties, NewParty>(
      db,
      parties,
      scopeParty,
      tenantId,
    ),
    pushTokens: scopedCrud<typeof pushTokens, NewPushToken>(
      db,
      pushTokens,
      scopePushToken,
      tenantId,
    ),
    notifications: {
      select(extra?: SQL) {
        return db
          .select()
          .from(notifications)
          .where(combineScope(notificationsScope(), extra));
      },
      delete(extra?: SQL) {
        return db
          .delete(notifications)
          .where(combineScope(notificationsScope(), extra));
      },
    },
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;
