import { en } from "@/lib/i18n/en";

export function VoiceSection() {
  const voice = en.designSystem.voice;
  const rows: { context: string; sample: string }[] = [
    { context: "Welcome state", sample: voice.welcome },
    { context: "Wait confirmation", sample: voice.waitTimeNotice },
    { context: "Table ready", sample: voice.tableReady },
    { context: "Seated moment · only allowed !", sample: voice.seated },
    { context: "Primary CTA", sample: voice.confirmJoin },
    { context: "Destructive CTA", sample: voice.leaveQueue },
    { context: "Thanks moment", sample: voice.thanksForWaiting },
    { context: "Farewell", sample: voice.seeYouSoon },
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          06 · Voice
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Warm hospitality register
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Sentence case. Contractions preferred. No exclamation points in UI
          states — the “you’ve been seated” moment is the one allowed exception.
          Strings live in <code>apps/web/lib/i18n/en.ts</code>, never hardcoded.
        </p>
      </header>
      <dl className="space-y-8 border-l border-border pl-6">
        {rows.map((r) => (
          <div key={r.context} className="space-y-2">
            <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {r.context}
            </dt>
            <dd className="font-display text-2xl text-foreground">
              {r.sample}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
