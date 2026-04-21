const radii = [
  { label: "rounded-sm", className: "rounded-sm", value: "calc(0.5rem - 4px)" },
  { label: "rounded-md", className: "rounded-md", value: "calc(0.5rem - 2px)" },
  { label: "rounded-lg", className: "rounded-lg", value: "0.5rem" },
  { label: "rounded-full", className: "rounded-full", value: "9999px" },
];

export function RadiiSection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          04 · Radii
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          shadcn default, one knob
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Built off <code>--radius: 0.5rem</code>. Sharper reads cold; softer
          reads consumer-app. The default sits in the warm-and-analog pocket.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {radii.map((r) => (
          <figure key={r.label} className="space-y-3">
            <div
              className={`${r.className} h-24 w-full border border-border bg-muted`}
            />
            <figcaption className="space-y-1">
              <div className="font-mono text-xs text-foreground">{r.label}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {r.value}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
