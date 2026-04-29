"use client";

import { en } from "@/lib/i18n/en";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  tenantId: string;
  slug: string;
  tenantName: string;
}

export function DeleteTenantDialog({ tenantId, slug, tenantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = typed === slug && !busy;

  async function onDelete() {
    if (!canDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${tenantId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Could not delete tenant.");
        return;
      }
      toast.success("Tenant deleted");
      setOpen(false);
      router.push("/admin/tenants");
      router.refresh();
    } catch {
      toast.error(en.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Delete tenant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {tenantName}?</DialogTitle>
          <DialogDescription>
            This is irreversible. All parties and notifications will be wiped.
            Active guests will see a generic closed screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-slug">
            Type the slug <code className="font-mono">{slug}</code> to confirm.
          </Label>
          <Input
            id="confirm-slug"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={slug}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={!canDelete}
          >
            {busy ? "Deleting…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
