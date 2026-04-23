import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { en } from "@/lib/i18n/en";
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

  const t = en.admin.tenants.detail;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tenant.slug}
          </p>
          <h1 className="font-display text-4xl font-semibold text-foreground">
            {tenant.name}
          </h1>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/tenants">&larr; All tenants</Link>
        </Button>
      </header>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">{t.tabs.settings}</TabsTrigger>
          <TabsTrigger value="activity">{t.tabs.activity}</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.tabs.settings}</CardTitle>
              <CardDescription>{t.slugHelper}</CardDescription>
            </CardHeader>
            <CardContent>
              <EditTenantForm tenant={tenant} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Destructive operations on this tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TenantActions tenant={tenant} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>{t.tabs.activity}</CardTitle>
              <CardDescription>
                Recent queue activity for this tenant lands here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity timeline coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
