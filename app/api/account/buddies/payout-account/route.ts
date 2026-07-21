import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import {
  requireApprovedBuddyProvider,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS, buddiesPayoutMode } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  bank_code?: string;
  account_last5?: string;
  account_holder_name?: string;
  consent?: boolean;
};

function safeProjection(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    payout_method: row.payout_method,
    bank_code: row.bank_code,
    account_last5: row.account_last5,
    account_holder_name: row.account_holder_name,
    status: row.status,
    reviewer_note: row.status === "rejected" ? row.reviewer_note : null,
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    secure_reference_present: Boolean(row.secure_provider_reference),
  };
}

export async function GET(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const result = await supabaseAdmin
      .from("buddy_payout_accounts")
      .select("*")
      .eq("provider_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    return NextResponse.json({
      payout_account: safeProjection(result.data),
      payout_mode: buddiesPayoutMode(),
      raw_bank_account_stored: false,
      build_tag: P3_BUILD_TAGS.payout,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, P3_BUILD_TAGS.payout);
    if (mapped) return mapped;
    return NextResponse.json(
      { error: error?.message || "讀取收款設定失敗。" },
      { status: Number(error?.status || 500) },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(userId);
    await requireApprovedBuddyProvider(userId);
    const body = (await req.json().catch(() => ({}))) as Body;
    const bankCode = String(body.bank_code || "").replace(/\D/g, "").slice(0, 3);
    const last5 = String(body.account_last5 || "").replace(/\D/g, "").slice(-5);
    const holder = String(body.account_holder_name || "").trim().slice(0, 80);
    if (!/^\d{3}$/.test(bankCode)) {
      return NextResponse.json({ error: "銀行代碼需為 3 碼。" }, { status: 400 });
    }
    if (!/^\d{4,5}$/.test(last5)) {
      return NextResponse.json(
        { error: "只填寫帳號末 4～5 碼，不要輸入完整帳號。" },
        { status: 400 },
      );
    }
    if (holder.length < 2 || body.consent !== true) {
      return NextResponse.json(
        { error: "請填寫戶名並確認人工核對聲明。" },
        { status: 400 },
      );
    }

    const existing = await supabaseAdmin
      .from("buddy_payout_accounts")
      .select("id,status")
      .eq("provider_user_id", userId)
      .in("status", ["pending_review", "verified"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;

    const payload = {
      provider_user_id: userId,
      payout_method: "manual_bank_transfer",
      bank_code: bankCode,
      account_last5: last5,
      account_holder_name: holder,
      status: "pending_review",
      secure_provider_reference: null,
      verified_at: null,
      verified_by_admin_user_id: null,
      reviewer_note: null,
      metadata: {
        raw_account_number_stored: false,
        consent_confirmed: true,
        build_tag: P3_BUILD_TAGS.payout,
      },
      updated_at: new Date().toISOString(),
    };

    const result = existing.data
      ? await supabaseAdmin
          .from("buddy_payout_accounts")
          .update(payload)
          .eq("id", existing.data.id)
          .eq("provider_user_id", userId)
          .select("*")
          .single()
      : await supabaseAdmin
          .from("buddy_payout_accounts")
          .insert(payload)
          .select("*")
          .single();
    if (result.error || !result.data) {
      throw result.error || new Error("儲存收款設定失敗。");
    }

    return NextResponse.json({
      payout_account: safeProjection(result.data),
      next_step: "admin_secure_out_of_band_verification",
      build_tag: P3_BUILD_TAGS.payout,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, P3_BUILD_TAGS.payout);
    if (mapped) return mapped;
    return NextResponse.json(
      { error: error?.message || "儲存收款設定失敗。" },
      { status: Number(error?.status || 500) },
    );
  }
}
