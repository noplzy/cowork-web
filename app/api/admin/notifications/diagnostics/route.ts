import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

function present(name: string) {
  return Boolean(String(process.env[name] || "").trim());
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const diagnostics = {
      secrets: {
        NOTIFICATION_PROCESSOR_SECRET: present("NOTIFICATION_PROCESSOR_SECRET"),
        BILLING_AUTOMATION_SECRET: present("BILLING_AUTOMATION_SECRET"),
        CRON_SECRET: present("CRON_SECRET"),
        ROOM_CLEANUP_SECRET: present("ROOM_CLEANUP_SECRET"),
      },
      provider: {
        NOTIFICATION_PROVIDER_ENABLED: ["1", "true", "yes", "enabled"].includes(String(process.env.NOTIFICATION_PROVIDER_ENABLED || "").trim().toLowerCase()),
        NOTIFICATION_EMAIL_ENDPOINT: present("NOTIFICATION_EMAIL_ENDPOINT"),
        NOTIFICATION_SMS_ENDPOINT: present("NOTIFICATION_SMS_ENDPOINT"),
        NOTIFICATION_LINE_ENDPOINT: present("NOTIFICATION_LINE_ENDPOINT"),
        NOTIFICATION_TELEGRAM_ENDPOINT: present("NOTIFICATION_TELEGRAM_ENDPOINT"),
        NOTIFICATION_WEBHOOK_ENDPOINT: present("NOTIFICATION_WEBHOOK_ENDPOINT"),
      },
      note: "Only booleans are returned. Secret values are never exposed.",
    };
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_diagnostics_viewed", targetType: "notification_diagnostics" });
    return NextResponse.json({ diagnostics, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
