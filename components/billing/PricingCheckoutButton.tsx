"use client";

import { useState } from "react";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import type { InvoicePreference } from "@/lib/invoicePreferences";
import {
  buildInvoicePreferenceFromForm,
  defaultInvoiceFormState,
  describeInvoicePreference,
  InvoicePreferenceFields,
  invoicePreferenceToFormState,
  type InvoiceFormState,
} from "@/components/billing/InvoicePreferenceFields";

type CheckoutPayload = { action: string; method: string; fields: Record<string, string>; error?: string };
type InvoicePreferencePayload = { ok?: boolean; preference?: InvoicePreference; error?: string; warning?: string; warnings?: string[] };

type SessionSnapshot = {
  accessToken: string;
  email: string;
};

export function PricingCheckoutButton({
  planCode,
  disabled,
  disabledReason,
  children,
}: {
  planCode: string;
  disabled?: boolean;
  disabledReason?: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceFormState>(defaultInvoiceFormState());
  const [invoiceSource, setInvoiceSource] = useState<"saved" | "default_account_email" | "manual">("default_account_email");
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requireSession() {
    const snapshot = await getClientSessionSnapshot({ force: true });
    if (!snapshot?.accessToken) {
      window.location.href = `/auth/login?next=${encodeURIComponent("/pricing")}`;
      return null;
    }
    return { accessToken: snapshot.accessToken, email: snapshot.email || "" };
  }

  async function loadSavedInvoicePreference(activeSession: SessionSnapshot) {
    const response = await fetch("/api/account/invoice-preference", {
      method: "GET",
      headers: { Authorization: `Bearer ${activeSession.accessToken}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as InvoicePreferencePayload & { source?: "saved" | "default_account_email" };
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "讀取預設發票資料失敗。");
    setInvoice(invoicePreferenceToFormState(payload.preference, activeSession.email));
    setInvoiceSource(payload.source || "default_account_email");
  }

  async function openCheckout() {
    if (disabled) {
      setStatus(disabledReason || "這個方案尚未開放付款。");
      return;
    }

    setIsPreparing(true);
    setStatus("正在讀取你的預設發票資料…");
    try {
      const activeSession = await requireSession();
      if (!activeSession) return;
      setSession(activeSession);
      await loadSavedInvoicePreference(activeSession);
      setShowCheckout(true);
      setStatus("");
    } catch (error: any) {
      const activeSession = await requireSession();
      if (activeSession) {
        setSession(activeSession);
        setInvoice(defaultInvoiceFormState(activeSession.email));
        setInvoiceSource("default_account_email");
        setShowCheckout(true);
        setStatus(error?.message || "未讀到預設發票資料，請在本次結帳確認。");
      }
    } finally {
      setIsPreparing(false);
    }
  }

  async function validateInvoicePreference(activeSession: SessionSnapshot, invoicePreference: InvoicePreference) {
    const validation = await fetch("/api/invoices/validate-preference", {
      method: "POST",
      headers: { Authorization: `Bearer ${activeSession.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invoicePreference }),
    });
    const validationPayload = (await validation.json().catch(() => ({}))) as InvoicePreferencePayload;
    if (!validation.ok || validationPayload.ok === false) throw new Error(validationPayload.error || "發票資料格式不正確。");
    return validationPayload;
  }

  async function persistInvoicePreference(activeSession: SessionSnapshot, invoicePreference: InvoicePreference) {
    const response = await fetch("/api/account/invoice-preference", {
      method: "PUT",
      headers: { Authorization: `Bearer ${activeSession.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invoicePreference }),
    });
    const payload = (await response.json().catch(() => ({}))) as InvoicePreferencePayload;
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "儲存預設發票資料失敗。");
  }

  async function submitCheckout() {
    if (!session) return;

    setIsSubmitting(true);
    setStatus("正在檢查發票資料並準備前往綠界付款…");
    try {
      const invoicePreference = buildInvoicePreferenceFromForm(invoice, session.email, saveAsDefault ? "checkout_confirmation_saved_v120" : "checkout_confirmation_one_time_v120");
      const validationPayload = await validateInvoicePreference(session, invoicePreference);
      const normalizedPreference = validationPayload.preference || invoicePreference;

      if (saveAsDefault) await persistInvoicePreference(session, normalizedPreference);

      const response = await fetch("/api/payments/ecpay/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, invoicePreference: normalizedPreference }),
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutPayload;
      if (!response.ok || !payload.action || !payload.fields) throw new Error(payload.error || "建立付款流程失敗。");

      const form = document.createElement("form");
      form.method = payload.method || "POST";
      form.action = payload.action;
      form.style.display = "none";
      Object.entries(payload.fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      setStatus(error?.message || "付款流程發生錯誤。");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pricing-v16-action-wrap">
      <button type="button" className="pricing-v16-cta" onClick={openCheckout} aria-disabled={disabled || isPreparing ? "true" : "false"} disabled={isPreparing}>
        {isPreparing ? "準備中…" : children}
      </button>
      {status && !showCheckout ? <p className="pricing-v107-action-note">{status}</p> : null}

      {showCheckout ? (
        <div className="pricing-v120-modal" role="dialog" aria-modal="true" aria-label="結帳確認">
          <div className="pricing-v120-modal-backdrop" onClick={() => (isSubmitting ? null : setShowCheckout(false))} />
          <div className="pricing-v120-modal-card">
            <div className="pricing-v120-modal-head">
              <div>
                <span className="i20-kicker">Checkout</span>
                <h3>結帳前確認發票資料</h3>
                <p>方案頁只負責選擇方案；發票資料在結帳確認與帳務中心管理，付款後會固定成該筆訂單的發票快照。</p>
              </div>
              <button type="button" onClick={() => setShowCheckout(false)} disabled={isSubmitting} aria-label="關閉結帳確認">×</button>
            </div>

            <div className="pricing-v120-current-pref">
              <b>{invoiceSource === "saved" ? "已帶入帳務中心預設" : "尚未儲存預設，先使用帳號 Email"}</b>
              <span>{describeInvoicePreference(buildInvoicePreferenceFromForm(invoice, session?.email || "", "checkout_preview_v120"))}</span>
            </div>

            <InvoicePreferenceFields state={invoice} onChange={setInvoice} />

            <label className="pricing-v120-save-default">
              <input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />
              <span>儲存為下次預設發票資料</span>
            </label>

            <div className="pricing-v120-modal-actions">
              <button type="button" className="pricing-v120-secondary" onClick={() => setShowCheckout(false)} disabled={isSubmitting}>返回方案</button>
              <button type="button" className="pricing-v16-cta" onClick={submitCheckout} disabled={isSubmitting}>{isSubmitting ? "前往付款中…" : "確認並前往綠界付款"}</button>
            </div>
            {status ? <p className="pricing-v107-action-note">{status}</p> : null}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .pricing-v120-modal {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: grid;
          place-items: center;
          padding: 22px;
        }
        .pricing-v120-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(4, 18, 24, 0.62);
          backdrop-filter: blur(10px);
        }
        .pricing-v120-modal-card {
          position: relative;
          width: min(680px, 100%);
          max-height: min(86vh, 860px);
          overflow: auto;
          border-radius: 28px;
          padding: 24px;
          background: #f6efe4;
          color: #172126;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.34);
          text-align: left;
        }
        .pricing-v120-modal-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 16px;
        }
        .pricing-v120-modal-head h3 {
          margin: 6px 0 8px;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 24px;
          font-weight: 500;
        }
        .pricing-v120-modal-head p {
          margin: 0;
          color: rgba(23, 33, 38, 0.68);
          line-height: 1.7;
        }
        .pricing-v120-modal-head > button {
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: rgba(20, 38, 42, 0.08);
          color: #172126;
          font-size: 24px;
          cursor: pointer;
        }
        .pricing-v120-current-pref {
          display: grid;
          gap: 6px;
          margin-bottom: 16px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.48);
          border: 1px solid rgba(30, 48, 54, 0.1);
        }
        .pricing-v120-current-pref span {
          color: rgba(23, 33, 38, 0.66);
          line-height: 1.65;
        }
        .pricing-v120-save-default {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 14px;
          color: rgba(23, 33, 38, 0.72);
          font-size: 13px;
        }
        .pricing-v120-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 18px;
        }
        .pricing-v120-secondary {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: rgba(20, 38, 42, 0.08);
          color: rgba(20, 38, 42, 0.78);
          cursor: pointer;
        }
        @media (max-width: 720px) {
          .pricing-v120-modal-card { padding: 18px; }
          .pricing-v120-modal-actions { display: grid; }
        }
      `}</style>
    </div>
  );
}
