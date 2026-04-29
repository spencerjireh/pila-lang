"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { TenantHeader } from "@/components/tenant-branding";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { en } from "@/lib/i18n/en";

import { BrandingSection } from "../_sections/branding-section";
import { GeneralSection } from "../_sections/general-section";
import { PasswordSection } from "../_sections/password-section";

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
  const t = en.host.settings;
  const [tenant, setTenant] = useState<InitialTenant>(initial);

  const onBrandingChange = useCallback(
    (patch: Partial<InitialTenant>) =>
      setTenant((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await fetch(`/api/v1/host/${encodeURIComponent(slug)}/logout`, {
        method: "POST",
      });
    } catch {
      // fall through
    }
    router.replace(`/host/${encodeURIComponent(slug)}`);
  }, [slug, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 p-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <TenantHeader
            name={tenant.name}
            logoUrl={tenant.logoUrl}
            accentColor={tenant.accentColor}
          />
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {t.title}
          </h1>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/host/${encodeURIComponent(slug)}/queue`}>
            &larr; Back to queue
          </Link>
        </Button>
      </header>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">{t.tabs.general}</TabsTrigger>
          <TabsTrigger value="branding">{t.tabs.branding}</TabsTrigger>
          <TabsTrigger value="password">{t.tabs.password}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralSection
            slug={slug}
            name={tenant.name}
            accentColor={tenant.accentColor}
            onChange={onBrandingChange}
          />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingSection
            slug={slug}
            logoUrl={tenant.logoUrl}
            accentColor={tenant.accentColor}
            name={tenant.name}
            onChange={onBrandingChange}
          />
        </TabsContent>
        <TabsContent value="password">
          <PasswordSection
            slug={slug}
            onUnauthorized={() => {
              toast.error("Session expired. Sign in again.");
              router.replace(`/host/${encodeURIComponent(slug)}`);
            }}
          />
        </TabsContent>
      </Tabs>

      <footer className="mt-8 flex justify-end">
        <Button variant="outline" onClick={handleSignOut}>
          {en.host.nav.signOut}
        </Button>
      </footer>
    </main>
  );
}
