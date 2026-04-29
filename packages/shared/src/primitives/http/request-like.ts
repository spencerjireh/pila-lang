/**
 * Minimal request shape consumed by guards and request-parsing helpers.
 *
 * NextRequest, Web `Request` (when wrapped), and Express `Request` (via the
 * adapter in apps/api) all satisfy this interface. Keeps `packages/shared`
 * runtime-agnostic — no `next/server` import required.
 */
export interface RequestLike {
  cookies: {
    get(name: string): { value: string } | undefined;
  };
  headers: {
    get(name: string): string | null;
  };
}

export interface RequestLikeWithJson extends RequestLike {
  json(): Promise<unknown>;
}
