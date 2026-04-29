/**
 * Single source of truth for the JWT-refresh response header.
 *
 * Both host and guest auth flows mint a refreshed bearer token on the way out
 * when the request enters the refresh window — clients (mobile especially)
 * pick the new token off this header. host-guard.ts and guest-guard.ts
 * re-export this constant so a single rename here is enough.
 */
export const REFRESH_HEADER = "X-Refreshed-Token";
