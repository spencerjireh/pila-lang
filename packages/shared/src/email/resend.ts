import { Resend } from "resend";
import { env } from "../config/env";

let cached: Resend | undefined;

function client(): Resend {
  if (!cached) cached = new Resend(env().RESEND_API_KEY);
  return cached;
}

export async function sendMagicLink(params: {
  to: string;
  url: string;
  host: string;
}): Promise<void> {
  const { to, url, host } = params;
  const from =
    process.env.ADMIN_MAGIC_LINK_FROM ??
    "Pila Lang Admin <onboarding@resend.dev>";
  const subject = `Sign in to ${host}`;
  const text = `Sign in to ${host}\n\n${url}\n\nThe link expires in 24 hours. If you didn\u2019t ask for it, you can ignore this email.`;
  const html = magicLinkHtml({ url, host });
  await client().emails.send({ from, to, subject, text, html });
}

const PALETTE = {
  bg: "#F9F5EE",
  card: "#FAF7F0",
  border: "#DAD3C4",
  fg: "#3A2F25",
  muted: "#78695A",
  primary: "#6B7747",
  primaryFg: "#FAF7F0",
};

function magicLinkHtml({ url, host }: { url: string; host: string }): string {
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Sign in to ${safeHost}</title>
  </head>
  <body style="margin:0;padding:0;background:${PALETTE.bg};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${PALETTE.fg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETTE.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${PALETTE.card};border:1px solid ${PALETTE.border};border-radius:8px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${PALETTE.muted};">
                  Pila Lang Admin
                </p>
                <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:28px;line-height:1.2;color:${PALETTE.fg};">
                  Sign in to ${safeHost}
                </h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${PALETTE.muted};">
                  Tap the button below to sign in. The link expires in 24 hours.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;background:${PALETTE.primary};color:${PALETTE.primaryFg};text-decoration:none;font-weight:500;font-size:15px;padding:12px 20px;border-radius:6px;">
                    Sign in
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${PALETTE.muted};">
                  If the button doesn\u2019t work, paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:${PALETTE.muted};word-break:break-all;">
                  ${safeUrl}
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:${PALETTE.muted};">
                  Didn\u2019t ask for this? You can safely ignore the email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
