"use client";

import { useState } from "react";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

export function BuddyPaymentButton({
  bookingId,
  disabled,
}: {
  bookingId: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    setMessage("正在建立綠界付款頁…");
    try {
      const session = await getClientSessionSnapshot({ force: true });
      if (!session?.accessToken) {
        window.location.href = `/auth/login?next=${encodeURIComponent("/account/buddies/bookings")}`;
        return;
      }
      const response = await fetch("/api/payments/ecpay/buddies/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.action || !payload.fields) {
        throw new Error(payload.error || "建立 Buddies 付款失敗。");
      }
      const form = document.createElement("form");
      form.method = payload.method || "POST";
      form.action = payload.action;
      form.style.display = "none";
      Object.entries(payload.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "付款流程發生錯誤。");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button type="button" onClick={() => void pay()} disabled={disabled || busy}>
        {busy ? "準備付款中…" : "前往付款"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
