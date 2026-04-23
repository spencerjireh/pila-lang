import { redirect } from "next/navigation";
import { auth } from "@pila/shared/auth/admin-session";
import { isAdminEmail } from "@pila/shared/validators/admin-allow-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { en } from "@/lib/i18n/en";
import { SignInForm } from "./_components/sign-in-form";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    redirect("/admin/tenants");
  }

  const t = en.admin.signIn;
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardDescription className="font-mono text-xs uppercase tracking-wide">
            {t.eyebrow}
          </CardDescription>
          <CardTitle className="font-display text-3xl">{t.title}</CardTitle>
          <CardDescription>{t.lede}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
