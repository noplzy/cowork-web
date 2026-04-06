import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG, type BuddyServiceRow } from "@/lib/buddies";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ serviceId: string }> };
type SlotPayload = { starts_at?: string; hours?: number; note?: string | null; slot_id?: string };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { serviceId } = await context.params;
    const result = await supabaseAdmin
      .from("buddy_service_slots")
      .select("*")
      .eq("service_id", serviceId)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (result.error) {
      return NextResponse.json({ error: result.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ slots: result.data ?? [], build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取可預約時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { serviceId } = await context.params;
    const body = (await req.json()) as SlotPayload;

    const serviceResult = await supabaseAdmin.from("buddy_services").select("*").eq("id", serviceId).maybeSingle();
    const service = serviceResult.data as BuddyServiceRow | null;
    if (serviceResult.error || !service) {
      return NextResponse.json({ error: serviceResult.error?.message ?? "找不到服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }
    if (service.provider_user_id !== userId) {
      return NextResponse.json({ error: "你沒有權限管理這個服務的時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const startsAt = new Date((body.starts_at ?? "").trim());
    const hours = Number(body.hours ?? 1);
    const note = (body.note ?? "").trim().slice(0, 200) || null;

    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "時段開始時間必須晚於現在。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 4) {
      return NextResponse.json({ error: "每個可預約時段只支援 1～4 小時。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const endsAt = new Date(startsAt.getTime() + hours * 60 * 60 * 1000).toISOString();
    const insertResult = await supabaseAdmin
      .from("buddy_service_slots")
      .insert({
        service_id: serviceId,
        provider_user_id: userId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt,
        slot_status: "open",
        note,
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ error: insertResult.error?.message ?? "建立可預約時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ slot: insertResult.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再管理可預約時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { serviceId } = await context.params;
    const url = new URL(req.url);
    const slotId = (url.searchParams.get("slotId") ?? "").trim();

    if (!slotId) {
      return NextResponse.json({ error: "缺少 slotId。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const result = await supabaseAdmin
      .from("buddy_service_slots")
      .delete()
      .eq("id", slotId)
      .eq("service_id", serviceId)
      .eq("provider_user_id", userId)
      .eq("slot_status", "open");

    if (result.error) {
      return NextResponse.json({ error: result.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ ok: true, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再刪除可預約時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "刪除可預約時段失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
