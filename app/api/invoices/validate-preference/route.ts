import { NextResponse } from "next/server";
import { normalizeInvoicePreference } from "@/lib/invoicePreferences";
import { checkLoveCode, checkMobileBarcode, lookupBusinessIdentifier } from "@/lib/server/ecpayOfficialClient";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";
const BUILD_TAG = "invoice-preference-validation-v119-2026-06-27";

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

export async function POST(req: Request) {
  try {
    const { email } = await getAuthUserFromRequest(req).catch(() => ({ email: "" as string }));
    const body = (await req.json().catch(() => ({}))) as { invoicePreference?: unknown };
    const preference = normalizeInvoicePreference(body.invoicePreference, email || "");

    const liveValidation = envFlag("ECPAY_INVOICE_VALIDATION_API_ENABLED");
    const strictValidation = envFlag("ECPAY_INVOICE_STRICT_VALIDATION");
    const checks: Record<string, unknown> = {};
    const warnings: string[] = [];

    if (liveValidation && preference.carrierKind === "mobile_barcode" && preference.carrierNumber) {
      try {
        const result = await checkMobileBarcode(preference.carrierNumber);
        checks.mobile_barcode = result;
        if (!result.ok) {
          const message = "手機條碼未通過綠界 / 財政部驗證，可能無法歸戶。";
          if (strictValidation) return NextResponse.json({ ok: false, error: message, checks, build_tag: BUILD_TAG }, { status: 400 });
          warnings.push(message);
        }
      } catch (error: any) {
        warnings.push(`手機條碼即時驗證暫時不可用，已改用格式驗證：${error?.message || "unknown"}`);
      }
    }

    if (liveValidation && preference.kind === "donation" && preference.loveCode) {
      try {
        const result = await checkLoveCode(preference.loveCode);
        checks.love_code = result;
        if (!result.ok) {
          const message = "愛心碼未通過綠界驗證。";
          if (strictValidation) return NextResponse.json({ ok: false, error: message, checks, build_tag: BUILD_TAG }, { status: 400 });
          warnings.push(message);
        }
      } catch (error: any) {
        warnings.push(`愛心碼即時驗證暫時不可用，已改用格式驗證：${error?.message || "unknown"}`);
      }
    }

    if (liveValidation && preference.kind === "business" && preference.businessIdentifier) {
      try {
        const result = await lookupBusinessIdentifier(preference.businessIdentifier);
        checks.business_identifier = result;
        if (result.ok && result.company_name && !preference.businessName) {
          preference.businessName = result.company_name;
        }
      } catch (error: any) {
        warnings.push(`統編即時驗證暫時不可用，已改用格式驗證：${error?.message || "unknown"}`);
      }
    }

    return NextResponse.json({ ok: true, invoicePreference: preference, checks, warning: warnings[0] || null, warnings, build_tag: BUILD_TAG });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "發票資料驗證失敗。", build_tag: BUILD_TAG }, { status: 400 });
  }
}
