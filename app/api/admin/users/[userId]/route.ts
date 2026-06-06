import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { adminNotes, getAuthUserSummary, safeRows, safeSingle } from "@/lib/server/admin360";

export const runtime = "nodejs";
type Context = { params: Promise<{ userId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { userId } = await context.params;
    const [authUser, entitlement, hostCredit, hostCreditEvents, paymentOrders, billingLedger, refundRequests, supportTickets, reportsByUser, reportsTargetingUser, moderationCases, roomsCreated, roomMemberships, subscriptions, subscriptionEvents, sponsorPasses, aiSessions, notes] = await Promise.all([
      getAuthUserSummary(userId),
      safeSingle("user_entitlements", (q) => q.eq("user_id", userId).maybeSingle()),
      safeSingle("host_credit_accounts", (q) => q.eq("user_id", userId).maybeSingle()),
      safeRows("host_credit_events", (q) => q.eq("user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("payment_orders", (q) => q.eq("user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("billing_ledger", (q) => q.eq("user_id", userId).order("occurred_at", { ascending: false }).limit(40)),
      safeRows("refund_requests", (q) => q.eq("user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("support_tickets", (q) => q.eq("user_id", userId).order("updated_at", { ascending: false }).limit(40)),
      safeRows("user_reports", (q) => q.eq("reporter_user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("user_reports", (q) => q.eq("target_user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("moderation_cases", (q) => q.eq("target_user_id", userId).order("updated_at", { ascending: false }).limit(40)),
      safeRows("rooms", (q) => q.eq("created_by", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("room_members", (q) => q.eq("user_id", userId).order("joined_at", { ascending: false }).limit(40)),
      safeRows("subscription_profiles", (q) => q.eq("user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("subscription_events", (q) => q.eq("user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("room_sponsor_passes", (q) => q.eq("sponsor_user_id", userId).order("created_at", { ascending: false }).limit(40)),
      safeRows("ai_room_host_sessions", (q) => q.eq("payer_user_id", userId).order("created_at", { ascending: false }).limit(40)),
      adminNotes("user", userId),
    ]);
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_user_360_viewed", targetType: "user", targetId: userId });
    return NextResponse.json({ user: authUser.user, sections: { entitlement, host_credit: hostCredit, host_credit_events: hostCreditEvents, payment_orders: paymentOrders, billing_ledger: billingLedger, refund_requests: refundRequests, support_tickets: supportTickets, reports_by_user: reportsByUser, reports_targeting_user: reportsTargetingUser, moderation_cases: moderationCases, rooms_created: roomsCreated, room_memberships: roomMemberships, subscriptions, subscription_events: subscriptionEvents, sponsor_passes: sponsorPasses, ai_sessions: aiSessions, notes }, errors: [authUser.error].filter(Boolean), build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
