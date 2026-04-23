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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MIN_PASSWORD_LENGTH } from "@pila/shared/validators/password";

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
      setConfirmKickOpen(false);
    } catch {
      toast.error("Network error.");
    } finally {
      setKicking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Rotating the password signs out every other device on its next action.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={rotating}>
              {rotating ? "Updating\u2026" : "Change password"}
            </Button>
          </div>
        </form>

        <Separator className="my-6" />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            Sign out other devices
          </p>
          <p className="text-sm text-muted-foreground">
            Keeps the current password, signs out everyone else on their next
            action.
          </p>
          <div className="mt-2">
            <Dialog
              open={confirmKickOpen}
              onOpenChange={(next) => {
                if (!kicking) setConfirmKickOpen(next);
              }}
            >
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  Sign out other devices
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sign out all other devices?</DialogTitle>
                  <DialogDescription>
                    This keeps the current password. Every other host session
                    for this restaurant is ended on its next action.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={kicking}
                    onClick={() => setConfirmKickOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={kicking}
                    onClick={() => void kickOthers()}
                  >
                    {kicking ? "Signing out\u2026" : "Yes, sign out others"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
