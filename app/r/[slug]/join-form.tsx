"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import PhoneInput, { type Value as PhoneValue } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JoinFormProps {
  slug: string;
  token: string;
}

type Status = "idle" | "submitting" | "error";

const PARTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

export function JoinForm({ slug, token }: JoinFormProps) {
  const router = useRouter();
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
      setError("Please enter a name.");
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
        setError(`Too many requests — try again in ${wait} seconds.`);
        return;
      }

      if (res.status === 401) {
        setStatus("error");
        setError("The QR code has expired. Please scan it again.");
        return;
      }

      setStatus("error");
      setError("Something went wrong. Please try again.");
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="partySize">Party size</Label>
        <select
          id="partySize"
          value={partySize}
          onChange={(e) => setPartySize(Number(e.target.value))}
          className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          {PARTY_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <PhoneInput
          id="phone"
          international
          defaultCountry="IN"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          className="phone-input"
        />
        <p className="text-xs text-slate-500">
          Used to remember you if you come back.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Joining…" : "Join the queue"}
      </Button>
    </form>
  );
}
