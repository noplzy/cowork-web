"use client";

import { useEffect, useState } from "react";
import {
  FormalOpsShell,
  adminOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  formatTwd,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminBuddySettlementsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/buddies/settlements");
  const [settlements, setSettlements] = useState([] as any[]);
  const [accounts, setAccounts] = useState([] as any[]);
  const [batches, setBatches] = useState([] as any[]);
  const [message, setMessage] = useState("正在讀取 Buddies 結算…");

  async function load() {
    const [s, a, b] = await Promise.all([
      authedFetch("/api/admin/buddies/settlements?status=all"),
      authedFetch("/api/admin/buddies/payout-accounts?status=all"),
      authedFetch("/api/admin/buddies/payout-batches?status=all"),
    ]);
    setSettlements(s.settlements || []);
    setAccounts(a.payout_accounts || []);
    setBatches(b.payout_batches || []);
    setMessage("");
  }

  async function verifyAccount(id: string) {
    const reference = window.prompt("輸入外部安全保管 reference，例如 vault://record-id。不要輸入銀行帳號。") || "";
    if (!reference) return;
    await authedFetch(`/api/admin/buddies/payout-accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "verify", secure_provider_reference: reference }),
    });
    await load();
  }

  async function createBatch(row: any) {
    try {
      setMessage("正在建立人工撥款批次…");
      await authedFetch("/api/admin/buddies/payout-batches", {
        method: "POST",
        body: JSON.stringify({ provider_user_id: row.provider_user_id, settlement_ids: [row.id], note: "P3 手動撥款" }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立撥款批次失敗。");
    }
  }

  async function transitionBatch(id: string, action: "mark_processing" | "complete" | "cancel" | "fail") {
    const providerReference = action === "complete"
      ? window.prompt("輸入銀行轉帳交易參考碼。不要輸入完整帳號。") || ""
      : "";
    if (action === "complete" && !providerReference) return;
    const note = action === "fail"
      ? window.prompt("請填寫撥款失敗原因。") || ""
      : null;
    if (action === "fail" && !note) return;
    try {
      setMessage("正在更新撥款批次…");
      await authedFetch(`/api/admin/buddies/payout-batches/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, provider_reference: providerReference || null, note }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新撥款批次失敗。");
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <FormalOpsShell
      activeHref="/admin/buddies/settlements"
      navItems={adminOpsNav}
      eyebrow="Buddies Settlement"
      title="Buddies 結算與人工撥款"
      description="只有 billing.manage 可以核對收款帳戶、建立撥款批次與標記人工轉帳完成。完整銀行帳號必須留在外部安全保管系統。"
      quoteTitle="不是法律 escrow"
      quoteBody="這裡是平台內部應付帳款與保留狀態；法規、信託與自動銀行撥款仍需另行完成。"
      topActions={<button type="button" onClick={() => void load()}>重新整理</button>}
      dataPage="admin-buddy-settlements-v131"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Accounts</span><h3>收款帳戶核對</h3></div></div>
          <div className={styles.accountPreferenceList}>{accounts.map((row) => <div key={row.id}><b>{row.bank_code}｜***{row.account_last5}｜{row.status}</b><span>{row.account_holder_name}｜{row.provider_user_id}</span>{row.status === "pending_review" ? <button type="button" onClick={() => void verifyAccount(row.id)}>標記已安全核對</button> : null}</div>)}</div>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Releasable</span><h3>可撥款結算</h3></div></div>
          <div className={styles.accountPreferenceList}>{settlements.map((row) => <div key={row.id}><b>{formatTwd(row.provider_net_twd)}｜{row.status}</b><span>{row.provider_user_id}｜{formatDateTime(row.available_for_payout_at)}</span>{row.status === "releasable" ? <button type="button" onClick={() => void createBatch(row)}>建立單一提供者撥款批次</button> : null}</div>)}</div>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Batches</span><h3>撥款批次</h3></div></div>
          <div className={styles.accountPreferenceList}>{batches.map((row) => <div key={row.id}><b>{formatTwd(row.total_amount_twd)}｜{row.status}</b><span>{row.provider_user_id}｜{formatDateTime(row.created_at)}</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{row.status === "approved" ? <button type="button" onClick={() => void transitionBatch(row.id, "mark_processing")}>標記轉帳處理中</button> : null}{["approved", "processing"].includes(row.status) ? <button type="button" onClick={() => void transitionBatch(row.id, "complete")}>確認已轉帳</button> : null}{row.status !== "completed" ? <><button type="button" onClick={() => void transitionBatch(row.id, "cancel")}>取消批次</button><button type="button" onClick={() => void transitionBatch(row.id, "fail")}>標記失敗</button></> : null}</div></div>)}</div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
