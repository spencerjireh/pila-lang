import { en } from "@/lib/i18n/en";

export function HowItWorks() {
  const t = en.landing.howItWorks;
  const steps = [
    { key: "scan", ...t.steps.scan },
    { key: "join", ...t.steps.join },
    { key: "getTexted", ...t.steps.getTexted },
  ];
  return (
    <section id="how-it-works" className="space-y-10">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {t.eyebrow}
        </p>
        <h2 className="font-display text-4xl font-semibold text-foreground">
          {t.title}
        </h2>
      </header>
      <ol className="grid gap-8 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.key} className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              0{i + 1}
            </p>
            <h3 className="font-display text-2xl font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
