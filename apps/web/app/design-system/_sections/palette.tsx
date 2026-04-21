type Swatch = {
  name: string;
  className: string;
  hsl: string;
  hex: string;
  use: string;
};

const swatches: Swatch[] = [
  {
    name: "background",
    className: "bg-background",
    hsl: "36 33% 97%",
    hex: "#F9F5EE",
    use: "App background",
  },
  {
    name: "foreground",
    className: "bg-foreground",
    hsl: "25 25% 18%",
    hex: "#3A2F25",
    use: "Body text",
  },
  {
    name: "card",
    className: "bg-card",
    hsl: "36 33% 97%",
    hex: "#F9F5EE",
    use: "Card surface (mirrors background in v1)",
  },
  {
    name: "popover",
    className: "bg-popover",
    hsl: "36 40% 98%",
    hex: "#FAF7F0",
    use: "Popover surface",
  },
  {
    name: "primary",
    className: "bg-primary",
    hsl: "82 22% 38%",
    hex: "#6B7747",
    use: "Primary actions, brand",
  },
  {
    name: "primary-foreground",
    className: "bg-primary-foreground",
    hsl: "36 40% 98%",
    hex: "#FAF7F0",
    use: "Text on primary",
  },
  {
    name: "secondary",
    className: "bg-secondary",
    hsl: "60 15% 90%",
    hex: "#E7E6DC",
    use: "Secondary surface",
  },
  {
    name: "muted",
    className: "bg-muted",
    hsl: "60 20% 92%",
    hex: "#EAE9DD",
    use: "Subdued surfaces, cards",
  },
  {
    name: "muted-foreground",
    className: "bg-muted-foreground",
    hsl: "28 12% 42%",
    hex: "#78695A",
    use: "Secondary text",
  },
  {
    name: "accent",
    className: "bg-accent",
    hsl: "82 25% 80%",
    hex: "#C7CFAE",
    use: "Hover / selection",
  },
  {
    name: "destructive",
    className: "bg-destructive",
    hsl: "10 55% 42%",
    hex: "#A8513A",
    use: "Leave queue, remove party",
  },
  {
    name: "success",
    className: "bg-success",
    hsl: "82 28% 32%",
    hex: "#545F36",
    use: "Seated, confirmed",
  },
  {
    name: "warning",
    className: "bg-warning",
    hsl: "38 65% 52%",
    hex: "#D59B35",
    use: "Soft alerts",
  },
  {
    name: "border",
    className: "bg-border",
    hsl: "36 20% 85%",
    hex: "#DAD3C4",
    use: "Dividers, input outlines",
  },
  {
    name: "input",
    className: "bg-input",
    hsl: "36 20% 85%",
    hex: "#DAD3C4",
    use: "Input outlines (mirrors border)",
  },
  {
    name: "ring",
    className: "bg-ring",
    hsl: "82 22% 38%",
    hex: "#6B7747",
    use: "Focus ring (mirrors primary)",
  },
];

export function PaletteSection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          01 · Palette
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Olive, sage, warm cream
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Provisional values — final hex codes lock after Midjourney mood
          exploration. Every token maps to an HSL-split CSS variable and is
          available as a Tailwind utility (e.g. <code>bg-primary</code>).
        </p>
      </header>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {swatches.map((s) => (
          <figure key={s.name} className="space-y-3">
            <div
              className={`${s.className} h-24 w-full rounded-md border border-border`}
            />
            <figcaption className="space-y-1">
              <div className="font-mono text-xs text-foreground">
                --{s.name}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {s.hsl} · {s.hex}
              </div>
              <div className="text-xs text-muted-foreground">{s.use}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
