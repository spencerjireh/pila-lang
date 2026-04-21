"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { en } from "@/lib/i18n/en";

export function Faq() {
  const t = en.landing.faq;
  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {t.eyebrow}
        </p>
        <h2 className="font-display text-4xl font-semibold text-foreground">
          {t.title}
        </h2>
      </header>
      <Accordion type="single" collapsible className="w-full">
        {t.items.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="font-display text-lg font-medium">
              {item.q}
            </AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
