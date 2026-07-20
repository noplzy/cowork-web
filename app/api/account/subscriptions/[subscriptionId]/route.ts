import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";

type Context = { params: Promise<{ subscriptionId: string }> };
type Body = { action?: "cancel"; reason?: string };

export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { subscriptionId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.action !== "cancel") {
      return NextResponse.json(
        { error: "無效的訂閱操作。", build_tag: P2_BUILD_TAGS.entitlement },
        { status: 400 },
      );
    }

    const profile = await supabaseAdmin.from("subscription_profiles")
      .select("id,user_id,plan_code,status,current_period_end,cancel_requested_at")
      .eq("id", subscriptionId).eq("user_id", userId).maybeSingle();
    if (profile.error || !profile.data) {
      return NextResponse.json(
        { error: profile.error?.message || "找不到訂閱。", build_tag: P2_BUILD_TAGS.entitlement },
        { status: 404 },
      );
    }
    if (["cancelled", "expired"].includes(String(profile.data.status))) {
      return NextResponse.json({ subscription: profile.data, build_tag: P2_BUILD_TAGS.entitlement });
    }

    const nowIso = new Date().toISOString();
    const reason = String(body.reason || "user_requested").trim().slice(0, 1000) || "user_requested";
    const updated = await supabaseAdmin.from("subscription_profiles")
      .update({
        status: "cancel_pending",
        cancel_requested_at: nowIso,
        cancel_requested_by_user_id: userId,
        cancel_reason: reason,
        updated_at: nowIso,
      })
      .eq("id", subscriptionId).eq("user_id", userId).select("*").single();
    if (updated.error || !updated.data) throw updated.error || new Error("更新訂閱失敗。");

    const entitlementUpdate = await supabaseAdmin.from("user_plan_entitlements")
      .update({ status: "cancel_pending", cancel_at_period_end: true, updated_at: nowIso })
      .eq("user_id", userId)
      .eq("plan_code", profile.data.plan_code)
      .in("status", ["active", "cancel_pending"]);
    if (entitlementUpdate.error) throw entitlementUpdate.error;

    const event = await supabaseAdmin.from("subscription_events").insert({
      subscription_profile_id: subscriptionId,
      user_id: userId,
      event_type: "cancel_requested",
      provider_payload: {
        reason,
        source: "account_subscriptions_v130",
        entitlement_valid_until: profile.data.current_period_end,
        build_tag: P2_BUILD_TAGS.entitlement,
      },
    });
    if (event.error) throw event.error;

    const task = await supabaseAdmin.from("ecpay_subscription_tasks").insert({
      subscription_profile_id: subscriptionId,
      user_id: userId,
      action_type: "cancel_profile",
      status: "queued",
      provider_payload: {
        source: "account_cancel_request_v130",
        reason,
        cancel_at_period_end: true,
      },
    });
    if (task.error) throw task.error;

    return NextResponse.json({
      subscription: updated.data,
      entitlement_preserved_until: profile.data.current_period_end,
      cancel_at_period_end: true,
      build_tag: P2_BUILD_TAGS.entitlement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "取消訂閱失敗。";
    return NextResponse.json(
      { error: message, build_tag: P2_BUILD_TAGS.entitlement },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
