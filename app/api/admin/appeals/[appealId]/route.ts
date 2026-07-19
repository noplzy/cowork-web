import { NextResponse } from "next/server";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import {
  APPEALS_BUILD_TAG,
  appendAppealMessage,
  decideAppeal,
  getAdminAppeal,
} from "@/lib/server/appeals";
import { queueNotification } from "@/lib/server/notificationOutbox";
import type { AppealStatus } from "@/lib/server/trustOps";

export const runtime = "nodejs";
type Context = { params: Promise<{ appealId: string }> };

type PatchBody = {
  status?: AppealStatus;
  admin_response?: string | null;
  decision_reason?: string | null;
  create_restore_action?: boolean;
  admin_message?: string | null;
  metadata?: Record<string, unknown>;
};

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "appeals.manage" });
    const { appealId } = await context.params;
    const payload = await getAdminAppeal(appealId);
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_appeal_viewed",
      targetType: "appeal",
      targetId: appealId,
    });
    return NextResponse.json({ ...payload, build_tag: APPEALS_BUILD_TAG });
  } catch (error: any) {
    const result = adminErrorResponse(error);
    return NextResponse.json({ ...result.body, build_tag: APPEALS_BUILD_TAG }, { status: result.status });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "appeals.manage" });
    const { appealId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const before = await getAdminAppeal(appealId);

    if (body.admin_message && !body.status) {
      await appendAppealMessage({
        appealId,
        actorUserId: admin.userId,
        actorRole: "admin",
        body: body.admin_message,
      });
    }

    let decisionResult: any = null;
    if (body.status) {
      decisionResult = await decideAppeal({
        appealId,
        adminUserId: admin.userId,
        status: body.status,
        adminResponse: body.admin_response || null,
        decisionReason: body.decision_reason || null,
        createRestoreAction: Boolean(body.create_restore_action),
        metadata: body.metadata ?? {},
      });
    }

    const after = await getAdminAppeal(appealId);
    const userId = after.appeal.user_id as string;
    if (body.status || body.admin_message) {
      const visibleResponse = body.admin_response || body.admin_message || "申訴狀態已更新。";
      await queueNotification({
        userId,
        channel: "in_app",
        templateKey: "appeal_updated",
        subject: "申訴已更新",
        body: visibleResponse.slice(0, 300),
        priority: body.status === "accepted" || body.status === "rejected" ? "high" : "normal",
        targetType: "appeal",
        targetId: appealId,
        dedupeKey: `appeal_updated:${appealId}:${after.appeal.updated_at}`,
        metadata: { status: after.appeal.status },
      }).catch(() => null);
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_appeal_updated",
      targetType: "appeal",
      targetId: appealId,
      metadata: {
        from_status: before.appeal.status,
        to_status: after.appeal.status,
        create_restore_action: Boolean(body.create_restore_action),
        resolution_action_id: after.appeal.resolution_action_id || null,
      },
    });

    return NextResponse.json({
      appeal: after.appeal,
      decision_result: decisionResult,
      build_tag: APPEALS_BUILD_TAG,
    });
  } catch (error: any) {
    const result = adminErrorResponse(error);
    return NextResponse.json({ ...result.body, build_tag: APPEALS_BUILD_TAG }, { status: result.status });
  }
}
