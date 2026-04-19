const BEARER_PREFIX = "bearer ";

export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  if (header.length < BEARER_PREFIX.length) return null;
  if (header.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}
