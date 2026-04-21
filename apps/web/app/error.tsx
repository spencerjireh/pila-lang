"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { en } from "@/lib/i18n/en";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = en.edge.error;
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center space-y-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Error
      </p>
      <h1 className="font-display text-5xl font-semibold text-foreground">
        {t.title}
      </h1>
      <p className="text-lg text-muted-foreground">{t.body}</p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          ref: {error.digest}
        </p>
      ) : null}
      <Button size="lg" onClick={reset}>
        {t.cta}
      </Button>
    </main>
  );
}
