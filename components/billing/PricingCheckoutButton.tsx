"use client";
import { useState } from "react";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

type CheckoutPayload = { action: string; method: string; fields: Record<string, string>; error?: string };

export function PricingCheckoutButton({ planCode, disabled, disabledReason, children }: { planCode: string; disabled?: boolean; disabledReason?: string; children: React.ReactNode }) {
  const [status, setStatus] = useState("");
  async function startCheckout() {
    if (disabled) { setStatus(disabledReason || "這個方案尚未開放付款。"); return; }
    setStatus("正在準備付款流程…");
    try {
      const session = await getClientSessionSnapshot();
      if (!session?.accessToken) { window.location.href = `/auth/login?next=${encodeURIComponent("/pricing")}`; return; }
      const response = await fetch("/api/payments/ecpay/checkout", { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ planCode }) });
      const payload = (await response.json().catch(() => ({}))) as CheckoutPayload;
      if (!response.ok || !payload.action || !payload.fields) throw new Error(payload.error || "建立付款流程失敗。");
      const form = document.createElement("form"); form.method = payload.method || "POST"; form.action = payload.action; form.style.display = "none";
      Object.entries(payload.fields).forEach(([name, value]) => { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.appendChild(input); });
      document.body.appendChild(form); form.submit();
    } catch (error: any) { setStatus(error?.message || "付款流程發生錯誤。"); }
  }
  return <div className="pricing-v16-action-wrap"><button type="button" className="pricing-v16-cta" onClick={startCheckout} aria-disabled={disabled ? "true" : "false"}>{children}</button>{status ? <p className="pricing-v107-action-note">{status}</p> : null}</div>;
}
