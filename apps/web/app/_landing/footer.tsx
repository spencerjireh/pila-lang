import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { en } from "@/lib/i18n/en";

export function Footer() {
  const t = en.landing.footer;
  return (
    <footer className="space-y-6 pb-16">
      <Separator />
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold text-foreground">
            {en.app.name}
          </p>
          <p className="text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            {t.privacy}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t.terms}
          </Link>
        </nav>
      </div>
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {t.copyright}
      </p>
    </footer>
  );
}
