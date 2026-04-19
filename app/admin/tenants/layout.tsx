import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-guard";

export default async function TenantsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
