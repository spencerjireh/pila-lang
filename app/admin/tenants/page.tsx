import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TenantsListPage() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <Button asChild>
          <Link href="/admin/tenants/new">Create tenant</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No tenants yet. Create the first one to get started.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium hover:underline"
                      href={`/admin/tenants/${t.id}`}
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {t.slug}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Badge variant={t.isOpen ? "success" : "warning"}>
                        {t.isOpen ? "Open" : "Closed"}
                      </Badge>
                      {t.isDemo ? (
                        <Badge variant="secondary">Demo</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(t.createdAt).toLocaleDateString()}
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
