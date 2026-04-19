"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pickForeground } from "@/lib/validators/contrast";

interface Props {
  slug: string;
  name: string;
  accentColor: string;
  onChange: (patch: { name?: string; accentColor?: string }) => void;
}

export function GeneralSection({ slug, name, accentColor, onChange }: Props) {
  const [nameValue, setNameValue] = useState(name);
  const [accentValue, setAccentValue] = useState(accentColor);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fg = pickForeground(accentValue);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const patch: { name?: string; accentColor?: string } = {};
    if (nameValue.trim() && nameValue.trim() !== name) patch.name = nameValue.trim();
    if (accentValue.trim() && accentValue.trim() !== accentColor) {
      patch.accentColor = accentValue.trim();
    }
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing to save.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/settings/general`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        if (body?.error === "invalid_accent_color") {
          setError(
            body.reason === "format"
              ? "Accent color must be a 6-digit hex code."
              : "Accent color must pass AA contrast against black or white.",
          );
          return;
        }
        setError("Validation failed.");
        return;
      }
      if (!res.ok) {
        setError("Could not save. Try again.");
        return;
      }
      const body = (await res.json()) as {
        tenant: { name: string; accentColor: string };
      };
      onChange({ name: body.tenant.name, accentColor: body.tenant.accentColor });
      toast.success("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">General</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Updates reach the host queue, wait page, and display within a second.
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tenant-name">Restaurant name</Label>
          <Input
            id="tenant-name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accent-color">Accent color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="accent-color"
              value={accentValue}
              onChange={(e) => setAccentValue(e.target.value)}
              placeholder="#1F6FEB"
              className="max-w-[180px] font-mono"
            />
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: accentValue, color: fg }}
            >
              Aa
            </span>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
