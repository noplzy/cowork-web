import { NextResponse } from "next/server";
import { buildDefaultInvoicePreference, normalizeInvoicePreference } from "@/lib/invoicePreferences";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

const BUILD_TAG = "account-invoice-preference-v120-2026-06-27";

type Body = {
  invoicePreference?: unknown;
  preference?: unknown;
};

async function readSavedPreference(userId: string) {
  const result = await supabaseAdmin
    .from("user_invoice_preferences")
    .select("preference,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ?? null;
}

export async function GET(req: Request) {
  try {
    const { userId, email } = await getAuthUserFromRequest(req);
    const saved = await readSavedPreference(userId);
    const preference = saved?.preference
      ? normalizeInvoicePreference(saved.preference, email)
      : buildDefaultInvoicePreference(email);

    return NextResponse.json({
      ok: true,
      preference,
      source: saved?.preference ? "saved" : "default_account_email",
      updated_at: saved?.updated_at ?? null,
      build_tag: BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "請先登入後再讀取發票設定。", build_tag: BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error?.message || "讀取發票設定失敗。", build_tag: BUILD_TAG }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId, email } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const preference = normalizeInvoicePreference(body.invoicePreference ?? body.preference, email);

    const saved = await supabaseAdmin
      .from("user_invoice_preferences")
      .upsert(
        {
          user_id: userId,
          preference,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("preference,updated_at")
      .single();

    if (saved.error || !saved.data) throw saved.error || new Error("invoice_preference_save_failed");

    return NextResponse.json({
      ok: true,
      preference: normalizeInvoicePreference(saved.data.preference, email),
      updated_at: saved.data.updated_at,
      build_tag: BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "請先登入後再儲存發票設定。", build_tag: BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error?.message || "儲存發票設定失敗。", build_tag: BUILD_TAG }, { status: 400 });
  }
}
