import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractBearer, getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";

export const runtime = "nodejs";
type SlotBody = { service_id?: string; starts_at?: string; ends_at?: string; note?: string | null; slot_status?: "open" | "held" | "booked" | "cancelled" };

async function tryViewer(req: Request) { if (!extractBearer(req)) return null; try { return await getAuthUserFromRequest(req); } catch { return null; } }
function validateSlotTime(startsAt: string, endsAt: string) {
  const start = new Date(startsAt); const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("請填寫有效時段。");
  if (end.getTime() <= start.getTime()) throw new Error("結束時間必須晚於開始時間。");
  const hours = (end.getTime() - start.getTime()) / 3600000;
  if (hours < 0.5 || hours > 8) throw new Error("單一時段需介於 0.5～8 小時。");
  return { start, end };
}

export async function GET(req: Request) {
  try {
    const viewer = await tryViewer(req);
    const url = new URL(req.url);
    const serviceId = String(url.searchParams.get("service_id") || "").trim();
    const mine = url.searchParams.get("mine") === "1";
    if (mine && !viewer?.userId) return NextResponse.json({ error: "請先登入後再查看自己的時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    let query = supabaseAdmin.from("buddy_service_slots").select("*").order("starts_at", { ascending: true }).limit(160);
    if (mine && viewer?.userId) query = query.eq("provider_user_id", viewer.userId);
    else if (serviceId) query = query.eq("service_id", serviceId).eq("slot_status", "open").gte("starts_at", new Date().toISOString());
    else return NextResponse.json({ error: "請指定 service_id，或使用 mine=1。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const result = await query;
    if (result.error) return NextResponse.json({ error: result.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ slots: result.data ?? [], build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as SlotBody;
    const serviceId = String(body.service_id || "").trim();
    const note = String(body.note || "").trim().slice(0, 300) || null;
    const slotStatus = body.slot_status || "open";
    if (!serviceId) return NextResponse.json({ error: "缺少 service_id。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    if (!["open", "held", "booked", "cancelled"].includes(slotStatus)) return NextResponse.json({ error: "無效的時段狀態。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const { start, end } = validateSlotTime(String(body.starts_at || ""), String(body.ends_at || ""));
    const service = await supabaseAdmin.from("buddy_services").select("id,provider_user_id").eq("id", serviceId).maybeSingle();
    if (service.error || !service.data) return NextResponse.json({ error: service.error?.message || "找不到服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    if (service.data.provider_user_id !== userId) return NextResponse.json({ error: "你沒有權限管理這個服務的時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    const inserted = await supabaseAdmin.from("buddy_service_slots").insert({ service_id: serviceId, provider_user_id: userId, starts_at: start.toISOString(), ends_at: end.toISOString(), slot_status: slotStatus, note }).select("*").single();
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error?.message || "建立時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ slot: inserted.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再管理時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "建立時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
