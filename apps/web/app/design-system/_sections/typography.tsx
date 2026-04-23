type Sample = {
  label: string;
  element: React.ReactNode;
};

const displaySamples: Sample[] = [
  {
    label: "font-display text-6xl font-bold",
    element: (
      <h1 className="font-display text-6xl font-bold text-foreground">
        Sun-warmed hospitality
      </h1>
    ),
  },
  {
    label: "font-display text-4xl font-semibold",
    element: (
      <h2 className="font-display text-4xl font-semibold text-foreground">
        We’ll text you when your table is ready
      </h2>
    ),
  },
  {
    label: "font-display text-2xl font-semibold",
    element: (
      <h3 className="font-display text-2xl font-semibold text-foreground">
        Party of four, twenty minutes
      </h3>
    ),
  },
];

const bodySamples: Sample[] = [
  {
    label: "text-lg",
    element: (
      <p className="text-lg text-foreground">
        Lede body. Used for standfirst copy on marketing surfaces and for
        moments that want to feel editorial.
      </p>
    ),
  },
  {
    label: "text-base",
    element: (
      <p className="text-base text-foreground">
        Default body text. Runs everywhere in the product — form copy, guest
        wait instructions, host controls. Uses Inter with stylistic sets cv11
        and ss03 for a warmer read.
      </p>
    ),
  },
  {
    label: "text-sm text-muted-foreground",
    element: (
      <p className="text-sm text-muted-foreground">
        Caption / secondary. For metadata, timestamps, helper text.
      </p>
    ),
  },
];

const monoSamples: Sample[] = [
  {
    label: "font-mono text-sm",
    element: (
      <p className="font-mono text-sm text-foreground">
        14:23 PST · party-a7f2 · pos 3
      </p>
    ),
  },
];

export function TypographySection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          02 · Typography
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Fraunces, Inter, JetBrains Mono
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Fraunces for display moments (variable font, opsz axis). Inter for
          body and UI. JetBrains Mono for codes, timestamps, and
          developer-facing values.
        </p>
      </header>

      <div className="space-y-6">
        <TypeGroup title="Display — Fraunces" samples={displaySamples} />
        <TypeGroup title="Body — Inter" samples={bodySamples} />
        <TypeGroup title="Mono — JetBrains Mono" samples={monoSamples} />
      </div>
    </section>
  );
}

function TypeGroup({ title, samples }: { title: string; samples: Sample[] }) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-6 border-l border-border pl-6">
        {samples.map((s, i) => (
          <div key={i} className="space-y-1">
            {s.element}
            <p className="font-mono text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
