import { tenants } from "@pila/db/schema";

/**
 * Canonical column projection for admin tenant reads. Hoisted so the list/get
 * route and the patch/create route stay in sync — adding a field touches one
 * file, not two.
 */
export const TENANT_COLUMNS = {
  id: tenants.id,
  slug: tenants.slug,
  name: tenants.name,
  logoUrl: tenants.logoUrl,
  accentColor: tenants.accentColor,
  timezone: tenants.timezone,
  isOpen: tenants.isOpen,
  isDemo: tenants.isDemo,
  createdAt: tenants.createdAt,
} as const;
