import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText, insertReliabilityEvent } from "@/lib/server/safety";

export const runtime = "nodejs";

type ReportBody = {
  target_type?: string;
  target_user_id?: string | null;
  target_room_id?: string | null;
  target_buddy_service_id?: string | null;
  target_buddy_booking_id?: string | null;
  category?: string;
  description?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
};

const TARGET_TYPES = new Set(["user", "room", "buddy_service", "buddy_booking", "payment_order", "ai", "other"]);
const CATEGORIES = new Set(["harassment", "sexual", "spam", "scam", "illegal", "self_harm", "privacy", "payment", "impersonation", "other"]);
const SEVERITIES = new Set(["low", "normal", "high", "critical"]);

function normalized(value: unknown, allowed: Set<string>, fallback: string) {
  const text = cleanText(value, 40);
  return allowed.has(text) ? text : fallback;
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { data, error } = await supabaseAdmin
      .from("user_reports")
      .select("id,target_type,target_user_id,target_room_id,target_buddy_service_id,target_buddy_booking_id,category,status,severity,created_at,updated_at")
      .eq("reporter_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ reports: data ?? [], build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看檢舉紀錄。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取檢舉紀錄失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as ReportBody;

    const targetType = normalized(body.target_type, TARGET_TYPES, "other");
    const category = normalized(body.category, CATEGORIES, "other");
    const severity = normalized(body.severity, SEVERITIES, category === "sexual" || category === "scam" ? "high" : "normal");
    const description = cleanText(body.description, 6000);

    if (!description) {
      return NextResponse.json({ error: "請填寫檢舉說明。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const insert = await supabaseAdmin
      .from("user_reports")
      .insert({
        reporter_user_id: userId,
        target_type: targetType,
        target_user_id: body.target_user_id || null,
        target_room_id: body.target_room_id || null,
        target_buddy_service_id: body.target_buddy_service_id || null,
        target_buddy_booking_id: body.target_buddy_booking_id || null,
        category,
        description,
        severity,
        status: "open",
        metadata: body.metadata ?? {},
      })
      .select("*")
      .single();

    if (insert.error || !insert.data) {
      return NextResponse.json({ error: insert.error?.message || "建立檢舉失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    await insertReliabilityEvent({
      userId: body.target_user_id || null,
      roomId: body.target_room_id || null,
      eventType: "report_received",
      severity: severity as any,
      source: "user_report",
      metadata: { report_id: insert.data.id, category, target_type: targetType },
    });

    return NextResponse.json({ report: insert.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再送出檢舉。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "送出檢舉失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
