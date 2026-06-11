"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, formatTwd, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/refunds");
  const [refunds, setRefunds] = useState<any[]>([]);
  const [msg, setMsg] = useState("正在讀取退款申請…");

  async function load() {
    const p = await authedFetch("/api/admin/billing/refunds?limit=160");
    setRefunds(p.refunds || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMsg("")).catch((e) => setMsg(e.message));
  }, [accessToken]);

  async function update(id: string, status: string) {
    let adminNote = `Admin quick update: ${status}`;
    let providerRefundId = "";
    let manualRefundConfirmed = false;

    if (status === "refunded") {
      providerRefundId = window.prompt("請輸入綠界退刷 / 人工退款的 provider refund id 或對帳備註：", "") || "";
      if (!providerRefundId) {
        manualRefundConfirmed = window.confirm("沒有 provider refund id。你確定要以人工確認方式標記已退款嗎？");
        if (!manualRefundConfirmed) return;
      }
      adminNote = window.prompt("請填寫退款完成備註：", providerRefundId ? `人工確認退款完成：${providerRefundId}` : "人工確認退款完成") || adminNote;
    }

    if (status === "approved") {
      adminNote = window.prompt("核准退款備註：", "核准退款，建立退刷任務。") || adminNote;
    }

    setMsg("正在更新退款狀態…");
    try {
      await authedFetch(`/api/admin/billing/refunds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          admin_note: adminNote,
          provider_refund_id: providerRefundId || undefined,
          manual_refund_confirmed: manualRefundConfirmed,
        }),
      });
      await load();
      setMsg(status === "approved" ? "已核准退款，並建立退刷任務。" : "已更新退款狀態。");
    } catch (e: any) {
      setMsg(e?.message || "更新退款狀態失敗。");
    }
  }

  return (
    <FormalOpsShell
      activeHref="/admin/refunds"
      navItems={adminOpsNav}
      eyebrow="Refund Queue"
      title="退款審核"
      description="退款不是刪掉訂單，而是留下清楚處理紀錄，並和客服、付款、退刷任務、發票作廢 / 折讓流程保持一致。"
      dataPage="admin-refunds-v115"
    >
      {msg ? <div className={styles.accountLoading}>{msg}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Requests</span>
              <h3>退款申請</h3>
            </div>
            <button type="button" onClick={() => load().catch((e) => setMsg(e.message))}>重新整理</button>
          </div>
          <div className={styles.accountPreferenceList}>
            {refunds.map((r) => (
              <div key={r.id}>
                <b>{formatTwd(r.amount_twd)}｜{r.reason_category}</b>
                <span>{r.status}｜{r.user_id}｜{formatDateTime(r.created_at)}</span>
                <span>{r.provider_refund_id ? `provider refund id：${r.provider_refund_id}` : "尚未有 provider refund id"}</span>
                <span>
                  <button type="button" onClick={() => update(r.id, "reviewing")}>審核中</button>{" "}
                  <button type="button" onClick={() => update(r.id, "approved")}>核准並建立退刷任務</button>{" "}
                  <button type="button" onClick={() => update(r.id, "rejected")}>拒絕</button>{" "}
                  <button type="button" onClick={() => update(r.id, "refunded")}>人工標記已退款</button>
                </span>
              </div>
            ))}
            {refunds.length === 0 ? (
              <div>
                <b>目前沒有退款申請。</b>
                <span>使用者送出退款申請後會出現在這裡。</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
