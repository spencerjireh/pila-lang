import { redirect } from "next/navigation";
import { auth } from "@pila/shared/auth/admin-session";
import { isAdminEmail } from "@pila/shared/validators/admin-allow-list";
import { SignInForm } from "./_components/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    redirect("/admin/tenants");
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            We&apos;ll email you a magic link. Only allow-listed addresses can
            sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
