"use client";
import { useMemo, useState } from "react";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import type { InvoiceCarrierKind, InvoiceKind, InvoicePreference } from "@/lib/invoicePreferences";

type CheckoutPayload = { action: string; method: string; fields: Record<string, string>; error?: string };

type InvoiceFormState = {
  kind: InvoiceKind;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  businessIdentifier: string;
  businessName: string;
  carrierKind: InvoiceCarrierKind;
  carrierNumber: string;
  loveCode: string;
};

const defaultInvoiceState: InvoiceFormState = {
  kind: "personal",
  buyerEmail: "",
  buyerName: "",
  buyerPhone: "",
  businessIdentifier: "",
  businessName: "",
  carrierKind: "ecpay",
  carrierNumber: "",
  loveCode: "",
};

function buildInvoicePreference(state: InvoiceFormState, fallbackEmail: string): InvoicePreference {
  return {
    kind: state.kind,
    buyerEmail: state.buyerEmail || fallbackEmail,
    buyerName: state.buyerName || undefined,
    buyerPhone: state.buyerPhone || undefined,
    businessIdentifier: state.kind === "business" ? state.businessIdentifier : undefined,
    businessName: state.kind === "business" ? state.businessName : undefined,
    carrierKind: state.kind === "donation" ? "none" : state.carrierKind,
    carrierNumber: ["mobile_barcode", "citizen_certificate"].includes(state.carrierKind) ? state.carrierNumber : undefined,
    loveCode: state.kind === "donation" ? state.loveCode : undefined,
    source: "pricing_checkout_form_v119",
  };
}

