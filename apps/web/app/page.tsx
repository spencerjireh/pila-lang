import type { Metadata } from "next";
import { Hero } from "./_landing/hero";
import { HowItWorks } from "./_landing/how-it-works";
import { Features } from "./_landing/features";
import { ForRestaurants } from "./_landing/for-restaurants";
import { Faq } from "./_landing/faq";
import { Footer } from "./_landing/footer";
import { en } from "@/lib/i18n/en";

export const metadata: Metadata = {
  title: en.app.name,
  description: en.app.tagline,
  openGraph: {
    title: en.app.name,
    description: en.app.tagline,
    type: "website",
    images: [
      {
        url: "/images/landing/landing-og.svg",
        width: 1200,
        height: 630,
        alt: en.app.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: en.app.name,
    description: en.app.tagline,
    images: ["/images/landing/landing-og.svg"],
  },
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-24 px-6 py-12">
      <Hero />
      <HowItWorks />
      <Features />
      <ForRestaurants />
      <Faq />
      <Footer />
    </main>
  );
}
