"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await signIn("resend", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/admin/tenants",
      });
      if (res?.error) {
        setStatus("error");
        setError("Could not send magic link. Try again.");
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setError("Could not send magic link. Try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-2">
        <p className="text-sm">Check your email for a sign-in link.</p>
        <p className="text-sm text-slate-500">
          If you don&apos;t see it within a minute, your address may not be on the allow list.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
