type ImagerySlot = {
  label: string;
  ratio: string;
  aspectClass: string;
  use: string;
  fillClass: string;
  containerClass?: string;
};

const slots: ImagerySlot[] = [
  {
    label: "landing-hero",
    ratio: "16:9",
    aspectClass: "aspect-[16/9]",
    use: "Landing hero, section heroes",
    fillClass: "bg-muted",
  },
  {
    label: "og-image",
    ratio: "40:21",
    aspectClass: "aspect-[40/21]",
    use: "OG image (~1200×630)",
    fillClass: "bg-accent",
  },
  {
    label: "empty-state",
    ratio: "1:1",
    aspectClass: "aspect-square",
    use: "Empty-state squares, social tiles",
    fillClass: "bg-muted",
    containerClass: "max-w-sm",
  },
  {
    label: "onboarding-panel",
    ratio: "9:16",
    aspectClass: "aspect-[9/16]",
    use: "Mobile onboarding, kiosk vertical",
    fillClass: "bg-accent",
    containerClass: "max-w-[12rem]",
  },
  {
    label: "table-tent",
    ratio: "3:4",
    aspectClass: "aspect-[3/4]",
    use: "Printable table tent, counter card",
    fillClass: "bg-muted",
    containerClass: "max-w-xs",
  },
];

export function ImagerySection() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          07 · Imagery
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Warm editorial, no faces
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Two locked Midjourney style references (<code>photo_sref</code> for
          photography, <code>illo_sref</code> for flat illustration) will drive
          every image on every surface. Both are TBD — placeholders below show
          the aspect-ratio contract only.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {slots.map((s) => (
          <figure
            key={s.label}
            className={`space-y-3 ${s.containerClass ?? ""}`}
          >
            <div
              className={`${s.aspectClass} ${s.fillClass} flex w-full items-center justify-center rounded-md border border-border`}
            >
              <span className="font-mono text-xs text-muted-foreground">
                --sref TBD · {s.ratio}
              </span>
            </div>
            <figcaption className="space-y-1">
              <div className="font-mono text-xs text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.use}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
