"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { TenantHeader } from "@/components/tenant-branding";
import { Button } from "@/components/ui/button";

import { BrandingSection } from "./_sections/branding-section";
import { GeneralSection } from "./_sections/general-section";
import { PasswordSection } from "./_sections/password-section";

export interface InitialTenant {
  name: string;
  logoUrl: string | null;
  accentColor: string;
  isOpen: boolean;
}

interface SettingsViewProps {
  slug: string;
  initial: InitialTenant;
}

export function SettingsView({ slug, initial }: SettingsViewProps) {
  const router = useRouter();
  const [tenant, setTenant] = useState<InitialTenant>(initial);

  const onBrandingChange = useCallback(
    (patch: Partial<InitialTenant>) => setTenant((t) => ({ ...t, ...patch })),
    [],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await fetch(`/api/host/${encodeURIComponent(slug)}/logout`, { method: "POST" });
    } catch {
      // fall through
    }
    router.replace(`/host/${encodeURIComponent(slug)}`);
  }, [slug, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <TenantHeader
          name={tenant.name}
          logoUrl={tenant.logoUrl}
          accentColor={tenant.accentColor}
          subtitle="Settings"
        />
        <Button variant="outline" asChild>
          <Link href={`/host/${encodeURIComponent(slug)}/queue`}>Back to queue</Link>
        </Button>
      </header>

      <GeneralSection
        slug={slug}
        name={tenant.name}
        accentColor={tenant.accentColor}
        onChange={onBrandingChange}
      />
      <BrandingSection
        slug={slug}
        logoUrl={tenant.logoUrl}
        accentColor={tenant.accentColor}
        name={tenant.name}
        onChange={onBrandingChange}
      />
      <PasswordSection slug={slug} onUnauthorized={() => {
        toast.error("Session expired. Please sign in again.");
        router.replace(`/host/${encodeURIComponent(slug)}`);
      }} />

      <footer className="mt-8 flex justify-end">
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </footer>
    </main>
  );
}
