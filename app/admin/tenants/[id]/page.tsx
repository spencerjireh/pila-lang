import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditTenantForm } from "./edit-tenant-form";
import { TenantActions } from "./tenant-actions";

type PageProps = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = params;
  const [tenant] = await getDb()
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      logoUrl: tenants.logoUrl,
      accentColor: tenants.accentColor,
      timezone: tenants.timezone,
      isOpen: tenants.isOpen,
      isDemo: tenants.isDemo,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="font-mono text-xs text-slate-500">{tenant.slug}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Slug and created date are immutable.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditTenantForm tenant={tenant} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TenantActions tenant={tenant} />
        </CardContent>
      </Card>
    </div>
  );
}
