import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@pila/shared/domain/auth/admin-session";
import { isAdminEmail } from "@pila/shared/primitives/validators/admin-allow-list";
import { Separator } from "@/components/ui/separator";
import { en } from "@/lib/i18n/en";
import { SignOutButton } from "./_components/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const isAuthed = !!(session?.user?.email && isAdminEmail(session.user.email));

  return (
    <div className="min-h-dvh bg-background">
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href={isAuthed ? "/admin/tenants" : "/admin"}
            className="font-display text-lg font-semibold text-foreground"
          >
            {en.app.name}{" "}
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Admin
            </span>
          </Link>
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                {session?.user?.email}
              </span>
              <SignOutButton />
            </div>
          ) : null}
        </div>
        <Separator />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
    </div>
  );
}
