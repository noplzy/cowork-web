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
import {
  ACTIVE_BILLING_PLAN,
  BILLING_SCOPE_DESCRIPTION,
  BILLING_SCOPE_LABEL,
  FUTURE_BILLING_PLANS,
} from "@/lib/billingPlans";

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

      const json = (await response.json().catch(() => null)) as
        | CheckoutResp
        | { error?: string }
        | null;

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
          <p className="cc-eyebrow">先把當前能穩定交付的版本做好，再談正式訂閱制。</p>
          <h1 className="cc-h2">方案與價格</h1>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-success">{ACTIVE_BILLING_PLAN.priceLabel}</span>
            <span className="cc-pill-soft">{BILLING_SCOPE_LABEL}</span>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            {BILLING_SCOPE_DESCRIPTION}
            這一版先只做「單一月方案 + 一次性付款 + 人工退款審核 + 明確公開規則」，
            先把付款成功、權益入帳、查單與客服處理這條主路線跑穩。
          </p>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">目前適用規則</p>
          <ul className="cc-bullets">
            <li>25 分鐘房消耗 1 場，50 分鐘房消耗 2 場。</li>
            <li>目前只有 VIP 月方案開放付款，付款成功後開通 30 天。</li>
            <li>目前不做自動續扣，也不用申請取消續訂。</li>
            <li>退款不是前台秒退，改走人工審核與人工處理。</li>
          </ul>
        </article>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

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
              <p className="cc-card-kicker">Pilot Billing</p>
              <h2 className="cc-h2">{ACTIVE_BILLING_PLAN.title}</h2>
            </div>
            <span className="cc-pill-success">{ACTIVE_BILLING_PLAN.priceLabel}</span>
          </div>

          <div className="cc-note cc-stack-sm">
            {ACTIVE_BILLING_PLAN.highlights.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>

          {loadingStatus ? (
            <div className="cc-note">正在讀取你的目前方案狀態…</div>
          ) : status ? (
            <div className="cc-note cc-stack-sm">
              <div>
                目前方案：<strong>{status.is_vip ? "VIP" : "FREE"}</strong>
                {status.is_vip
                  ? "（已啟用）"
                  : `｜本月剩餘 ${status.credits_remaining ?? "?"} / ${status.free_monthly_allowance} 場`}
              </div>
              <div>
                付款模式：<strong>{status.billing_mode === "one_time" ? "一次性付款" : "免費方案"}</strong>
              </div>
              {status.vip_until ? <div>VIP 到期時間：{new Date(status.vip_until).toLocaleString()}</div> : null}
            </div>
          ) : (
            <div className="cc-note">若你尚未登入，付款前會先要求登入。</div>
          )}

          <div className="cc-caption">
            這一版先不承諾每月自動扣款，也不承諾年繳。先把 30 天權益閉環跑穩，才是對你和使用者都比較負責的做法。
          </div>

          <div className="cc-action-row">
            {isVip ? (
              <Link href="/account" className="cc-btn-primary">
                查看 VIP 權益
              </Link>
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
            <Link href="/refund-policy" className="cc-btn">
              退款政策
            </Link>
            <Link href="/service-delivery" className="cc-btn">
              服務交付
            </Link>
            <Link href="/contact" className="cc-btn">
              客服 / 人工審核
            </Link>
          </div>
        </article>
      </section>

      <section className="cc-section">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">正式上線保留方案</p>
            <h2 className="cc-h2">方案先保留，但現在不亂開按鈕。</h2>
          </div>

          <div className="cc-grid-2">
            {FUTURE_BILLING_PLANS.map((plan) => (
              <article key={plan.code} className="cc-card cc-card-soft cc-stack-sm">
                <div className="cc-card-row">
                  <div>
                    <p className="cc-card-kicker">{plan.stage === "formal_launch" ? "Formal Launch" : "Future"}</p>
                    <h3 className="cc-h3">{plan.title}</h3>
                  </div>
                  <span className="cc-pill-soft">{plan.priceLabel}</span>
                </div>

                <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
                  {plan.description}
                </p>

                <ul className="cc-bullets">
                  {plan.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <button className="cc-btn" type="button" disabled>
                  {plan.disabledReason || "尚未開放"}
                </button>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">人工退款審核怎麼走</p>
          <h2 className="cc-h2">你現在需要的是可追蹤，不是假的自助退款。</h2>
          <ul className="cc-bullets">
            <li>先到客服表單提交帳號 Email、付款時間、金額與訂單編號。</li>
            <li>我們先人工查單，確認是否重複扣款、未生效或首次購買後未使用主要權益。</li>
            <li>符合條件才進入退款處理；若已明顯使用主要 VIP 權益，通常不退。</li>
          </ul>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">為什麼現在不直接賣年繳</p>
          <h2 className="cc-h2">不是不能做，是現在做了風險比收益大。</h2>
          <ul className="cc-bullets">
            <li>年繳會把客服、退款、權益中止與帳務責任一次拉長到一年。</li>
            <li>試營運階段先證明月方案閉環能穩定跑，再放大收款週期比較合理。</li>
            <li>等你拿到更完整的金流資格後，再開月訂閱與年方案，前後台才不會互相打架。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
