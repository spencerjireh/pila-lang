"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  slug: string;
}

type Status = "idle" | "submitting" | "error";

export function LoginForm({ slug }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!password) {
      setStatus("error");
      setError("Enter the shared host password.");
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
        setError("Wrong password. Check with your manager.");
        return;
      }
      setStatus("error");
      setError("Could not sign in. Please try again.");
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
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
        {status === "submitting" ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
