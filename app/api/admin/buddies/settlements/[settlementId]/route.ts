import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import {
  holdBuddySettlement,
  queueBuddyRefundIfPaid,
  releaseBuddySettlement,
} from "@/lib/server/buddySettlement";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ settlementId: string }> };
type Body = { action?: "hold" | "release" | "refund"; reason?: string };

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const { settlementId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    const reason = String(body.reason || "").trim().slice(0, 2000);
    if (!action || !["hold", "release", "refund"].includes(action) || !reason) {
      return NextResponse.json({ error: "請選擇動作並填寫原因。" }, { status: 400 });
    }
    const row = await supabaseAdmin
      .from("buddy_settlements")
      .select("*, buddy_bookings(*)")
      .eq("id", settlementId)
      .maybeSingle();
    if (row.error || !row.data) {
      return NextResponse.json({ error: row.error?.message || "找不到結算資料。" }, { status: 404 });
    }
    let result: unknown;
    if (action === "hold") {
      result = await holdBuddySettlement({
        bookingId: row.data.booking_id,
        actorUserId: admin.userId,
        reason,
      });
    } else if (action === "release") {
      result = await releaseBuddySettlement({
        bookingId: row.data.booking_id,
        adminUserId: admin.userId,
        reason,
      });
    } else {
      result = await queueBuddyRefundIfPaid({
        booking: row.data.buddy_bookings,
        requestedByUserId: admin.userId,
        reason,
      });
    }
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: `admin_buddy_settlement_${action}`,
      targetType: "buddy_settlement",
      targetId: settlementId,
      metadata: { booking_id: row.data.booking_id, reason },
    });
    return NextResponse.json({ result, build_tag: P3_BUILD_TAGS.settlement });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
