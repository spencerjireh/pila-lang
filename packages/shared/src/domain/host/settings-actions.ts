import { eq, sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants, type Tenant } from "@pila/db/schema";
import {
  publishTenantOpenClose,
  publishTenantUpdated,
} from "../../domain/parties/tenant-updates";

export interface BrandingPatch {
  name?: string;
  accentColor?: string;
}

export async function updateTenantBranding(
  tenantId: string,
  slug: string,
  patch: BrandingPatch,
): Promise<Pick<Tenant, "name" | "accentColor" | "logoUrl"> | null> {
  if (Object.keys(patch).length === 0) return null;
  const [row] = await getDb()
    .update(tenants)
    .set(patch)
    .where(eq(tenants.id, tenantId))
    .returning({
      name: tenants.name,
      accentColor: tenants.accentColor,
      logoUrl: tenants.logoUrl,
    });
  if (!row) return null;
  await publishTenantUpdated(slug, patch);
  return row;
}

export async function swapLogo(
  tenantId: string,
  slug: string,
  newUrl: string | null,
): Promise<{ oldLogoUrl: string | null; logoUrl: string | null } | null> {
  const [prior] = await getDb()
    .select({ logoUrl: tenants.logoUrl })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!prior) return null;

  const [row] = await getDb()
    .update(tenants)
    .set({ logoUrl: newUrl })
    .where(eq(tenants.id, tenantId))
    .returning({ logoUrl: tenants.logoUrl });
  if (!row) return null;

  await publishTenantUpdated(slug, { logoUrl: newUrl });
  return { oldLogoUrl: prior.logoUrl, logoUrl: row.logoUrl };
}

export async function setTenantOpen(
  tenantId: string,
  slug: string,
  isOpen: boolean,
): Promise<{ isOpen: boolean; changed: boolean } | null> {
  const [prior] = await getDb()
    .select({ isOpen: tenants.isOpen })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!prior) return null;

  if (prior.isOpen === isOpen) {
    return { isOpen, changed: false };
  }

  const [row] = await getDb()
    .update(tenants)
    .set({ isOpen })
    .where(eq(tenants.id, tenantId))
    .returning({ isOpen: tenants.isOpen });
  if (!row) return null;

  await publishTenantOpenClose(slug, row.isOpen);
  return { isOpen: row.isOpen, changed: true };
}

export async function rotateHostPassword(
  tenantId: string,
  opts: { newHash?: string } = {},
): Promise<{ newVersion: number } | null> {
  const patch: {
    hostPasswordVersion: ReturnType<typeof sql>;
    hostPasswordHash?: string;
  } = {
    hostPasswordVersion: sql`${tenants.hostPasswordVersion} + 1`,
  };
  if (opts.newHash) patch.hostPasswordHash = opts.newHash;

  const [row] = await getDb()
    .update(tenants)
    .set(patch)
    .where(eq(tenants.id, tenantId))
    .returning({ newVersion: tenants.hostPasswordVersion });
  if (!row) return null;
  return { newVersion: row.newVersion };
}
