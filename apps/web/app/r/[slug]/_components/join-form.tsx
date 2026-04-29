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
import { useJsonMutation } from "@/lib/forms/use-json-mutation";
import { en } from "@/lib/i18n/en";

interface JoinFormProps {
  slug: string;
  token: string;
}

interface JoinSuccess {
  waitUrl: string;
}

const PARTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

export function JoinForm({ slug, token }: JoinFormProps) {
  const router = useRouter();
  const t = en.guest.join;
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [phone, setPhone] = useState<PhoneValue | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const { mutate, status, error, reset } = useJsonMutation<
    { name: string; partySize: number; phone: string | null },
    JoinSuccess
  >();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setLocalError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Add a name so the host knows who you are.");
      return;
    }
    reset();

    const data = await mutate(
      `/api/v1/r/${encodeURIComponent(slug)}/join?t=${encodeURIComponent(token)}`,
      { name: trimmed, partySize, phone: phone ?? null },
      {
        errorMap: ({ status, error }) => {
          if (status === 409 && error === "already_waiting") {
            router.refresh();
            return null;
          }
          if (status === 409 && error === "tenant_closed") {
            return "This restaurant just stopped accepting guests.";
          }
          if (status === 401) return "The QR has expired. Scan it again.";
          return "Something went wrong. Try again.";
        },
      },
    );
    if (data) router.replace(data.waitUrl);
  }

  const displayError = localError ?? error;

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

      {displayError ? (
        <Alert variant="destructive">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Joining…" : t.submit}
      </Button>
    </form>
  );
}
