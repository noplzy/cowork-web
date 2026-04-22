"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  fetchAccountStatus,
  type AccountStatusResp,
  clearAccountStatusCache,
} from "@/lib/accountStatusClient";
import { ACTIVE_BILLING_PLAN, FUTURE_BILLING_PLANS } from "@/lib/billingPlans";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

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
        body: JSON.stringify({ planCode: ACTIVE_BILLING_PLAN.code }),
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

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Pricing</span>
          <p className="cc-eyebrow">先開始，再決定要不要升級。</p>
          <h1 className="cc-h1" style={{ maxWidth: "8ch" }}>
            先用免費方案，覺得適合再升級。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "38ch" }}>
            免費方案適合先熟悉節奏。VIP 適合已經會固定進房、希望不受每月額度限制的人。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">Free：每月 4 場</span>
            <span className="cc-pill-success">VIP：{ACTIVE_BILLING_PLAN.priceLabel}</span>
            <span className="cc-pill-soft">一次性付款</span>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">你的目前狀態</p>
              <h2 className="cc-h2">先知道自己現在在哪個方案。</h2>
            </div>
            {loadingStatus ? (
              <div className="cc-note">正在讀取方案狀態…</div>
            ) : status ? (
              <div className="cc-note cc-stack-sm">
                <div>
                  目前方案：<strong>{status.is_vip ? "VIP" : "FREE"}</strong>
                </div>
                <div>
                  本月剩餘：
                  <strong>{status.is_vip ? "不限" : `${status.credits_remaining ?? "?"} / ${status.free_monthly_allowance}`}</strong>
                </div>
                {status.vip_until ? <div>VIP 到期：{new Date(status.vip_until).toLocaleString()}</div> : null}
              </div>
            ) : (
              <div className="cc-note">登入後可直接看到你的目前方案與剩餘額度。</div>
            )}
            <div className="cc-action-row">
              <Link href="/contact" className="cc-btn">
                客服
              </Link>
              <Link href="/refund-policy" className="cc-btn">
                退款政策
              </Link>
            </div>
          </div>
        </aside>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-grid-2">
        <article
          className="cc-card cc-stack-md"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.34), var(--cc-scene-focus))" }}
        >
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">Free</p>
              <h2 className="cc-h2">先感受整體節奏</h2>
            </div>
            <span className="cc-pill-warning">NT$0</span>
          </div>
          <ul className="cc-bullets">
            <li>每月 4 場 Rooms</li>
            <li>可查看公開頁與基本帳號功能</li>
            <li>適合先判斷這個平台是不是你的節奏</li>
          </ul>
          <div className="cc-action-row">
            <Link href={email ? "/rooms" : "/auth/signup"} className="cc-btn">
              {email ? "前往同行空間" : "建立免費帳號"}
            </Link>
          </div>
        </article>

        <article
          className="cc-card cc-stack-md"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.34), var(--cc-scene-life))" }}
        >
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">VIP</p>
              <h2 className="cc-h2">固定使用時，再升級就好</h2>
            </div>
            <span className="cc-pill-success">{ACTIVE_BILLING_PLAN.priceLabel}</span>
          </div>
          <ul className="cc-bullets">
            <li>Rooms 不受每月免費額度限制</li>
            <li>付款成功後開通 30 天</li>
            <li>目前不自動續扣</li>
            <li>客服與退款走公開規則</li>
          </ul>
          <div className="cc-caption">付款後會依實際結果開通權益，相關規則可在公開頁查詢。</div>
          <div className="cc-action-row">
            {isVip ? (
              <Link href="/account" className="cc-btn-primary">
                查看 VIP 權益
              </Link>
            ) : (
              <button className="cc-btn-primary" type="button" disabled={buying} onClick={handleBuyVip}>
                {buying ? "正在前往付款…" : "使用信用卡升級 VIP"}
              </button>
            )}
          </div>
        </article>
      </section>

      <section className="cc-section">
        <article className="cc-card cc-stack-md">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">商業登記資訊</p>
              <h2 className="cc-h2">付款與客服資訊</h2>
            </div>
            <span className="cc-pill-soft">一次性付款 / 不自動續扣</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>商業名稱：{BUSINESS_PROFILE.legalBusinessName}</div>
            <div>統一編號：{BUSINESS_PROFILE.unifiedBusinessNo}</div>
            <div>{BUSINESS_PROFILE.publicAddressNote}</div>
            <div>客服 Email：{BUSINESS_PROFILE.supportEmail}</div>
            <div>客服電話：{BUSINESS_PROFILE.supportPhone}</div>
          </div>
        </article>
      </section>

      <section className="cc-section">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">接下來可能會有</p>
            <h2 className="cc-h2">以下方案尚未開放。</h2>
          </div>
          <div className="cc-grid-2">
            {FUTURE_BILLING_PLANS.map((plan) => (
              <article key={plan.code} className="cc-card cc-card-soft cc-stack-sm">
                <div className="cc-card-row">
                  <div>
                    <p className="cc-card-kicker">Coming Soon</p>
                    <h3 className="cc-h3">{plan.title}</h3>
                  </div>
                  <span className="cc-pill-soft">{plan.priceLabel}</span>
                </div>
                <div className="cc-muted" style={{ lineHeight: 1.75 }}>
                  {plan.description}
                </div>
                <button className="cc-btn" type="button" disabled>
                  {plan.disabledReason || "尚未開放"}
                </button>
              </article>
            ))}
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
