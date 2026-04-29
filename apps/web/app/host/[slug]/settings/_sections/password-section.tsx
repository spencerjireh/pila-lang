"use client";

import { en } from "@/lib/i18n/en";

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
import { useJsonMutation } from "@/lib/forms/use-json-mutation";
import { MIN_PASSWORD_LENGTH } from "@pila/shared/primitives/validators/password";

interface Props {
  slug: string;
  onUnauthorized: () => void;
}

export function PasswordSection({ slug, onUnauthorized }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmKickOpen, setConfirmKickOpen] = useState(false);

  const rotate = useJsonMutation<{ action: "rotate"; newPassword: string }>();
  const kick = useJsonMutation<{ action: "logout-others" }>();

  async function onRotate(e: React.FormEvent) {
    e.preventDefault();
    if (rotate.status === "submitting") return;
    setLocalError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (newPassword !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    const result = await rotate.mutate(
      `/api/v1/host/${encodeURIComponent(slug)}/settings/password`,
      { action: "rotate", newPassword },
      {
        onUnauthorized,
        errorMap: () => "Could not rotate password.",
        networkError: en.errors.network,
      },
    );
    if (result !== null) {
      setNewPassword("");
      setConfirm("");
      toast.success("Password updated. Other devices are signed out.");
    }
  }

  async function onKickOthers() {
    const result = await kick.mutate(
      `/api/v1/host/${encodeURIComponent(slug)}/settings/password`,
      { action: "logout-others" },
      {
        onUnauthorized,
        errorMap: () => {
          toast.error("Could not sign out other devices.");
          return null;
        },
        networkError: en.errors.network,
      },
    );
    if (result !== null) {
      toast.success("Other devices signed out.");
      setConfirmKickOpen(false);
    } else if (kick.error) {
      toast.error(kick.error);
    }
  }

  const rotateError = localError ?? rotate.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Rotating the password signs out every other device on its next action.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onRotate} className="flex flex-col gap-4">
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
          {rotateError ? (
            <Alert variant="destructive">
              <AlertDescription>{rotateError}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={rotate.status === "submitting"}>
              {rotate.status === "submitting" ? "Updating…" : "Change password"}
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
                if (kick.status !== "submitting") setConfirmKickOpen(next);
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
                    disabled={kick.status === "submitting"}
                    onClick={() => setConfirmKickOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={kick.status === "submitting"}
                    onClick={() => void onKickOthers()}
                  >
                    {kick.status === "submitting"
                      ? "Signing out…"
                      : "Yes, sign out others"}
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
