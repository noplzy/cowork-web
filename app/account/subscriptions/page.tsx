"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { describeInvoicePreference } from "@/components/billing/InvoicePreferenceFields";
import type { InvoicePreference } from "@/lib/invoicePreferences";
import {
  FormalOpsShell,
  accountOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  formatTwd,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";
import { PRODUCT_PLANS } from "@/lib/productCatalog";

const plannedSubscriptions = PRODUCT_PLANS.filter((plan) =>
  [
    "rooms_unlimited_299",
    "buddies_pro_399",
    "whole_site_599",
    "host_999",
  ].includes(plan.code),
);

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/account/subscriptions");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [invoicePreference, setInvoicePreference] =
    useState<InvoicePreference | null>(null);
  const [message, setMessage] = useState("正在讀取訂閱資料…");

  async function load() {
    const [subscriptionPayload, invoicePayload] = await Promise.all([
      authedFetch("/api/account/subscriptions"),
      authedFetch("/api/account/invoice-preference").catch(() => null),
    ]);
    setSubscriptions(subscriptionPayload.subscriptions || []);
    setEvents(subscriptionPayload.events || []);
    setInvoicePreference(invoicePayload?.preference || null);
  }

  useEffect(() => {
    if (!accessToken) return;
    load()
      .then(() => setMessage(""))
      .catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function cancel(id: string) {
    const reason = window.prompt("請簡短填寫取消原因：", "暫停使用");
    if (reason === null) return;
    setMessage("正在送出取消訂閱申請…");
    try {
      await authedFetch(`/api/account/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel", reason }),
      });
      await load();
      setMessage(
        "已送出取消訂閱申請。若 provider API 尚未啟用，營運端會進入 manual_required。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "取消訂閱失敗。",
      );
    }
  }

  return (
    <FormalOpsShell
      activeHref="/account/subscriptions"
      navItems={accountOpsNav}
      eyebrow="Subscriptions"
      title="訂閱管理"
      description="Pricing v2 方案已定案，但正式訂閱仍需 P0、ECPAY 定期定額、entitlement、發票、退款與 Buddies settlement 全鏈路通過。"
      quoteTitle="不提前開賣"
      quoteBody="舊的 ECPAY_RECURRING_ALLOW_NEXT_SPEC 不再能繞過商業 gate；只有 active、allowlist 且 PRICING_V2_COMMERCIAL_ENABLED 的方案才能建立授權。"
      topActions={<Link href="/account/billing">設定預設發票資料</Link>}
      dataPage="account-subscriptions-v128-pricing-v2-guard"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Final Spec</span>
              <h3>Pricing v2 訂閱方案</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            <div>
              <b>目前預設發票資料</b>
              <span>{describeInvoicePreference(invoicePreference)}</span>
              <span>
                <Link href="/account/billing">到帳務中心修改</Link>
              </span>
            </div>
            {plannedSubscriptions.map((plan) => (
              <div key={plan.code}>
                <b>
                  {plan.title}｜{plan.priceLabel}
                </b>
                <span>{plan.positioning}</span>
                <span>{plan.disabledReason || "尚未開放付款。"}</span>
              </div>
            ))}
            <div>
              <b>建立授權按鈕暫時關閉</b>
              <span>
                不從帳務中心偷開 next-spec。正式切換時，需同時修改 productCatalog、entitlement、ECPAY allowlist、發票、退款與 release verifier。
              </span>
            </div>
          </div>
        </article>

        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Profiles</span>
              <h3>我的訂閱</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                load().catch((error) => setMessage(error.message))
              }
            >
              重新整理
            </button>
          </div>
          <div className={styles.accountPreferenceList}>
            {subscriptions.map((subscription) => (
              <div key={subscription.id}>
                <b>
                  {subscription.plan_code}｜
                  {formatTwd(subscription.period_amount)}
                </b>
                <span>
                  {subscription.status}｜下次扣款 {formatDateTime(subscription.next_charge_at)}｜本期至 {formatDateTime(subscription.current_period_end)}
                </span>
                {subscription.invoice_preference ? (
                  <span>
                    發票資料：
                    {describeInvoicePreference(subscription.invoice_preference)}
                  </span>
                ) : null}
                {["active", "past_due", "pending"].includes(
                  String(subscription.status),
                ) ? (
                  <span>
                    <button
                      type="button"
                      onClick={() => void cancel(subscription.id)}
                    >
                      取消訂閱
                    </button>
                  </span>
                ) : null}
              </div>
            ))}
            {subscriptions.length === 0 ? (
              <div>
                <b>目前沒有訂閱。</b>
                <span>一次性 VIP 付款不會出現在訂閱列表。</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Events</span>
              <h3>訂閱事件</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {events.map((event) => (
              <div key={event.id}>
                <b>{event.event_type}</b>
                <span>
                  {event.merchant_trade_no || "—"}｜
                  {formatDateTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
