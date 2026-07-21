import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ batchId: string }> };
type Body = {
  action?: "mark_processing" | "complete" | "cancel" | "fail";
  provider_reference?: string | null;
  note?: string | null;
};

export async function GET(req: Request, context: Context) {
  try {
    await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const { batchId } = await context.params;
    const [batch, items] = await Promise.all([
      supabaseAdmin.from("buddy_payout_batches").select("*").eq("id", batchId).maybeSingle(),
      supabaseAdmin.from("buddy_payout_items").select("*").eq("batch_id", batchId).order("created_at"),
    ]);
    if (batch.error) throw batch.error;
    if (items.error) throw items.error;
    if (!batch.data) return NextResponse.json({ error: "找不到撥款批次。" }, { status: 404 });
    return NextResponse.json({ batch: batch.data, items: items.data ?? [], build_tag: P3_BUILD_TAGS.payout });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const { batchId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    const providerReference = String(body.provider_reference || "").trim().slice(0, 180) || null;
    const note = String(body.note || "").trim().slice(0, 2000) || null;
    if (!action || !["mark_processing", "complete", "cancel", "fail"].includes(action)) {
      return NextResponse.json({ error: "無效的撥款批次動作。" }, { status: 400 });
    }
    if (action === "complete" && !providerReference) {
      return NextResponse.json({ error: "完成人工轉帳時必須填寫銀行交易參考碼。" }, { status: 400 });
    }
    const result = await supabaseAdmin.rpc("cowork_transition_buddy_payout_batch_v3", {
      p_batch_id: batchId,
      p_admin_user_id: admin.userId,
      p_action: action,
      p_provider_reference: providerReference,
      p_note: note,
    });
    if (result.error) throw result.error;
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: `admin_buddy_payout_batch_${action}`,
      targetType: "buddy_payout_batch",
      targetId: batchId,
      metadata: { provider_reference_present: Boolean(providerReference), note },
    });
    return NextResponse.json({ payout_batch: result.data, build_tag: P3_BUILD_TAGS.payout });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
