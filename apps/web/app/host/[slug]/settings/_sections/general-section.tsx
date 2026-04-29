"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJsonMutation } from "@/lib/forms/use-json-mutation";
import { pickForeground } from "@pila/shared/primitives/validators/contrast";

interface Props {
  slug: string;
  name: string;
  accentColor: string;
  onChange: (patch: { name?: string; accentColor?: string }) => void;
}

interface GeneralPatch {
  name?: string;
  accentColor?: string;
}

interface UpdateResp {
  tenant: { name: string; accentColor: string };
}

export function GeneralSection({ slug, name, accentColor, onChange }: Props) {
  const [nameValue, setNameValue] = useState(name);
  const [accentValue, setAccentValue] = useState(accentColor);
  const { mutate, status, error } = useJsonMutation<GeneralPatch, UpdateResp>();

  const fg = pickForeground(accentValue);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    const patch: GeneralPatch = {};
    if (nameValue.trim() && nameValue.trim() !== name)
      patch.name = nameValue.trim();
    if (accentValue.trim() && accentValue.trim() !== accentColor) {
      patch.accentColor = accentValue.trim();
    }
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing to save.");
      return;
    }

    const body = await mutate(
      `/api/v1/host/${encodeURIComponent(slug)}/settings/general`,
      patch,
      {
        method: "PATCH",
        errorMap: ({ status, error, body }) => {
          if (status === 422 && error === "invalid_accent_color") {
            return body?.reason === "format"
              ? "Accent color must be a 6-digit hex code."
              : "Accent color must pass AA contrast against black or white.";
          }
          if (status === 422) return "Validation failed.";
          return "Could not save. Try again.";
        },
        networkError: "Network error.",
      },
    );
    if (body) {
      onChange({
        name: body.tenant.name,
        accentColor: body.tenant.accentColor,
      });
      toast.success("Saved.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Updates reach the host queue, wait page, and display within a second.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
