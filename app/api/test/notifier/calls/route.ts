import { requireTestEnv } from "@/lib/test-api/guard";
import { testSpyNotifier } from "@/lib/notifier";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = requireTestEnv();
  if (guard) return guard;

  const spy = testSpyNotifier();
  if (!spy)
    return Response.json({
      calls: [],
      note: "notifier is not a TestSpyNotifier",
    });
  const calls = spy.drain();
  return Response.json({ calls });
}
