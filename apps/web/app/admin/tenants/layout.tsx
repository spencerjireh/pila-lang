import type { ReactNode } from "react";

import { requireAdminPage } from "@/lib/auth/guard-admin-page";

export default async function TenantsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();
  return <>{children}</>;
}
