import { NextResponse } from "next/server";
import { NOTIFICATION_OUTBOX_BUILD_TAG, processNotificationOutbox, verifyNotificationProcessorSecret } from "@/lib/server/notificationOutbox";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    verifyNotificationProcessorSecret(req);
    const processed = await processNotificationOutbox(50);
    return NextResponse.json({ ok: true, processed, build_tag: NOTIFICATION_OUTBOX_BUILD_TAG });
  } catch (error: any) {
    const status = error?.status || (/UNAUTHORIZED/.test(error?.message || "") ? 401 : 500);
    return NextResponse.json({ error: error?.message || "notification processing failed", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
