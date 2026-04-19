import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth/admin-session";
import { isAdminEmail } from "@/lib/validators/admin-allow-list";
import { SignOutButton } from "./_components/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const isAuthed = !!(session?.user?.email && isAdminEmail(session.user.email));

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href={isAuthed ? "/admin/tenants" : "/admin"}
            className="font-semibold"
          >
            Queue Admin
          </Link>
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {session?.user?.email}
              </span>
              <SignOutButton />
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
