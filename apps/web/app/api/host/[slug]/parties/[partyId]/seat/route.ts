import { hostPartyActionHandler } from "@/lib/routes/host-party-action";

export const dynamic = "force-dynamic";

export const POST = hostPartyActionHandler("seat");
