"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { describeInvoicePreference } from "@/components/billing/InvoicePreferenceFields";
import type { InvoicePreference } from "@/lib/invoicePreferences";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, formatTwd, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/account/subscriptions");
  const [subs, setSubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [invoicePreference, setInvoicePreference] = useState<InvoicePreference | null>(null);
  const [msg, setMsg] = useState("正在讀取訂閱資料…");

  async function load() {
    const [subscriptionPayload, invoicePayload] = await Promise.all([
      authedFetch("/api/account/subscriptions"),
      authedFetch("/api/account/invoice-preference").catch(() => null),
    ]);
    setSubs(subscriptionPayload.subscriptions || []);
    setEvents(subscriptionPayload.events || []);
    setInvoicePreference(invoicePayload?.preference || null);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMsg("")).catch((error) => setMsg(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function start(planCode: string) {
    setMsg("正在建立自動扣款授權…");
    try {
      const invoicePayload = await authedFetch("/api/account/invoice-preference").catch(() => null);
      const activeInvoicePreference = invoicePayload?.preference || invoicePreference || null;
      const confirmed = window.confirm(
        `建立訂閱會使用目前預設發票資料：\n${describeInvoicePreference(activeInvoicePreference)}\n\n要修改請先到帳務中心儲存新的預設發票資料。`,
      );
      if (!confirmed) {
        setMsg("已取消建立訂閱授權。");
        return;
      }

      const payload = await authedFetch("/api/payments/ecpay/recurring/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode, invoicePreference: activeInvoicePreference || undefined }),
      });
      const form = document.createElement("form");
      form.method = payload.method || "POST";
      form.action = payload.action;
      form.style.display = "none";
      Object.entries(payload.fields || {}).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      setMsg(error?.message || "建立自動扣款失敗。");
    }
  }

  async function cancel(id: string) {
    const reason = window.prompt("請簡短填寫取消原因：", "暫停使用");
    if (reason === null) return;
    setMsg("正在送出取消訂閱申請…");
    try {
      await authedFetch(`/api/account/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel", reason }) });
      await load();
      setMsg("已送出取消訂閱申請。若 provider API 尚未啟用，營運端會進入 manual_required。");
    } catch (error: any) {
      setMsg(error?.message || "取消訂閱失敗。");
    }
  }

  return (
    <FormalOpsShell
      activeHref="/account/subscriptions"
      navItems={accountOpsNav}
      eyebrow="Subscriptions"
      title="訂閱管理"
      description="正式自動扣款需要同時支援授權、續扣、取消、退款與發票；這裡顯示你的訂閱狀態與取消申請。"
      quoteTitle="安全優先"
      quoteBody="訂閱建立前會使用帳務中心的預設發票資料，續扣發票會沿用訂閱 profile 的發票快照。"
      topActions={<Link href="/account/billing">設定預設發票資料</Link>}
      dataPage="account-subscriptions-v120-invoice-preference"
    >
      {msg ? <div className={styles.accountLoading}>{msg}</div> : null}

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Start</span>
              <h3>建立自動扣款授權</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            <div>
              <b>本次訂閱預設發票資料</b>
              <span>{describeInvoicePreference(invoicePreference)}</span>
              <span><Link href="/account/billing">到帳務中心修改預設發票資料</Link></span>
            </div>
            <div>
              <b>安心同行｜NT$299 / 月</b>
              <span>需 Vercel 開啟 ECPAY_RECURRING_ENABLED，且綠界定期定額服務已開通。</span>
              <span><button type="button" onClick={() => start("companion_basic_299")}>建立授權</button></span>
            </div>
            <div>
              <b>常駐同行｜NT$599 / 月</b>
              <span>需進階房間工具、帳務紀錄與客服處理流程完成後再正式開放。</span>
              <span><button type="button" onClick={() => start("companion_regular_599")}>建立授權</button></span>
            </div>
          </div>
        </article>

        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Profiles</span>
              <h3>我的訂閱</h3>
            </div>
            <button type="button" onClick={() => load().catch((error) => setMsg(error.message))}>重新整理</button>
          </div>
          <div className={styles.accountPreferenceList}>
            {subs.map((subscription) => (
              <div key={subscription.id}>
                <b>{subscription.plan_code}｜{formatTwd(subscription.period_amount)}</b>
                <span>{subscription.status}｜下次扣款 {formatDateTime(subscription.next_charge_at)}｜本期至 {formatDateTime(subscription.current_period_end)}</span>
                {subscription.invoice_preference ? <span>發票資料：{describeInvoicePreference(subscription.invoice_preference)}</span> : null}
                {["active", "past_due", "pending"].includes(String(subscription.status)) ? <span><button type="button" onClick={() => cancel(subscription.id)}>取消訂閱</button></span> : null}
              </div>
            ))}
            {subs.length === 0 ? (
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
                <span>{event.merchant_trade_no || "—"}｜{formatDateTime(event.created_at)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
