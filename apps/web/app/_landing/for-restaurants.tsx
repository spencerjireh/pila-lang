import Image from "next/image";

import { Button } from "@/components/ui/button";
import { en } from "@/lib/i18n/en";

export function ForRestaurants() {
  const t = en.landing.forRestaurants;
  const contactEmail = "hello@pila.lang";
  return (
    <section className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
      <figure className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted">
        <Image
          src="/images/landing/landing-for-restaurants.svg"
          alt=""
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      </figure>
      <div className="space-y-6">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {t.eyebrow}
        </p>
        <h2 className="font-display text-4xl font-semibold text-foreground">
          {t.title}
        </h2>
        <p className="max-w-xl text-lg text-muted-foreground">{t.body}</p>
        <Button asChild size="lg">
          <a href={`mailto:${contactEmail}?subject=Pila%20Lang%20pilot`}>
            {t.cta}
          </a>
        </Button>
      </div>
    </section>
  );
}
