import Image from "next/image";

import { Button } from "@/components/ui/button";
import { en } from "@/lib/i18n/en";

export function Hero() {
  const t = en.landing.hero;
  const contactEmail = "hello@pila.lang";
  return (
    <section className="space-y-12 pt-12 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t.eyebrow}
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-foreground sm:text-6xl">
            {t.title}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t.lede}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href={`mailto:${contactEmail}?subject=Pila%20Lang%20demo`}>
                {t.primaryCta}
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#how-it-works">{t.secondaryCta}</a>
            </Button>
          </div>
        </div>
        <figure className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src="/images/landing/landing-hero-primary.svg"
            alt=""
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            priority
            className="object-cover"
          />
        </figure>
      </div>
    </section>
  );
}
