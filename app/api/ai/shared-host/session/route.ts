import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { HOST_CREDIT_BUILD_TAG, activeCapSecondsForDuration } from "@/lib/server/hostCredit";

export const runtime = "nodejs";

type Body =
  | { action: "start"; room_id: string; sponsor_pass_id: string; provider?: string; model?: string; metadata?: Record<string, unknown> }
  | { action: "usage"; session_id: string; action_type: string; active_seconds?: number; input_tokens?: number; output_tokens?: number; provider_cost_estimate_twd?: number; metadata?: Record<string, unknown> }
  | { action: "end"; session_id: string; stop_reason?: string; metadata?: Record<string, unknown> };

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Body;

    if (body.action === "start") {
      const pass = await supabaseAdmin.from("room_sponsor_passes").select("*").eq("id", body.sponsor_pass_id).eq("room_id", body.room_id).eq("status", "active").maybeSingle();
      if (pass.error || !pass.data) return NextResponse.json({ error: pass.error?.message || "找不到可用的 AI 主持通行證。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 404 });

      if (pass.data.sponsor_user_id !== userId) {
        const membership = await supabaseAdmin.from("room_members").select("room_id,user_id").eq("room_id", body.room_id).eq("user_id", userId).maybeSingle();
        if (membership.error || !membership.data) return NextResponse.json({ error: "只有房間成員可以啟動 Shared Host。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 403 });
      }

      const session = await supabaseAdmin.from("ai_room_host_sessions").insert({
        room_id: body.room_id,
        payer_user_id: pass.data.sponsor_user_id,
        sponsor_pass_id: pass.data.id,
        status: "active",
        ai_mode: "shared_host",
        provider: body.provider || null,
        model: body.model || null,
        host_credit_budget: pass.data.host_credits_reserved,
        active_seconds_cap: activeCapSecondsForDuration(Number(pass.data.duration_minutes || 25)),
        metadata: body.metadata ?? {},
      }).select("*").single();

      if (session.error || !session.data) return NextResponse.json({ error: session.error?.message || "建立 AI 主持 session 失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 400 });
      await supabaseAdmin.from("room_sponsor_passes").update({ status: "consumed", consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", pass.data.id);
      return NextResponse.json({ session: session.data, build_tag: HOST_CREDIT_BUILD_TAG });
    }

    if (body.action === "usage") {
      const session = await supabaseAdmin.from("ai_room_host_sessions").select("*").eq("id", body.session_id).maybeSingle();
      if (session.error || !session.data) return NextResponse.json({ error: session.error?.message || "找不到 AI 主持 session。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 404 });
      const activeSeconds = Math.max(0, Number(body.active_seconds || 0));
      const nextSeconds = Number(session.data.active_seconds_used || 0) + activeSeconds;

      if (nextSeconds > Number(session.data.active_seconds_cap || 0)) {
        await supabaseAdmin.from("ai_usage_events").insert({ session_id: session.data.id, room_id: session.data.room_id, user_id: userId, payer_user_id: session.data.payer_user_id, ai_mode: session.data.ai_mode, action_type: body.action_type, active_seconds: activeSeconds, status: "blocked", stop_reason: "active_cap_exceeded", metadata: { cap: session.data.active_seconds_cap, attempted_total: nextSeconds, ...(body.metadata ?? {}) } });
        return NextResponse.json({ error: "Shared Host 已達本場主動介入上限。", code: "AI_ACTIVE_CAP_EXCEEDED", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 429 });
      }

      const usage = await supabaseAdmin.from("ai_usage_events").insert({ session_id: session.data.id, room_id: session.data.room_id, user_id: userId, payer_user_id: session.data.payer_user_id, ai_mode: session.data.ai_mode, action_type: body.action_type, active_seconds: activeSeconds, input_tokens: body.input_tokens ?? null, output_tokens: body.output_tokens ?? null, provider: session.data.provider, model: session.data.model, provider_cost_estimate_twd: body.provider_cost_estimate_twd ?? null, status: "recorded", metadata: body.metadata ?? {} }).select("*").single();
      if (usage.error || !usage.data) return NextResponse.json({ error: usage.error?.message || "記錄 AI usage 失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 400 });
      await supabaseAdmin.from("ai_room_host_sessions").update({ active_seconds_used: nextSeconds, updated_at: new Date().toISOString() }).eq("id", session.data.id);
      return NextResponse.json({ usage: usage.data, active_seconds_used: nextSeconds, build_tag: HOST_CREDIT_BUILD_TAG });
    }

    if (body.action === "end") {
      const ended = await supabaseAdmin.from("ai_room_host_sessions").update({ status: "ended", ended_at: new Date().toISOString(), stop_reason: body.stop_reason || "manual_end", metadata: body.metadata ?? {}, updated_at: new Date().toISOString() }).eq("id", body.session_id).select("*").single();
      if (ended.error || !ended.data) return NextResponse.json({ error: ended.error?.message || "結束 AI 主持 session 失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 400 });
      return NextResponse.json({ session: ended.data, build_tag: HOST_CREDIT_BUILD_TAG });
    }

    return NextResponse.json({ error: "未知 action。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再使用 AI 主持。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "AI 主持 session 操作失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 500 });
  }
}
