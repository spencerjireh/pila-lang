import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If your address is on the allow list, a sign-in link is on its way.
            The link expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">You can close this tab.</p>
        </CardContent>
      </Card>
    </div>
  );
}
