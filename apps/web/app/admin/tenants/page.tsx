import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@pila/db/client";
import { tenants } from "@pila/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { en } from "@/lib/i18n/en";

export const dynamic = "force-dynamic";

export default async function TenantsListPage() {
  const t = en.admin.tenants;
  const rows = await getDb()
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      isOpen: tenants.isOpen,
      isDemo: tenants.isDemo,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {en.admin.nav.tenants}
          </p>
          <h1 className="font-display text-4xl font-semibold text-foreground">
            {t.title}
          </h1>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">{t.createCta}</Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {t.empty}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left font-mono text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-foreground hover:underline"
                      href={`/admin/tenants/${row.id}`}
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {row.slug}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Badge variant={row.isOpen ? "success" : "warning"}>
                        {row.isOpen ? "Open" : "Closed"}
                      </Badge>
                      {row.isDemo ? (
                        <Badge variant="secondary">Demo</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