export function PricingCheckoutButton({ planCode, disabled, disabledReason, children }: { planCode: string; disabled?: boolean; disabledReason?: string; children: React.ReactNode }) {
  const [status, setStatus] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceFormState>(defaultInvoiceState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const carrierHelp = useMemo(() => {
    if (invoice.kind === "donation") return "捐贈發票不需載具，請填愛心碼。";
    if (invoice.carrierKind === "mobile_barcode") return "手機條碼格式為 / 開頭共 8 碼，例如 /ABC1234。";
    if (invoice.carrierKind === "citizen_certificate") return "自然人憑證為 2 碼大寫英文字母加 14 碼數字。";
    if (invoice.carrierKind === "none") return invoice.kind === "business" ? "公司發票若不使用載具，綠界規則會以需列印發票處理。" : "未填手機條碼時，發票不會自動歸戶到你的手機條碼。";
    return "使用綠界電子發票載具與 Email 通知，不會自動歸戶到你的手機條碼。";
  }, [invoice.kind, invoice.carrierKind]);

  function update<K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) {
    setInvoice((current) => ({ ...current, [key]: value }));
  }

  async function startCheckout() {
    if (disabled) {
      setStatus(disabledReason || "這個方案尚未開放付款。");
      return;
    }

    if (!showInvoiceForm) {
      setShowInvoiceForm(true);
      setStatus("請先確認發票資料，再前往綠界付款。");
      return;
    }

    setIsSubmitting(true);
    setStatus("正在檢查發票資料與準備付款流程…");
    try {
      const session = await getClientSessionSnapshot();
      if (!session?.accessToken) {
        window.location.href = `/auth/login?next=${encodeURIComponent("/pricing")}`;
        return;
      }

      const invoicePreference = buildInvoicePreference(invoice, session.email || "");
      const validation = await fetch("/api/invoices/validate-preference", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ invoicePreference }),
      });
      const validationPayload = (await validation.json().catch(() => ({}))) as { ok?: boolean; error?: string; warning?: string };
      if (!validation.ok || validationPayload.ok === false) throw new Error(validationPayload.error || "發票資料格式不正確。");
      if (validationPayload.warning) setStatus(validationPayload.warning);

      const response = await fetch("/api/payments/ecpay/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, invoicePreference }),
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
      {showInvoiceForm ? (
        <div className="pricing-v119-invoice-box" aria-label="發票資料設定">
          <b>發票資料</b>
          <label>
            <span>發票類型</span>
            <select value={invoice.kind} onChange={(event) => update("kind", event.target.value as InvoiceKind)}>
              <option value="personal">個人電子發票</option>
              <option value="business">公司 / 統編發票</option>
              <option value="donation">捐贈發票</option>
            </select>
          </label>
          <label>
            <span>通知 Email</span>
            <input value={invoice.buyerEmail} onChange={(event) => update("buyerEmail", event.target.value)} placeholder="預設使用帳號 Email" inputMode="email" />
          </label>
          {invoice.kind !== "donation" ? (
            <label>
              <span>載具</span>
              <select value={invoice.carrierKind} onChange={(event) => update("carrierKind", event.target.value as InvoiceCarrierKind)}>
                <option value="ecpay">綠界電子發票載具 / Email 通知</option>
                <option value="mobile_barcode">手機條碼載具</option>
                <option value="citizen_certificate">自然人憑證載具</option>
                <option value="none">不使用載具</option>
              </select>
            </label>
          ) : null}
          {invoice.kind === "business" ? (
            <>
              <label>
                <span>統一編號</span>
                <input value={invoice.businessIdentifier} onChange={(event) => update("businessIdentifier", event.target.value)} placeholder="8 碼統編" inputMode="numeric" />
              </label>
              <label>
                <span>公司抬頭</span>
                <input value={invoice.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="公司名稱" />
              </label>
            </>
          ) : null}
          {invoice.kind !== "donation" && ["mobile_barcode", "citizen_certificate"].includes(invoice.carrierKind) ? (
            <label>
              <span>載具號碼</span>
              <input value={invoice.carrierNumber} onChange={(event) => update("carrierNumber", event.target.value.toUpperCase())} placeholder={invoice.carrierKind === "mobile_barcode" ? "/ABC1234" : "AB12345678901234"} />
            </label>
          ) : null}
          {invoice.kind === "donation" ? (
            <label>
              <span>愛心碼</span>
              <input value={invoice.loveCode} onChange={(event) => update("loveCode", event.target.value)} placeholder="3 到 7 碼數字" inputMode="numeric" />
            </label>
          ) : null}
          <small>{carrierHelp}</small>
        </div>
      ) : null}
      <button type="button" className="pricing-v16-cta" onClick={startCheckout} aria-disabled={disabled || isSubmitting ? "true" : "false"} disabled={isSubmitting}>
        {showInvoiceForm ? "確認發票資料並付款" : children}
      </button>
      {showInvoiceForm ? <button type="button" className="pricing-v119-secondary" onClick={() => setShowInvoiceForm(false)}>返回方案</button> : null}
      {status ? <p className="pricing-v107-action-note">{status}</p> : null}
      <style jsx>{`
        .pricing-v119-invoice-box {
          display: grid;
          gap: 10px;
          margin: 0 0 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(30, 48, 54, 0.1);
          text-align: left;
        }
        .pricing-v119-invoice-box b { font-size: 15px; letter-spacing: 0.08em; }
        .pricing-v119-invoice-box label { display: grid; gap: 5px; font-size: 12px; color: rgba(25, 32, 34, 0.72); }
        .pricing-v119-invoice-box input,
        .pricing-v119-invoice-box select {
          width: 100%;
          border: 1px solid rgba(20, 40, 46, 0.18);
          border-radius: 12px;
          padding: 10px 11px;
          background: rgba(255, 255, 255, 0.78);
          color: #172126;
        }
        .pricing-v119-invoice-box small { color: rgba(25, 32, 34, 0.58); line-height: 1.6; }
        .pricing-v119-secondary {
          margin-top: 10px;
          border: 0;
          background: transparent;
          color: rgba(20, 38, 42, 0.72);
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
