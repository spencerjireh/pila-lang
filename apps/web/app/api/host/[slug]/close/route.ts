import { hostOpenCloseHandler } from "@/lib/routes/host-open-close";

export const dynamic = "force-dynamic";

export const POST = hostOpenCloseHandler(false);
