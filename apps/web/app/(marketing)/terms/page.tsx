import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Footer } from "@/app/_landing/footer";
import { en } from "@/lib/i18n/en";

export const metadata: Metadata = {
  title: `${en.legal.terms.title} \u2014 ${en.app.name}`,
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  const t = en.legal.terms;
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          &larr; {en.app.name}
        </Link>
        <h1 className="font-display text-5xl font-semibold text-foreground">
          {t.title}
        </h1>
      </header>
      <Alert variant="warning">
        <AlertTitle>{t.draftBanner}</AlertTitle>
        <AlertDescription>{t.body}</AlertDescription>
      </Alert>
      <Footer />
    </main>
  );
}
