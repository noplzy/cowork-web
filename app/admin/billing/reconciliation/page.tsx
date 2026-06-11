"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, formatTwd, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function itemTitle(row: any) {
  return row.item_name || row.plan_code || row.merchant_trade_no || row.status || row.id || "項目";
}

function OrderList({ title, rows, kind }: { title: string; rows: any[]; kind: "order" | "task" | "refund" | "subscription" }) {
  return (
    <article className={styles.accountContentCard}>
      <div className={styles.accountContentHead}>
        <div>
          <span className="i20-kicker">Reconciliation</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className={styles.accountPreferenceList}>
        {rows.map((row) => (
          <div key={row.id}>
            <b>
              {kind === "order" && row.id ? <Link href={`/admin/billing/orders/${row.id}`}>{itemTitle(row)}</Link> : itemTitle(row)}
              {row.amount || row.amount_twd ? `｜${formatTwd(row.amount || row.amount_twd)}` : ""}
            </b>
            <span>
              {row.status || row.event_type || "—"}｜{row.user_id || "no-user"}｜{row.merchant_trade_no || row.payment_order_id || row.subscription_profile_id || row.refund_request_id || "—"}
            </span>
            <span>{row.last_error || row.last_provider_error || row.provider_invoice_no || row.provider_refund_id || ""}｜{formatDateTime(row.paid_at || row.created_at || row.updated_at)}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div>
            <b>目前沒有異常項目。</b>
            <span>這代表抽樣範圍內沒有找到此類對帳問題。</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/billing/reconciliation");
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取對帳報告…");

  async function load() {
    const data = await authedFetch("/api/admin/billing/reconciliation?limit=160");
    setPayload(data);
  }

  useEffect(() => {
    if (!accessToken) return;
    load()
      .then(() => setMessage(""))
      .catch((error) => setMessage(error.message));
  }, [accessToken]);

  const summary = payload?.summary || {};
  const cards = [
    ["paid_without_ledger", "已付款但無 ledger"],
    ["paid_without_invoice", "已付款但無發票"],
    ["invoice_failed_or_manual", "發票失敗 / 人工"],
    ["refund_approved_not_refunded", "退款已核准未完成"],
    ["subscription_past_due", "訂閱逾期"],
    ["subscription_action_required", "訂閱需處理"],
  ] as const;

  return (
    <FormalOpsShell
      activeHref="/admin/billing/reconciliation"
      navItems={adminOpsNav}
      eyebrow="Billing Reconciliation"
      title="金流對帳報告"
      description="正式收費後，每天都應檢查已付款未記帳、已付款未開票、退款未完成與訂閱異常。"
      quoteTitle="先抓漏，再擴方案"
      quoteBody="在 NT$299 / 599 / 1299 或 Buddies 交易化之前，對帳訊號要先穩。"
      topActions={
        <>
          <button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button>
          <Link href="/admin/billing/automation">自動化任務</Link>
        </>
      }
      dataPage="admin-billing-reconciliation-v114"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountMetricGrid}>
        {cards.map(([key, label]) => (
          <article className={styles.accountMetricCard} key={key}>
            <span className="i20-kicker">{key}</span>
            <h3>{label}</h3>
            <b>{summary[key] ?? "—"}</b>
            <p>{summary[key] ? "需要營運端檢查。" : "目前沒有發現。"}</p>
          </article>
        ))}
      </section>

      <section className={styles.accountContentGrid}>
        <OrderList title="已付款但沒有 payment ledger" rows={payload?.paid_without_ledger || []} kind="order" />
        <OrderList title="已付款但尚未有 issued 發票事件" rows={payload?.paid_without_invoice || []} kind="order" />
      </section>
      <section className={styles.accountContentGrid}>
        <OrderList title="發票 failed / manual_required" rows={payload?.invoice_failed_or_manual || []} kind="task" />
        <OrderList title="退款已核准但 provider 尚未完成" rows={payload?.refund_approved_not_refunded || []} kind="refund" />
      </section>
      <section className={styles.accountContentGrid}>
        <OrderList title="訂閱需處理" rows={payload?.subscription_action_required || []} kind="subscription" />
      </section>
    </FormalOpsShell>
  );
}
