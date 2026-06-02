import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

async function safeCount(table: string, apply?: (query: any) => any) {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);

    const [openTickets, openReports, openModerationCases, requestedRefunds, activeRooms, pendingPayments, paidPayments, recentReliability] = await Promise.all([
      safeCount("support_tickets", (q) => q.in("status", ["open", "pending", "admin_review"])),
      safeCount("user_reports", (q) => q.in("status", ["open", "triaged"])),
      safeCount("moderation_cases", (q) => q.in("status", ["open", "investigating", "action_required"])),
      safeCount("refund_requests", (q) => q.in("status", ["requested", "reviewing", "approved", "processing"])),
      safeCount("rooms", (q) => q.eq("status", "active").is("ended_at", null)),
      safeCount("payment_orders", (q) => q.eq("status", "pending")),
      safeCount("payment_orders", (q) => q.eq("status", "paid")),
      supabaseAdmin.from("reliability_events").select("id,user_id,room_id,event_type,severity,source,metadata,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_ops_summary_viewed",
      targetType: "ops_summary",
      metadata: { admin_by: admin.adminBy },
    });

    return NextResponse.json({
      summary: {
        open_tickets: openTickets,
        open_reports: openReports,
        open_moderation_cases: openModerationCases,
        requested_refunds: requestedRefunds,
        active_rooms: activeRooms,
        pending_payments: pendingPayments,
        paid_payments: paidPayments,
      },
      recent_reliability_events: recentReliability.data ?? [],
      build_tag: ADMIN_OPS_BUILD_TAG,
    });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
