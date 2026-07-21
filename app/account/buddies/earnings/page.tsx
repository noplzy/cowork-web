"use client";

import { useEffect, useState } from "react";
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

export default function BuddyEarningsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/buddies/earnings");
  const [payload, setPayload] = useState(null as any);
  const [account, setAccount] = useState(null as any);
  const [bankCode, setBankCode] = useState("");
  const [last5, setLast5] = useState("");
  const [holder, setHolder] = useState("");
  const [message, setMessage] = useState("正在讀取收益…");

  async function load() {
    const [earnings, payout] = await Promise.all([
      authedFetch("/api/account/buddies/earnings"),
      authedFetch("/api/account/buddies/payout-account"),
    ]);
    setPayload(earnings);
    setAccount(payout.payout_account || null);
    setBankCode(payout.payout_account?.bank_code || "");
    setLast5(payout.payout_account?.account_last5 || "");
    setHolder(payout.payout_account?.account_holder_name || "");
    setMessage("");
  }

  async function save() {
    try {
      setMessage("正在送交人工核對…");
      await authedFetch("/api/account/buddies/payout-account", {
        method: "PUT",
        body: JSON.stringify({
          bank_code: bankCode,
          account_last5: last5,
          account_holder_name: holder,
          consent: true,
        }),
      });
      await load();
      setMessage("已送交人工核對。完整帳號只透過平台指定的安全管道提供，不會存進網站資料庫。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗。");
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const summary = payload?.summary || {};
  return (
    <FormalOpsShell
      activeHref="/account/buddies/earnings"
      navItems={accountOpsNav}
      eyebrow="Buddies Earnings"
      title="收益與人工撥款"
      description="試營運使用經人工核對的銀行轉帳。網站只保存銀行代碼、帳號末碼與外部安全紀錄 reference，不保存完整帳號。"
      quoteTitle="先安全，再自動化"
      quoteBody="銀行帳號、身分文件與自動撥款 adapter 尚未進入應用資料庫；正式自動撥款屬長期架構。"
      dataPage="account-buddy-earnings-v131"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountMetricGrid}>
        <article><span>保留中</span><b>{formatTwd(summary.held_twd)}</b></article>
        <article><span>可撥款</span><b>{formatTwd(summary.releasable_twd)}</b></article>
        <article><span>處理中</span><b>{formatTwd(summary.processing_twd)}</b></article>
        <article><span>已撥款</span><b>{formatTwd(summary.paid_out_twd)}</b></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Payout Account</span><h3>收款帳戶末碼</h3></div><b>{account?.status || "尚未設定"}</b></div>
          <label>銀行代碼<input value={bankCode} onChange={(event) => setBankCode(event.target.value)} maxLength={3} /></label>
          <label>帳號末 4～5 碼<input value={last5} onChange={(event) => setLast5(event.target.value)} maxLength={5} /></label>
          <label>戶名<input value={holder} onChange={(event) => setHolder(event.target.value)} maxLength={80} /></label>
          <button type="button" onClick={() => void save()}>送交人工核對</button>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Settlements</span><h3>結算紀錄</h3></div></div>
          <div className={styles.accountPreferenceList}>
            {(payload?.settlements || []).map((row: any) => <div key={row.id}><b>{formatTwd(row.provider_net_twd)}｜{row.status}</b><span>{formatDateTime(row.created_at)}｜平台費 {formatTwd(row.platform_fee_twd)}</span></div>)}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
