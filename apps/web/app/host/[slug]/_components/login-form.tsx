"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { en } from "@/lib/i18n/en";

interface LoginFormProps {
  slug: string;
}

type Status = "idle" | "submitting" | "error";

export function LoginForm({ slug }: LoginFormProps) {
  const router = useRouter();
  const t = en.host.login;
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!password) {
      setStatus("error");
      setError(t.passwordHelper);
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/host/${encodeURIComponent(slug)}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(`/host/${encodeURIComponent(slug)}/queue`);
        return;
      }
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retryAfterSec?: number;
        };
        setStatus("error");
        setError(
          `Too many attempts. Try again in ${data.retryAfterSec ?? 60}s.`,
        );
        return;
      }
      if (res.status === 401) {
        setStatus("error");
        setError(t.wrongPassword);
        return;
      }
      setStatus("error");
      setError("Couldn\u2019t sign in. Try again.");
    } catch {
      setStatus("error");
      setError("Network hiccup. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {t.eyebrow}
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {t.title}
        </h1>
      </header>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{t.passwordHelper}</p>
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
          {status === "submitting" ? "Signing in\u2026" : t.submit}
        </Button>
      </form>
    </div>
  );
}
