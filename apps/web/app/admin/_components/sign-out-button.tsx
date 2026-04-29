"use client";

import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function SignOutButton() {
  async function onClick() {
    try {
      await fetch(`${API_BASE}/api/v1/auth/sign-out`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.assign("/admin");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Sign out
    </Button>
  );
}
