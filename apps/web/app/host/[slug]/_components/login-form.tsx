"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJsonMutation } from "@/lib/forms/use-json-mutation";
import { en } from "@/lib/i18n/en";

interface LoginFormProps {
  slug: string;
}

export function LoginForm({ slug }: LoginFormProps) {
  const router = useRouter();
  const t = en.host.login;
  const [password, setPassword] = useState("");
  const { mutate, status, error, reset } = useJsonMutation<{
    password: string;
  }>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!password) {
      reset();
      return;
    }
    const result = await mutate(
      `/api/v1/host/${encodeURIComponent(slug)}/login`,
      { password },
      {
        errorMap: ({ status }) =>
          status === 401 ? t.wrongPassword : "Couldn’t sign in. Try again.",
      },
    );
    if (result !== null) {
      router.replace(`/host/${encodeURIComponent(slug)}/queue`);
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
          {status === "submitting" ? "Signing in…" : t.submit}
        </Button>
      </form>
    </div>
  );
}
