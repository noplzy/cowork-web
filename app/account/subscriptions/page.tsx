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

const pricingV2Plans = PRODUCT_PLANS.filter((plan) =>
  [
    "rooms_unlimited_299",
    "buddies_pro_399",
    "whole_site_599",
    "host_999",
  ].includes(plan.code),
);

function minutes(seconds: unknown) {
  return Math.floor(Math.max(0, Number(seconds || 0)) / 60);
}

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/account/subscriptions");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [entitlement, setEntitlement] = useState<any>(null);
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
    setEntitlement(subscriptionPayload.entitlement || null);
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
    setMessage("正在送出期末取消申請…");
    try {
      const payload = await authedFetch(`/api/account/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel", reason }),
      });
      await load();
      setMessage(
        `已申請取消自動續扣；本期權益保留到 ${formatDateTime(
          payload.entitlement_preserved_until,
        )}。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取消訂閱失敗。");
    }
  }

  return (
    <FormalOpsShell
      activeHref="/account/subscriptions"
      navItems={accountOpsNav}
      eyebrow="Subscriptions"
      title="訂閱與 Rooms 額度"
      description="P2 只開放 Rooms 299 受控試營運。Buddies 399、全站 599、主理人 999 仍等待 P3 結算閉環。"
      quoteTitle="Cancel at period end"
      quoteBody="取消不會立即拿走已付款的本期權益；系統會停止後續自動續扣，並保留使用到本期結束。"
      topActions={
        <>
          <Link href="/pricing">查看方案</Link>
          <Link href="/account/billing">帳務中心</Link>
        </>
      }
      dataPage="account-subscriptions-v130-rooms-299"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Current Entitlement</span>
              <h3>目前權益</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            <div>
              <b>{entitlement?.planCode || "free"}</b>
              <span>
                {entitlement?.billingMode || "free"}｜有效至 {formatDateTime(entitlement?.validUntil)}
              </span>
              <span>
                {entitlement?.cancelAtPeriodEnd
                  ? "已申請本期結束後取消"
                  : entitlement?.autoRenew
                    ? "每月自動續扣"
                    : "不自動續扣"}
              </span>
            </div>
            <div>
              <b>視覺同行額度</b>
              <span>
                {entitlement?.visualWallet
                  ? `剩餘 ${minutes(entitlement.visualWallet.remaining)} 分鐘／本期 ${minutes(entitlement.visualWallet.granted)} 分鐘`
                  : "目前方案沒有 P2 視覺 wallet"}
              </span>
            </div>
            <div>
              <b>同行延長點</b>
              <span>
                {entitlement?.extensionWallet
                  ? `剩餘 ${entitlement.extensionWallet.remaining} 點／本期 ${entitlement.extensionWallet.granted} 點`
                  : "目前方案沒有同行延長點"}
              </span>
            </div>
            <div>
              <b>預設發票資料</b>
              <span>{describeInvoicePreference(invoicePreference)}</span>
            </div>
          </div>
        </article>

        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Pricing v2</span>
              <h3>方案開放狀態</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {pricingV2Plans.map((plan) => (
              <div key={plan.code}>
                <b>{plan.title}｜{plan.priceLabel}</b>
                <span>{plan.positioning}</span>
                <span>
                  {plan.purchaseEnabled
                    ? "受控試營運已開放，請從方案頁建立授權。"
                    : plan.disabledReason || "尚未開放付款。"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Profiles</span>
              <h3>我的訂閱</h3>
            </div>
            <button type="button" onClick={() => void load().catch((error) => setMessage(error.message))}>
              重新整理
            </button>
          </div>
          <div className={styles.accountPreferenceList}>
            {subscriptions.map((subscription) => (
              <div key={subscription.id}>
                <b>{subscription.plan_code}｜{formatTwd(subscription.period_amount)}</b>
                <span>
                  {subscription.status}｜本期至 {formatDateTime(subscription.current_period_end)}｜下次扣款 {formatDateTime(subscription.next_charge_at)}
                </span>
                <span>
                  entitlement：{subscription.commercial_entitlement_status || "pending"}
                </span>
                {subscription.invoice_preference ? (
                  <span>發票：{describeInvoicePreference(subscription.invoice_preference)}</span>
                ) : null}
                {["active", "past_due", "pending"].includes(String(subscription.status)) ? (
                  <span>
                    <button type="button" onClick={() => void cancel(subscription.id)}>
                      本期結束後取消
                    </button>
                  </span>
                ) : null}
              </div>
            ))}
            {subscriptions.length === 0 ? (
              <div>
                <b>目前沒有訂閱。</b>
                <span>一次性 NT$199 VIP 不會出現在訂閱列表。</span>
              </div>
            ) : null}
          </div>
        </article>

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
                <span>{event.merchant_trade_no || "—"}｜{formatDateTime(event.created_at)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
