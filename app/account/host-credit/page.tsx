"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AccountHostCreditPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/host-credit");
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取 Host Credit…");

  useEffect(() => {
    if (!accessToken) return;
    authedFetch("/api/ai/host-credit/status").then((data) => { setPayload(data); setMessage(""); }).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const account = payload?.account || {};
  const events = payload?.events || [];

  return (
    <FormalOpsShell activeHref="/account/host-credit" navItems={accountOpsNav} eyebrow="Host Credit" title="AI 主持額度" description="Host Credit 是 AI Shared Host 的成本與權益單位，不是無限個人 AI 陪聊。" quoteTitle={`${account.balance_total ?? 0} credits`} quoteBody="1 Host Credit = 25 分鐘 AI 主持權；AI 主動說話仍有 active cap。" dataPage="account-host-credit-v108">
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Balance</span><h3>可用額度</h3><b>{account.balance_total ?? 0}</b><p>可用於房主贊助 Shared Host。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Granted</span><h3>累計取得</h3><b>{account.lifetime_granted ?? 0}</b><p>訂閱、加購或人工補發會增加額度。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Used</span><h3>累計使用</h3><b>{account.lifetime_consumed ?? 0}</b><p>建立 AI 主持通行證會扣除額度。</p></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Events</span><h3>Host Credit 紀錄</h3></div></div>
          <div className={styles.accountPreferenceList}>
            {events.map((event: any) => <div key={event.id}><b>{event.event_type}｜{event.credits_delta > 0 ? `+${event.credits_delta}` : event.credits_delta}</b><span>餘額 {event.balance_after}｜{formatDateTime(event.created_at)}</span></div>)}
            {events.length === 0 ? <div><b>目前沒有 Host Credit 紀錄。</b><span>未來訂閱、加購或房主贊助會顯示在這裡。</span></div> : null}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
