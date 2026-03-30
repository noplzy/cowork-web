"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";

type OrderStatusResp = {
  merchantTradeNo: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired";
  planCode: string;
  amount: number;
  paidAt: string | null;
  createdAt: string;
  providerTradeNo: string | null;
  lastError: string | null;
  entitlement: {
    plan: string;
    vip_until: string | null;
    is_vip: boolean;
  };
};

function CheckoutResultFallback() {
  return (
    <main className="cc-container">
      <TopNav />
      <section className="cc-section">
        <div className="cc-card cc-stack-md">
          <p className="cc-card-kicker">Payment</p>
          <h1 className="cc-h2">正在準備付款結果頁…</h1>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function CheckoutResultContent() {
  const searchParams = useSearchParams();
  const merchantTradeNo = useMemo(
    () => String(searchParams.get("merchantTradeNo") || "").trim(),
    [searchParams],
  );

  const [status, setStatus] = useState<OrderStatusResp | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const pollCountRef = useRef(0);

  async function fetchOrderStatus(forceSession = false) {
    if (!merchantTradeNo) {
      setMsg("缺少訂單編號，暫時無法確認付款結果。");
      setLoading(false);
      return;
    }

    const session = await getClientSessionSnapshot({ force: forceSession });
    if (!session?.accessToken) {
      setMsg("請先登入，再查看付款結果。");
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/payments/ecpay/order-status?merchantTradeNo=${encodeURIComponent(merchantTradeNo)}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    const json = (await response.json().catch(() => null)) as OrderStatusResp | { error?: string } | null;
    if (!response.ok) {
      setMsg((json as { error?: string } | null)?.error || "目前無法確認付款結果。");
      setLoading(false);
      return;
    }

    const next = json as OrderStatusResp;
    setStatus(next);
    setLoading(false);

    if (next.status === "paid") {
      clearAccountStatusCache();
      setMsg("");
      return;
    }

    if (next.status === "failed") {
      setMsg(next.lastError || "付款沒有成功，請重新嘗試。");
      return;
    }

    if (next.status === "pending") {
      setMsg("付款結果仍在確認中，系統會自動再查幾次。");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchOrderStatus();

    const interval = window.setInterval(async () => {
      if (cancelled) return;
      if (pollCountRef.current >= 10) {
        window.clearInterval(interval);
        return;
      }
      pollCountRef.current += 1;
      await fetchOrderStatus();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [merchantTradeNo]);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Payment Result</span>
          <p className="cc-eyebrow">綠界付款完成後，系統會先走後端驗證與權益入帳，再更新這裡。</p>
          <h1 className="cc-h2">VIP 付款結果</h1>

          {merchantTradeNo ? (
            <div className="cc-note">
              訂單編號：<strong>{merchantTradeNo}</strong>
            </div>
          ) : null}

          {loading ? <div className="cc-note">正在確認你的付款狀態…</div> : null}

          {!loading && status?.status === "paid" ? (
            <div className="cc-note cc-stack-sm">
              <div><strong>付款成功。</strong></div>
              <div>VIP 權益已入帳，可以直接前往帳號頁或同行空間確認。</div>
              {status.paidAt ? <div>付款時間：{new Date(status.paidAt).toLocaleString()}</div> : null}
            </div>
          ) : null}

          {!loading && status?.status === "pending" ? (
            <div className="cc-alert cc-alert-warn">
              付款結果還在確認中。這不一定代表失敗，通常是銀行授權或綠界通知尚未完全完成。
            </div>
          ) : null}

          {!loading && status?.status === "failed" ? (
            <div className="cc-alert cc-alert-error">
              付款未成功。{status.lastError ? `系統紀錄：${status.lastError}` : "你可以重新回到方案頁再試一次。"}
            </div>
          ) : null}

          {msg ? <div className="cc-note">{msg}</div> : null}

          <div className="cc-action-row">
            <Link href="/account" className="cc-btn-primary">查看帳號 / 權益</Link>
            <Link href="/rooms" className="cc-btn">前往同行空間</Link>
            <Link href="/pricing" className="cc-btn">回方案頁</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">這一頁在做什麼</p>
          <h2 className="cc-h2">它不是單純顯示成功畫面。</h2>
          <ul className="cc-bullets">
            <li>先接收綠界通知。</li>
            <li>再用後端查單驗證付款結果。</li>
            <li>確認無誤後，才真的把 VIP 權益入帳。</li>
            <li>若銀行授權較慢，這頁會暫時顯示「確認中」。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<CheckoutResultFallback />}>
      <CheckoutResultContent />
    </Suspense>
  );
}
