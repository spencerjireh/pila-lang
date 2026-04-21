import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { en } from "@/lib/i18n/en";

export default function CheckEmailPage() {
  const t = en.admin.checkEmail;
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t.title}</CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.didntGet}</p>
        </CardContent>
      </Card>
    </div>
  );
}
