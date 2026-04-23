export function ShadowsSection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          05 · Shadows
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          One elevation, subtle
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          No stacked shadows, no neumorphism. When in doubt, separate surfaces
          with a hairline warm border rather than a shadow.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <figure className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-md bg-card text-sm text-muted-foreground shadow-sm">
            shadow-sm
          </div>
          <figcaption className="font-mono text-xs text-muted-foreground">
            Minimal shadow · reserve for floating surfaces
          </figcaption>
        </figure>
        <figure className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground">
            border border-border
          </div>
          <figcaption className="font-mono text-xs text-muted-foreground">
            Prefer border over shadow (default)
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
