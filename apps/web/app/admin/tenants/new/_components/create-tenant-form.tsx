"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OneTimePasswordDialog } from "../../../_components/one-time-password";
import { TimezoneInput } from "../../../_components/timezone-input";
import { DEFAULT_TIMEZONE } from "@pila/shared/primitives/timezones";

export function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [submitting, setSubmitting] = useState(false);
  const [initialPassword, setInitialPassword] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, timezone }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message =
          body.error === "slug_taken"
            ? "A tenant with that slug already exists."
            : body.error === "invalid_slug" && body.reason === "reserved"
              ? "That slug is reserved."
              : body.error === "invalid_slug"
                ? "Slug must be 3–32 lowercase letters, numbers, or hyphens."
                : body.error === "invalid_timezone"
                  ? "Pick a valid IANA timezone."
                  : "Could not create tenant.";
        toast.error(message);
        return;
      }
      setInitialPassword(body.initialPassword);
      setCreatedId(body.tenant.id);
      toast.success("Tenant created");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onDialogClose() {
    setInitialPassword(null);
    if (createdId) router.push(`/admin/tenants/${createdId}`);
  }

  return (
    <>
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
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]"
            placeholder="garden-table"
          />
          <p className="text-xs text-slate-500">
            3–32 lowercase letters, numbers, or hyphens. Cannot be changed
            later.
          </p>
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create tenant"}
        </Button>
      </form>

      <OneTimePasswordDialog
        open={initialPassword !== null}
        password={initialPassword}
        onClose={onDialogClose}
      />
    </>
  );
}
