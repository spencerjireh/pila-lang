import { Resend } from "resend";
import { env } from "@/lib/config/env";

let cached: Resend | undefined;

function client(): Resend {
  if (!cached) cached = new Resend(env().RESEND_API_KEY);
  return cached;
}

export async function sendMagicLink(params: { to: string; url: string; host: string }): Promise<void> {
  const { to, url, host } = params;
  const from = process.env.ADMIN_MAGIC_LINK_FROM ?? "Queue Admin <onboarding@resend.dev>";
  const subject = `Sign in to ${host}`;
  const text = `Sign in to ${host}\n\n${url}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = magicLinkHtml({ url, host });
  await client().emails.send({ from, to, subject, text, html });
}

function magicLinkHtml({ url, host }: { url: string; host: string }): string {
  return `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; padding: 24px; color: #0f172a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">Sign in to ${escapeHtml(host)}</h1>
  <p>Click the button below to sign in. This link expires in 24 hours.</p>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none;">Sign in</a></p>
  <p style="color:#64748b;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
