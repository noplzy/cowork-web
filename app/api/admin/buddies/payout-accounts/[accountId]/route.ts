import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ accountId: string }> };
type Body = {
  action?: "verify" | "reject" | "suspend" | "reopen";
  secure_provider_reference?: string | null;
  reviewer_note?: string | null;
};

function looksLikeRawBankAccount(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8;
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, {
      permission: "billing.manage",
    });
    const { accountId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    const note = String(body.reviewer_note || "").trim().slice(0, 2000) || null;
    const secureReference = String(body.secure_provider_reference || "")
      .trim()
      .slice(0, 240) || null;
    if (!action || !["verify", "reject", "suspend", "reopen"].includes(action)) {
      return NextResponse.json({ error: "無效的收款帳戶動作。" }, { status: 400 });
    }
    if (action === "verify") {
      if (!secureReference || !/^(vault|secure-ref|password-manager):\/\//i.test(secureReference)) {
        return NextResponse.json(
          { error: "驗證時必須填入外部安全保管系統的 reference，例如 vault://record-id。" },
          { status: 400 },
        );
      }
      if (looksLikeRawBankAccount(secureReference)) {
        return NextResponse.json(
          { error: "secure reference 不得包含完整銀行帳號。" },
          { status: 400 },
        );
      }
    }
    if (["reject", "suspend"].includes(action) && !note) {
      return NextResponse.json({ error: "駁回或停用必須填寫原因。" }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from("buddy_payout_accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { error: existing.error?.message || "找不到收款帳戶。" },
        { status: 404 },
      );
    }
    const status =
      action === "verify"
        ? "verified"
        : action === "reject"
          ? "rejected"
          : action === "suspend"
            ? "suspended"
            : "pending_review";
    const updated = await supabaseAdmin
      .from("buddy_payout_accounts")
      .update({
        status,
        secure_provider_reference:
          action === "verify" ? secureReference : action === "reopen" ? null : existing.data.secure_provider_reference,
        verified_at: action === "verify" ? new Date().toISOString() : action === "reopen" ? null : existing.data.verified_at,
        verified_by_admin_user_id: action === "verify" ? admin.userId : action === "reopen" ? null : existing.data.verified_by_admin_user_id,
        reviewer_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select("*")
      .single();
    if (updated.error || !updated.data) throw updated.error || new Error("更新收款帳戶失敗。");

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: `admin_buddy_payout_account_${action}`,
      targetType: "buddy_payout_account",
      targetId: accountId,
      metadata: {
        before_status: existing.data.status,
        after_status: status,
        provider_user_id: existing.data.provider_user_id,
        secure_reference_present: Boolean(secureReference),
      },
    });

    return NextResponse.json({
      payout_account: {
        ...updated.data,
        secure_provider_reference: updated.data.secure_provider_reference ? "[stored externally]" : null,
      },
      build_tag: P3_BUILD_TAGS.payout,
    });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
