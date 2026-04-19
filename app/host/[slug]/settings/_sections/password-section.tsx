"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/validators/password";

interface Props {
  slug: string;
  onUnauthorized: () => void;
}

export function PasswordSection({ slug, onUnauthorized }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmKickOpen, setConfirmKickOpen] = useState(false);
  const [kicking, setKicking] = useState(false);

  async function rotate(e: React.FormEvent) {
    e.preventDefault();
    if (rotating) return;
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setRotating(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/settings/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rotate", newPassword }),
        },
      );
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        setError("Could not rotate password.");
        return;
      }
      setNewPassword("");
      setConfirm("");
      toast.success("Password updated. Other devices are signed out.");
    } catch {
      setError("Network error.");
    } finally {
      setRotating(false);
    }
  }

  async function kickOthers() {
    if (kicking) return;
    setKicking(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(slug)}/settings/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout-others" }),
        },
      );
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        toast.error("Could not sign out other devices.");
        return;
      }
      toast.success("Other devices signed out.");
    } catch {
      toast.error("Network error.");
    } finally {
      setKicking(false);
      setConfirmKickOpen(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Password</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Rotating the password signs out every other device on its next action.
      </p>
      <form onSubmit={rotate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password-confirm">Confirm new password</Label>
          <Input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={rotating}>
            {rotating ? "Updating…" : "Change password"}
          </Button>
        </div>
      </form>

      <hr className="my-6 border-slate-200" />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Sign out other devices</p>
        <p className="text-sm text-slate-600">
          Keeps the current password, signs out everyone else on their next
          action.
        </p>
        {confirmKickOpen ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm">Sign out all other devices?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={kicking}
                onClick={() => void kickOthers()}
              >
                {kicking ? "Signing out…" : "Yes, sign out others"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={kicking}
                onClick={() => setConfirmKickOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmKickOpen(true)}
            >
              Sign out other devices
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
