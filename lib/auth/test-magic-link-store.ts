// Test-only: captures magic-link URLs in-memory when NODE_ENV === "test" or
// ENABLE_TEST_ROUTES === "1", so E2E can fetch them without hitting Resend.
declare global {
  var __magicLinks: Map<string, { url: string; at: number }> | undefined;
}

function store(): Map<string, { url: string; at: number }> {
  if (!globalThis.__magicLinks) globalThis.__magicLinks = new Map();
  return globalThis.__magicLinks;
}

export function captureMagicLink(email: string, url: string): void {
  store().set(email.toLowerCase(), { url, at: Date.now() });
}

export function latestMagicLink(email: string): { url: string; at: number } | null {
  return store().get(email.toLowerCase()) ?? null;
}
