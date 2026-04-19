import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#1F6FEB"),
  hostPasswordHash: text("host_password_hash").notNull(),
  hostPasswordVersion: integer("host_password_version").notNull().default(1),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  isOpen: boolean("is_open").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
  currentQrToken: text("current_qr_token"),
  qrTokenIssuedAt: timestamp("qr_token_issued_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const parties = pgTable(
  "parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    partySize: integer("party_size").notNull(),
    status: text("status").notNull(),
    sessionToken: text("session_token").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({
    tenantStatus: index("idx_parties_tenant_status").on(t.tenantId, t.status),
    tenantPhone: index("idx_parties_tenant_phone")
      .on(t.tenantId, t.phone)
      .where(sql`${t.phone} IS NOT NULL`),
    oneWaitingPerPhone: uniqueIndex("idx_parties_one_waiting_per_phone")
      .on(t.tenantId, t.phone)
      .where(sql`${t.status} = 'waiting' AND ${t.phone} IS NOT NULL`),
    partySizeRange: check(
      "parties_size_range",
      sql`${t.partySize} BETWEEN 1 AND 20`,
    ),
    statusEnum: check(
      "parties_status_enum",
      sql`${t.status} IN ('waiting','seated','no_show','left')`,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    payload: jsonb("payload"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    party: index("idx_notifications_party").on(t.partyId),
  }),
);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    compoundKey: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (t) => ({
    compoundKey: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type PartyStatus = "waiting" | "seated" | "no_show" | "left";
