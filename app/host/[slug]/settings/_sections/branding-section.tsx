"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { TenantHeader } from "@/components/tenant-branding";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/logo-limits";

interface Props {
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  name: string;
  onChange: (patch: { logoUrl?: string | null }) => void;
}

export function BrandingSection({ slug, logoUrl, accentColor, name, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (uploading) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Logo must be under 500KB.");
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Only PNG or JPG are supported.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/settings/logo`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errorMessage(body?.error));
        return;
      }
      const body = (await res.json()) as { logoUrl: string | null };
      onChange({ logoUrl: body.logoUrl });
      toast.success("Logo updated.");
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearLogo() {
    if (removing) return;
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/settings/logo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clear: true }),
        },
      );
      if (!res.ok) {
        setError("Could not remove logo.");
        return;
      }
      onChange({ logoUrl: null });
      toast.success("Logo removed.");
    } catch {
      setError("Network error.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Branding</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Upload a square logo (PNG or JPG, under 500KB). We re-encode to 512×512.
      </p>
      <div className="mb-4 flex items-center gap-4">
        <TenantHeader name={name} logoUrl={logoUrl} accentColor={accentColor} size="lg" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
          className="block text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-900 hover:file:bg-slate-50"
          disabled={uploading}
        />
        {logoUrl ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void clearLogo()}
            disabled={removing || uploading}
          >
            {removing ? "Removing…" : "Remove logo"}
          </Button>
        ) : null}
      </div>
      {uploading ? (
        <p className="mt-3 text-sm text-slate-500" aria-live="polite">
          Uploading…
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function errorMessage(code?: string): string {
  switch (code) {
    case "invalid_mime":
      return "Only PNG or JPG are supported.";
    case "too_large":
      return "Logo must be under 500KB.";
    case "bad_dimensions":
      return "Logo must be between 64×64 and 4096×4096 pixels.";
    case "decode_failed":
      return "Could not read that image.";
    case "storage_failed":
      return "Storage failed. Try again.";
    default:
      return "Upload failed.";
  }
}
