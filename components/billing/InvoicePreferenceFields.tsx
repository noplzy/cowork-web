"use client";

import type { InvoiceCarrierKind, InvoiceKind, InvoicePreference } from "@/lib/invoicePreferences";

export type InvoiceFormState = {
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

export const emptyInvoiceFormState: InvoiceFormState = {
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

export function defaultInvoiceFormState(email = ""): InvoiceFormState {
  return { ...emptyInvoiceFormState, buyerEmail: email };
}

export function invoicePreferenceToFormState(preference: Partial<InvoicePreference> | null | undefined, fallbackEmail = ""): InvoiceFormState {
  return {
    kind: preference?.kind || "personal",
    buyerEmail: preference?.buyerEmail || fallbackEmail || "",
    buyerName: preference?.buyerName || "",
    buyerPhone: preference?.buyerPhone || "",
    businessIdentifier: preference?.businessIdentifier || "",
    businessName: preference?.businessName || "",
    carrierKind: preference?.kind === "donation" ? "none" : preference?.carrierKind || "ecpay",
    carrierNumber: preference?.carrierNumber || "",
    loveCode: preference?.loveCode || "",
  };
}

export function buildInvoicePreferenceFromForm(state: InvoiceFormState, fallbackEmail = "", source = "checkout_confirmation_v120"): InvoicePreference {
  return {
    kind: state.kind,
    buyerEmail: state.buyerEmail || fallbackEmail,
    buyerName: state.buyerName || undefined,
    buyerPhone: state.buyerPhone || undefined,
    businessIdentifier: state.kind === "business" ? state.businessIdentifier : undefined,
    businessName: state.kind === "business" ? state.businessName : undefined,
    carrierKind: state.kind === "donation" ? "none" : state.carrierKind,
    carrierNumber: state.kind !== "donation" && ["mobile_barcode", "citizen_certificate"].includes(state.carrierKind) ? state.carrierNumber : undefined,
    loveCode: state.kind === "donation" ? state.loveCode : undefined,
    source,
  };
}

export function describeInvoicePreference(preference: Partial<InvoicePreference> | null | undefined) {
  if (!preference) return "尚未設定，付款時會使用帳號 Email 開立個人電子發票。";
  if (preference.kind === "business") return `公司發票｜${preference.businessIdentifier || "未填統編"}｜${preference.businessName || "未填抬頭"}`;
  if (preference.kind === "donation") return `捐贈發票｜愛心碼 ${preference.loveCode || "未填"}`;
  if (preference.carrierKind === "mobile_barcode") return `個人電子發票｜手機條碼 ${preference.carrierNumber || "未填"}`;
  if (preference.carrierKind === "citizen_certificate") return `個人電子發票｜自然人憑證 ${preference.carrierNumber || "未填"}`;
  if (preference.carrierKind === "none") return "個人電子發票｜不使用載具，只寄送 Email 通知";
  return "個人電子發票｜綠界電子發票載具 / Email 通知";
}

function carrierHelp(state: InvoiceFormState) {
  if (state.kind === "donation") return "捐贈發票不需載具；請確認愛心碼正確，送出後會作為本次訂單的發票快照。";
  if (state.carrierKind === "mobile_barcode") return "手機條碼格式為 / 開頭共 8 碼，例如 /ABC1234。此欄位會帶入綠界 CarrierType=3。";
  if (state.carrierKind === "citizen_certificate") return "自然人憑證為 2 碼大寫英文字母加 14 碼數字。此欄位會帶入綠界 CarrierType=2。";
  if (state.carrierKind === "none") return state.kind === "business" ? "公司發票若不使用載具，依綠界規則會以需列印發票處理。" : "未填手機條碼時，發票不會自動歸戶到你的手機條碼。";
  return "使用綠界電子發票載具與 Email 通知；不會自動歸戶到你的手機條碼。";
}

export function InvoicePreferenceFields({
  state,
  onChange,
  compact = false,
}: {
  state: InvoiceFormState;
  onChange: (next: InvoiceFormState) => void;
  compact?: boolean;
}) {
  function update<K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) {
    onChange({ ...state, [key]: value });
  }

  return (
    <div className={compact ? "invoice-pref-grid invoice-pref-grid-compact" : "invoice-pref-grid"}>
      <label>
        <span>發票類型</span>
        <select value={state.kind} onChange={(event) => update("kind", event.target.value as InvoiceKind)}>
          <option value="personal">個人電子發票</option>
          <option value="business">公司 / 統編發票</option>
          <option value="donation">捐贈發票</option>
        </select>
      </label>

      <label>
        <span>通知 Email</span>
        <input value={state.buyerEmail} onChange={(event) => update("buyerEmail", event.target.value)} placeholder="預設使用帳號 Email" inputMode="email" />
      </label>

      {state.kind !== "donation" ? (
        <label>
          <span>載具</span>
          <select value={state.carrierKind} onChange={(event) => update("carrierKind", event.target.value as InvoiceCarrierKind)}>
            <option value="ecpay">綠界電子發票載具 / Email 通知</option>
            <option value="mobile_barcode">手機條碼載具</option>
            <option value="citizen_certificate">自然人憑證載具</option>
            <option value="none">不使用載具</option>
          </select>
        </label>
      ) : null}

      {state.kind === "business" ? (
        <>
          <label>
            <span>統一編號</span>
            <input value={state.businessIdentifier} onChange={(event) => update("businessIdentifier", event.target.value)} placeholder="8 碼統編" inputMode="numeric" />
          </label>
          <label>
            <span>公司抬頭</span>
            <input value={state.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="公司名稱" />
          </label>
        </>
      ) : null}

      {state.kind !== "donation" && ["mobile_barcode", "citizen_certificate"].includes(state.carrierKind) ? (
        <label>
          <span>載具號碼</span>
          <input
            value={state.carrierNumber}
            onChange={(event) => update("carrierNumber", event.target.value.toUpperCase())}
            placeholder={state.carrierKind === "mobile_barcode" ? "/ABC1234" : "AB12345678901234"}
          />
        </label>
      ) : null}

      {state.kind === "donation" ? (
        <label>
          <span>愛心碼</span>
          <input value={state.loveCode} onChange={(event) => update("loveCode", event.target.value)} placeholder="3 到 7 碼數字" inputMode="numeric" />
        </label>
      ) : null}

      <small>{carrierHelp(state)}</small>

      <style jsx>{`
        .invoice-pref-grid {
          display: grid;
          gap: 12px;
          text-align: left;
        }
        .invoice-pref-grid-compact {
          gap: 9px;
        }
        label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          color: rgba(25, 32, 34, 0.72);
        }
        input,
        select {
          width: 100%;
          border: 1px solid rgba(20, 40, 46, 0.18);
          border-radius: 12px;
          padding: 10px 11px;
          background: rgba(255, 255, 255, 0.86);
          color: #172126;
        }
        small {
          color: rgba(25, 32, 34, 0.6);
          line-height: 1.65;
        }
      `}</style>
    </div>
  );
}
