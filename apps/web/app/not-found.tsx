import Link from "next/link";
import { Button } from "@/components/ui/button";
import { en } from "@/lib/i18n/en";

export default function NotFound() {
  const t = en.edge.notFound;
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center space-y-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1 className="font-display text-5xl font-semibold text-foreground">
        {t.title}
      </h1>
      <p className="text-lg text-muted-foreground">{t.body}</p>
      <Button asChild size="lg">
        <Link href="/">{t.cta}</Link>
      </Button>
    </main>
  );
}
