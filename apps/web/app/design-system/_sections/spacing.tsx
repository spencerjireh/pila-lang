const steps = [
  { label: "w-1", className: "w-1", token: "0.25rem" },
  { label: "w-2", className: "w-2", token: "0.5rem" },
  { label: "w-4", className: "w-4", token: "1rem" },
  { label: "w-6", className: "w-6", token: "1.5rem" },
  { label: "w-8", className: "w-8", token: "2rem" },
  { label: "w-12", className: "w-12", token: "3rem" },
  { label: "w-16", className: "w-16", token: "4rem" },
  { label: "w-24", className: "w-24", token: "6rem" },
];

export function SpacingSection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          03 · Spacing
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Tailwind defaults, no overrides
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          The scale stays Tailwind default unless a surface earns an override.
          Two density modes: editorial on public-facing (landing, guest wait,
          kiosk), balanced on internal (host console, admin).
        </p>
      </header>
      <div className="space-y-3">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-6">
            <div className={`${s.className} h-4 rounded-sm bg-primary`} />
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-foreground">
                {s.label}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {s.token}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
