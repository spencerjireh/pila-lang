"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { OneTimePasswordDialog } from "../../_components/one-time-password";
import { DeleteTenantDialog } from "./delete-tenant-dialog";

interface TenantActionsProps {
  tenant: {
    id: string;
    slug: string;
    name: string;
    isDemo: boolean;
  };
}

export function TenantActions({ tenant }: TenantActionsProps) {
  const router = useRouter();
  const [resetPw, setResetPw] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reset-password" | "reset-demo" | null>(null);

  async function doResetPassword() {
    if (busy) return;
    setBusy("reset-password");
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/reset-password`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error("Could not reset password.");
        return;
      }
      setResetPw(body.initialPassword);
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function doResetDemo() {
    if (busy) return;
    const confirmed = window.confirm(
      `Reset demo data for ${tenant.name}? This wipes all parties and notifications and reseeds the demo fixture.`,
    );
    if (!confirmed) return;
    setBusy("reset-demo");
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/reset-demo`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "internal" }));
        toast.error(
          body.error === "not_demo" ? "Only demo tenants can be reset." : "Could not reset demo.",
        );
        return;
      }
      toast.success("Demo data reset");
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={doResetPassword} disabled={busy !== null}>
          {busy === "reset-password" ? "Rotating…" : "Reset host password"}
        </Button>
        {tenant.isDemo ? (
          <Button variant="outline" onClick={doResetDemo} disabled={busy !== null}>
            {busy === "reset-demo" ? "Resetting…" : "Reset demo data"}
          </Button>
        ) : null}
        <DeleteTenantDialog tenantId={tenant.id} slug={tenant.slug} tenantName={tenant.name} />
      </div>

      <OneTimePasswordDialog
        open={resetPw !== null}
        password={resetPw}
        title="New host password"
        description="Copy this now — it cannot be retrieved later. All other host sessions for this tenant will be signed out on their next request."
        onClose={() => setResetPw(null)}
      />
    </>
  );
}
