import { NextResponse } from "next/server";

import { clearHostCookieHeader } from "@pila/shared/domain/auth/host-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("Set-Cookie", clearHostCookieHeader());
  return res;
}
