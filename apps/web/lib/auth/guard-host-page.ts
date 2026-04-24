import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";

import {
  guardHostRequest,
  type HostGuardDecision,
} from "@pila/shared/auth/host-guard";

// Server-component pages can't mutate response headers, so refreshedCookie /
// refreshedBearer on the decision are ignored here — the SSE stream the page
// opens right after handles rolling refresh.
export async function guardHostPage(slug: string): Promise<HostGuardDecision> {
  const reqLike = {
    cookies: cookies(),
    headers: headers(),
  } as unknown as Pick<NextRequest, "cookies" | "headers">;
  return guardHostRequest(reqLike, slug);
}
