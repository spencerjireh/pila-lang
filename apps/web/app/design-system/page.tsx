import type { Metadata } from "next";
import { PaletteSection } from "./_sections/palette";
import { TypographySection } from "./_sections/typography";
import { SpacingSection } from "./_sections/spacing";
import { RadiiSection } from "./_sections/radii";
import { ShadowsSection } from "./_sections/shadows";
import { VoiceSection } from "./_sections/voice";
import { ImagerySection } from "./_sections/imagery";
import { ComponentsSection } from "./_sections/components";

export const metadata: Metadata = {
  title: "Design system — Pila Lang",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-24 px-6 py-16">
      <header className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Living styleguide · v1 · provisional
        </p>
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">
          Pila Lang design system
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Every token, type ramp, and primitive the product ships today. Source
          of truth for visual decisions — see DESIGN.md for the rationale.
        </p>
      </header>
      <PaletteSection />
      <TypographySection />
      <SpacingSection />
      <RadiiSection />
      <ShadowsSection />
      <VoiceSection />
      <ImagerySection />
      <ComponentsSection />
    </main>
  );
}
