import { NextResponse } from "next/server";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ disputeId: string }> };
type PatchBody = {
  action?: "review" | "resolve" | "reject" | "cancel";
  settlement_resolution?: "release" | "refund" | "manual_review";
  admin_note?: string | null;
};

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, {
      permission: "buddies.disputes",
    });
    const { disputeId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const action = body.action;
    const note = String(body.admin_note || "").trim().slice(0, 3000);
    const resolution = body.settlement_resolution || "manual_review";
    if (!action || !["review", "resolve", "reject", "cancel"].includes(action)) {
      return NextResponse.json({ error: "無效的爭議處理動作。" }, { status: 400 });
    }
    if (["resolve", "reject", "cancel"].includes(action) && !note) {
      return NextResponse.json({ error: "結案時必須填寫處理說明。" }, { status: 400 });
    }
    if (action === "resolve" && !["release", "refund", "manual_review"].includes(resolution)) {
      return NextResponse.json({ error: "請指定款項釋放、全額退款或人工處理。" }, { status: 400 });
    }

    const result = await supabaseAdmin.rpc("cowork_resolve_buddy_dispute_v3", {
      p_dispute_id: disputeId,
      p_admin_user_id: admin.userId,
      p_action: action,
      p_settlement_resolution: resolution,
      p_admin_note: note || null,
    });
    if (result.error) throw result.error;

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_dispute_resolved_v3",
      targetType: "buddy_dispute",
      targetId: disputeId,
      metadata: { action, settlement_resolution: resolution },
    });

    return NextResponse.json({
      result: result.data,
      build_tag: P3_BUILD_TAGS.settlement,
    });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
