import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  provider_user_id?: string;
  settlement_ids?: string[];
  note?: string | null;
};

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "all");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
    let query = supabaseAdmin
      .from("buddy_payout_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status !== "all") query = query.eq("status", status);
    const result = await query;
    if (result.error) throw result.error;
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_payout_batches_listed",
      targetType: "buddy_payout_batches",
      metadata: { status, limit },
    });
    return NextResponse.json({ payout_batches: result.data ?? [], build_tag: P3_BUILD_TAGS.payout });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const body = (await req.json().catch(() => ({}))) as Body;
    const providerUserId = String(body.provider_user_id || "").trim();
    const settlementIds = Array.from(
      new Set((body.settlement_ids || []).map((value) => String(value).trim()).filter(Boolean)),
    ).slice(0, 100);
    const note = String(body.note || "").trim().slice(0, 2000) || null;
    if (!providerUserId || settlementIds.length === 0) {
      return NextResponse.json({ error: "請指定提供者與至少一筆可撥款結算。" }, { status: 400 });
    }
    const result = await supabaseAdmin.rpc("cowork_create_buddy_payout_batch_v3", {
      p_admin_user_id: admin.userId,
      p_provider_user_id: providerUserId,
      p_settlement_ids: settlementIds,
      p_note: note,
    });
    if (result.error) throw result.error;
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_payout_batch_created",
      targetType: "buddy_payout_batch",
      targetId: String((result.data as any)?.batch?.id || ""),
      metadata: { provider_user_id: providerUserId, settlement_ids: settlementIds },
    });
    return NextResponse.json({ payout_batch: result.data, build_tag: P3_BUILD_TAGS.payout });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
