import type { ReactNode } from "react";
import { requireAdmin } from "@pila/shared/domain/auth/admin-guard";

export default async function TenantsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
