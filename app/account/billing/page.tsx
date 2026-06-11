"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, formatTwd, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function latestByOrder(rows: any[], orderId: string) {
  return rows.find((row) => row.payment_order_id === orderId) || null;
}

function invoiceLabel(order: any, invoiceEvents: any[], invoiceTasks: any[]) {
  const events = invoiceEvents.filter((row) => row.payment_order_id === order.id);
  const issued = events.find((row) => row.event_type === "issued");
  if (issued) return `已開立 ${issued.invoice_number || ""}`.trim();
  const followup = events.find((row) => row.event_type === "void_or_allowance_required");
  if (followup) return "退款後需作廢 / 折讓";
  const failed = events.find((row) => row.event_type === "failed");
  if (failed) return "開立失敗，待處理";
  const task = latestByOrder(invoiceTasks, order.id);
  if (task?.status === "manual_required") return "待人工開立";
  if (task?.status === "failed") return "發票任務失敗";
  if (task?.status === "queued" || task?.status === "processing") return "開立處理中";
  const requested = events.find((row) => row.event_type === "requested");
  if (requested) return "已請求開立";
  return "尚未產生";
}

function refundLabel(order: any, refunds: any[], refundTasks: any[]) {
  const refund = refunds.find((row) => row.payment_order_id === order.id);
  if (!refund) return "—";
  const task = refundTasks.find((row) => row.refund_request_id === refund.id);
  const taskSuffix = task ? ` / ${task.status}` : "";
  return `${refund.status}${taskSuffix}`;
}

function StatusList({ title, rows, emptyText }: { title: string; rows: any[]; emptyText: string }) {
  return (
    <article className={styles.accountContentCard}>
      <div className={styles.accountContentHead}>
        <div>
          <span className="i20-kicker">Status</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className={styles.accountPreferenceList}>
        {rows.map((row) => (
          <div key={row.id}>
            <b>{row.title}</b>
            <span>{row.body}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div>
            <b>{emptyText}</b>
            <span>完成付款、開票或退款後會出現在這裡。</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/account/billing");
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取帳務資料…");

  useEffect(() => {
    if (!accessToken) return;
    authedFetch("/api/account/billing")
      .then((data) => {
        setPayload(data);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }, [accessToken]);

  const orders = payload?.payment_orders || [];
  const ledger = payload?.billing_ledger || [];
  const refunds = payload?.refund_requests || [];
  const invoices = payload?.invoice_events || [];
  const invoiceTasks = payload?.invoice_tasks || [];
  const refundTasks = payload?.refund_tasks || [];
  const subscriptions = payload?.subscription_profiles || [];
  const entitlement = payload?.entitlement;

  const invoiceRows = useMemo(
    () =>
      orders.map((order: any) => ({
        id: `invoice-${order.id}`,
        title: `${order.item_name || order.plan_code || "付款訂單"}｜${invoiceLabel(order, invoices, invoiceTasks)}`,
        body: `${order.merchant_trade_no}｜付款 ${order.status}｜${formatDateTime(order.paid_at || order.created_at)}`,
      })),
    [orders, invoices, invoiceTasks],
  );

  const refundRows = useMemo(
    () =>
      orders
        .filter((order: any) => refunds.some((refund: any) => refund.payment_order_id === order.id))
        .map((order: any) => ({
          id: `refund-${order.id}`,
          title: `${order.item_name || order.plan_code || "付款訂單"}｜${refundLabel(order, refunds, refundTasks)}`,
          body: `${formatTwd(order.amount)}｜${order.merchant_trade_no}`,
        })),
    [orders, refunds, refundTasks],
  );

  return (
    <FormalOpsShell
      activeHref="/account/billing"
      navItems={accountOpsNav}
      eyebrow="Billing Center"
      title="帳務紀錄"
      description="付款、權益、發票、退款與訂閱狀態會集中到這裡。"
      quoteTitle={entitlement?.plan || "free"}
      quoteBody={`VIP 到期：${formatDateTime(entitlement?.vip_until)}`}
      topActions={
        <>
          <Link href="/pricing">查看方案</Link>
          <Link href="/account/refunds">申請退款</Link>
          <Link href="/account/subscriptions">訂閱管理</Link>
        </>
      }
      dataPage="account-billing-v114"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}>
          <span className="i20-kicker">Orders</span>
          <h3>付款訂單</h3>
          <b>{orders.length}</b>
          <p>付款成立後會同步權益、帳務與發票任務。</p>
        </article>
        <article className={styles.accountMetricCard}>
          <span className="i20-kicker">Invoice</span>
          <h3>發票事件</h3>
          <b>{invoices.length}</b>
          <p>已請求、已開立、失敗或退款後需作廢 / 折讓都會顯示。</p>
        </article>
        <article className={styles.accountMetricCard}>
          <span className="i20-kicker">Refunds</span>
          <h3>退款申請</h3>
          <b>{refunds.length}</b>
          <p>退款需要客服與帳務審核。</p>
        </article>
      </section>

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Payment Orders</span>
              <h3>付款紀錄</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {orders.map((order: any) => (
              <div key={order.id || order.merchant_trade_no}>
                <b>{order.item_name || order.plan_code || "付款訂單"}｜{formatTwd(order.amount)}</b>
                <span>{order.status}｜{order.merchant_trade_no}｜{formatDateTime(order.created_at)}</span>
                <span>發票：{invoiceLabel(order, invoices, invoiceTasks)}｜退款：{refundLabel(order, refunds, refundTasks)}</span>
              </div>
            ))}
            {orders.length === 0 ? (
              <div>
                <b>目前沒有付款紀錄。</b>
                <span>完成付款後會出現在這裡。</span>
              </div>
            ) : null}
          </div>
        </article>

        <StatusList title="發票狀態" rows={invoiceRows} emptyText="目前沒有發票事件。" />
      </section>

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Ledger</span>
              <h3>帳務事件</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {ledger.slice(0, 10).map((item: any) => (
              <div key={item.id}>
                <b>{item.ledger_type}｜{formatTwd(item.amount_twd)}</b>
                <span>{item.direction}｜{item.description || "—"}｜{formatDateTime(item.occurred_at)}</span>
              </div>
            ))}
            {ledger.length === 0 ? (
              <div>
                <b>目前沒有帳務事件。</b>
                <span>付款、退款與權益調整會逐步留下紀錄。</span>
              </div>
            ) : null}
          </div>
        </article>

        <StatusList title="退款狀態" rows={refundRows} emptyText="目前沒有退款紀錄。" />
      </section>

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Subscriptions</span>
              <h3>訂閱狀態</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {subscriptions.map((subscription: any) => (
              <div key={subscription.id}>
                <b>{subscription.plan_code}｜{subscription.status}｜{formatTwd(subscription.period_amount)}</b>
                <span>本期：{formatDateTime(subscription.current_period_start)} → {formatDateTime(subscription.current_period_end)}｜下次扣款：{formatDateTime(subscription.next_charge_at)}</span>
                {subscription.last_provider_error ? <span>Provider error：{subscription.last_provider_error}</span> : null}
              </div>
            ))}
            {subscriptions.length === 0 ? (
              <div>
                <b>目前沒有訂閱紀錄。</b>
                <span>定期定額正式啟用後會出現在這裡。</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
