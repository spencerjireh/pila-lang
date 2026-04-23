"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import PhoneInput, { type Value as PhoneValue } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { en } from "@/lib/i18n/en";

interface JoinFormProps {
  slug: string;
  token: string;
}

type Status = "idle" | "submitting" | "error";

const PARTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

export function JoinForm({ slug, token }: JoinFormProps) {
  const router = useRouter();
  const t = en.guest.join;
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [phone, setPhone] = useState<PhoneValue | undefined>();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus("error");
      setError("Add a name so the host knows who you are.");
      return;
    }

    try {
      const res = await fetch(
        `/api/r/${encodeURIComponent(slug)}/join?t=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            partySize,
            phone: phone ?? null,
          }),
        },
      );

      if (res.status === 201) {
        const data = (await res.json()) as { waitUrl: string };
        router.replace(data.waitUrl);
        return;
      }

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "already_waiting") {
          router.refresh();
          return;
        }
        if (data.error === "tenant_closed") {
          setStatus("error");
          setError("This restaurant just stopped accepting guests.");
          return;
        }
      }

      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retryAfterSec?: number;
        };
        const wait = data.retryAfterSec ?? 60;
        setStatus("error");
        setError(`Too many requests. Try again in ${wait} seconds.`);
        return;
      }

      if (res.status === 401) {
        setStatus("error");
        setError("The QR has expired. Scan it again.");
        return;
      }

      setStatus("error");
      setError("Something went wrong. Try again.");
    } catch {
      setStatus("error");
      setError("Network hiccup. Try again.");
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t.nameLabel}</Label>
        <Input
          id="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="partySize">{t.partySizeLabel}</Label>
        <Select
          value={String(partySize)}
          onValueChange={(v) => setPartySize(Number(v))}
        >
          <SelectTrigger id="partySize">
            <SelectValue placeholder={t.partySizePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {PARTY_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{t.phoneLabel}</Label>
        <PhoneInput
          id="phone"
          international
          defaultCountry="IN"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          className="phone-input"
        />
        <p className="text-xs text-muted-foreground">{t.phoneHelper}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Joining\u2026" : t.submit}
      </Button>
    </form>
  );
}
