"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneInput } from "../../../_components/timezone-input";

export interface EditableTenant {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string;
  timezone: string;
  isOpen: boolean;
  isDemo: boolean;
}

export function EditTenantForm({ tenant }: { tenant: EditableTenant }) {
  const router = useRouter();
  const [name, setName] = useState(tenant.name);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl ?? "");
  const [accentColor, setAccentColor] = useState(tenant.accentColor);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const [isOpen, setIsOpen] = useState(tenant.isOpen);
  const [isDemo, setIsDemo] = useState(tenant.isDemo);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
          accentColor,
          timezone,
          isOpen,
          isDemo,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(
          body.error === "invalid_accent_color"
            ? "Accent color fails WCAG AA against both black and white."
            : body.error === "invalid_timezone"
              ? "Pick a valid IANA timezone."
              : "Could not save changes.",
        );
        return;
      }
      toast.success("Saved");
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input
          id="logoUrl"
          type="url"
          placeholder="https://…"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          Leave empty to use the accent-colored initials badge.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accentColor">Accent color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="accentColor"
            required
            pattern="^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="font-mono"
          />
          <div
            className="h-9 w-9 rounded-md border border-slate-300"
            style={{
              backgroundColor: /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(
                accentColor,
              )
                ? accentColor
                : "transparent",
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <TimezoneInput
          id="timezone"
          required
          value={timezone}
          onChange={setTimezone}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Flags</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            className="h-4 w-4"
          />
          Open (accept new guests)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDemo}
            onChange={(e) => setIsDemo(e.target.checked)}
            className="h-4 w-4"
          />
          Demo tenant (enables reset-demo action)
        </label>
      </fieldset>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
