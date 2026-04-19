import { env } from "../config/env";

export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return env().ADMIN_EMAILS.includes(normalized);
}
