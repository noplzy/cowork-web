"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { fetchAccountStatus, type AccountStatusResp, clearAccountStatusCache } from "@/lib/accountStatusClient";

type CheckoutResp = {
  action: string;
  method: "POST";
  merchantTradeNo: string;
  fields: Record<string, string>;
};

function submitToEcpay(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export default function PricingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [email, setEmail] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingStatus(true);
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;

      setEmail(session?.email ?? "");

      if (session?.accessToken) {
        try {
          const nextStatus = await fetchAccountStatus(session.accessToken, { force: true });
          if (!cancelled) setStatus(nextStatus);
        } catch (error: any) {
          if (!cancelled) setMsg(error?.message || "目前無法讀取方案資訊。");
        }
      }

      if (!cancelled) setLoadingStatus(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBuyVip() {
    setBuying(true);
    setMsg("");

    try {
      const session = await getClientSessionSnapshot({ force: true });
      if (!session?.accessToken) {
        router.push("/auth/login?next=/pricing");
        return;
      }

      clearAccountStatusCache();

      const response = await fetch("/api/payments/ecpay/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ planCode: "vip_month" }),
      });

      const json = (await response.json().catch(() => null)) as CheckoutResp | { error?: string } | null;
      if (!response.ok) {
        throw new Error((json as { error?: string } | null)?.error || "目前無法建立付款流程。");
      }

      const checkout = json as CheckoutResp;
      submitToEcpay(checkout.action, checkout.fields);
    } catch (error: any) {
      setMsg(error?.message || "建立付款流程時發生未預期錯誤。");
    } finally {
      setBuying(false);
    }
  }

  const isVip = Boolean(status?.is_vip);

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Pricing</span>
          <p className="cc-eyebrow">先看規則，再決定要不要升級。</p>
          <h1 className="cc-h2">方案與價格</h1>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-success">VIP 月費 NT$199</span>
            <span className="cc-pill-soft">先做一次性信用卡付款</span>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            這一版先用綠界全方位金流（導轉式）做一次性 VIP 購買閉環。
            先把付款成功、權益入帳、帳號顯示這三件事做穩，再談自動續扣與綁卡。
          </p>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">使用前先知道</p>
          <ul className="cc-bullets">
            <li>25 分鐘房消耗 1 場。</li>
            <li>50 分鐘房消耗 2 場。</li>
            <li>VIP 可無限續場。</li>
            <li>付款成功後，系統會先做後端驗證，再把 VIP 權益入帳。</li>
          </ul>
        </article>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          {msg}
        </div>
      ) : null}

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">Free</p>
              <h2 className="cc-h2">免費方案</h2>
            </div>
            <span className="cc-pill-warning">NT$0</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>每月 4 場</div>
            <div>可查看公開頁與基本帳號功能</div>
            <div>適合先測試整體節奏</div>
          </div>
          <div className="cc-action-row">
            <Link href={email ? "/rooms" : "/auth/signup"} className="cc-btn">
              {email ? "前往同行空間" : "建立免費帳號"}
            </Link>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">VIP</p>
              <h2 className="cc-h2">VIP 月方案</h2>
            </div>
            <span className="cc-pill-success">NT$199 / 30 天</span>
          </div>

          <div className="cc-note cc-stack-sm">
            <div>可無限續場</div>
            <div>付款成功後，權益應立即生效</div>
            <div>目前先做一次性信用卡付款，不做自動續扣</div>
          </div>

          {loadingStatus ? (
            <div className="cc-note">正在讀取你的目前方案狀態…</div>
          ) : status ? (
            <div className="cc-note">
              目前方案：<strong>{status.is_vip ? "VIP" : "FREE"}</strong>
              {status.is_vip ? "（已啟用）" : `｜本月剩餘 ${status.credits_remaining ?? "?"} / ${status.free_monthly_allowance} 場`}
            </div>
          ) : (
            <div className="cc-note">若你尚未登入，付款前會先要求登入。</div>
          )}

          <div className="cc-action-row">
            {isVip ? (
              <Link href="/account" className="cc-btn-primary">查看 VIP 權益</Link>
            ) : (
              <button
                className="cc-btn-primary"
                type="button"
                disabled={buying}
                onClick={handleBuyVip}
              >
                {buying ? "正在前往付款…" : "使用信用卡升級 VIP"}
              </button>
            )}
            <Link href="/refund-policy" className="cc-btn">退款政策</Link>
            <Link href="/service-delivery" className="cc-btn">服務交付</Link>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
