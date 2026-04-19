"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface OneTimePasswordDialogProps {
  open: boolean;
  password: string | null;
  title?: string;
  description?: string;
  onClose: () => void;
}

export function OneTimePasswordDialog({
  open,
  password,
  title = "Initial host password",
  description = "Copy this password now — it is shown only once and cannot be retrieved later.",
  onClose,
}: OneTimePasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Alert variant="warning">
          <AlertTitle>One-time display</AlertTitle>
          <AlertDescription>
            Once you close this dialog, the password is gone. Hand it to the restaurant before
            dismissing.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-base">
            {password ?? "…"}
          </code>
          <Button type="button" variant="outline" onClick={copy} disabled={!password}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            I&apos;ve saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
