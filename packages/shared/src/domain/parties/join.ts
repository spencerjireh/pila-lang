import { and, eq, ne } from "drizzle-orm";

import { generateGuestSessionToken } from "../../domain/auth/guest-session";
import { parties, type Party, type Tenant } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { notifier } from "../../domain/notifier";
import { channelForTenantQueue, publish } from "../../infra/redis/pubsub";
import { loadTenantBySlug } from "../../domain/tenants/display-token";

export interface JoinInput {
  name: string;
  partySize: number;
  phone: string | null;
}

export type JoinResult =
  | {
      ok: true;
      party: Party;
      tenant: Tenant;
      phoneSeenBefore: boolean;
      waitUrl: string;
    }
  | { ok: false; reason: "not_found" | "tenant_closed" | "already_waiting" };

export function shouldSetWelcomeBack(args: {
  phone: string | null;
  priorCount: number;
}): boolean {
  if (!args.phone) return false;
  return args.priorCount > 0;
}

export function isPartyPhoneConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "23505";
}

export function waitUrlFor(slug: string, partyId: string): string {
  return `/r/${slug}/wait/${partyId}`;
}

export async function joinQueue(
  slug: string,
  input: JoinInput,
): Promise<JoinResult> {
  const lookup = await loadTenantBySlug(slug);
  if (!lookup.ok) return { ok: false, reason: "not_found" };
  const tenant = lookup.tenant;
  if (!tenant.isOpen) return { ok: false, reason: "tenant_closed" };

  const scoped = tenantDb(tenant.id);

  if (input.phone) {
    const conflicting = await scoped.parties.select(
      and(eq(parties.phone, input.phone), eq(parties.status, "waiting")),
    );
    if (conflicting.length > 0) return { ok: false, reason: "already_waiting" };
  }

  const sessionToken = generateGuestSessionToken();

  let inserted: Party;
  try {
    const [row] = await scoped.parties
      .insert({
        name: input.name,
        phone: input.phone,
        partySize: input.partySize,
        status: "waiting",
        sessionToken,
      })
      .returning();
    inserted = row as Party;
  } catch (err) {
    if (isPartyPhoneConflict(err))
      return { ok: false, reason: "already_waiting" };
    throw err;
  }

  let phoneSeenBefore = false;
  if (input.phone) {
    const prior = await scoped.parties.select(
      and(eq(parties.phone, input.phone), ne(parties.id, inserted.id)),
    );
    phoneSeenBefore = shouldSetWelcomeBack({
      phone: input.phone,
      priorCount: prior.length,
    });
  }

  await publish(channelForTenantQueue(tenant.slug), {
    type: "party:joined",
    id: inserted.id,
    name: inserted.name,
    partySize: inserted.partySize,
    phone: inserted.phone,
    joinedAt: inserted.joinedAt.toISOString(),
  });

  await notifier().onPartyJoined(inserted);

  return {
    ok: true,
    party: inserted,
    tenant,
    phoneSeenBefore,
    waitUrl: waitUrlFor(tenant.slug, inserted.id),
  };
}
