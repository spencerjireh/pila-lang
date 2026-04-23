import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { en } from "@/lib/i18n/en";

export function Features() {
  const t = en.landing.features;
  const items = [
    { key: "liveQueue", ...t.items.liveQueue },
    { key: "hostConsole", ...t.items.hostConsole },
    { key: "branding", ...t.items.branding },
    { key: "printable", ...t.items.printable },
  ];
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
      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.key}>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {item.title}
              </CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </section>
  );
}
