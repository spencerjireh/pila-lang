"use client";

import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { en } from "@/lib/i18n/en";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function SignInForm() {
  const t = en.admin.signIn;
  const tCheck = en.admin.checkEmail;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        setStatus("error");
        setError("Couldn’t send the link. Try again.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn’t send the link. Try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {tCheck.title}
        </h2>
        <p className="text-sm text-foreground">{tCheck.body}</p>
        <p className="text-sm text-muted-foreground">{tCheck.didntGet}</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : t.submit}
      </Button>
    </form>
  );
}
