"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AccountIdentityBindingsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/identity/bindings");
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取身分綁定…");
  const [form, setForm] = useState({ legal_name: "", birth_year: "", document_type: "id_card", document_last4: "", user_note: "" });

  async function load() { setPayload(await authedFetch("/api/account/identity/bindings")); }
  useEffect(() => { if (!accessToken) return; load().then(() => setMessage("")).catch((error) => setMessage(error.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessToken]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("正在送出人工審核申請…");
    try { await authedFetch("/api/account/identity/bindings", { method: "POST", body: JSON.stringify({ action: "submit_manual_review", ...form }) }); setForm({ legal_name: "", birth_year: "", document_type: "id_card", document_last4: "", user_note: "" }); await load(); setMessage("已送出人工審核申請。"); }
    catch (error: any) { setMessage(error?.message || "送出失敗。"); }
  }
  async function cancelPending() {
    setMessage("正在取消待審核申請…");
    try { await authedFetch("/api/account/identity/bindings", { method: "POST", body: JSON.stringify({ action: "cancel_pending_review" }) }); await load(); setMessage("已取消待審核申請。"); }
    catch (error: any) { setMessage(error?.message || "取消失敗。"); }
  }
  const bindings = payload?.bindings || [];
  const requests = payload?.requests || [];
  const pendingRequest = requests.find((item: any) => ["pending", "needs_more_info"].includes(item.review_status));

  return (
    <FormalOpsShell activeHref="/account/identity/bindings" navItems={accountOpsNav} eyebrow="Identity Bindings" title="身分綁定" description="正式平台需要把 Email、手機、人工審核與未來第三方登入都做成可追蹤的綁定紀錄。" quoteTitle={pendingRequest ? "審核中" : "綁定越完整，服務越安全"} quoteBody="目前不收完整證件影像，只紀錄末四碼與人工審核申請，避免過早承擔敏感資料風險。" dataPage="account-identity-bindings-v114">
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Email</span><h3>Email</h3><b>{payload?.auth?.email_verified ? "已綁定" : "未確認"}</b><p>{payload?.auth?.email_masked || "—"}</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Phone</span><h3>手機</h3><b>{payload?.auth?.phone_verified ? "已綁定" : "未綁定"}</b><p>{payload?.auth?.phone_masked || "可先到手機驗證完成"}</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Manual Review</span><h3>人工審核</h3><b>{pendingRequest ? "審核中" : "可送出"}</b><p>用於 Buddies 與高信任服務。</p></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Bindings</span><h3>綁定紀錄</h3></div></div><div className={styles.accountPreferenceList}>{bindings.map((item: any) => <div key={item.id}><b>{item.binding_type}｜{item.status}</b><span>{item.binding_value_masked || "—"}｜{formatDateTime(item.verified_at || item.created_at)}</span></div>)}{bindings.length === 0 ? <div><b>尚無綁定紀錄。</b><span>完成 Email / 手機 / 人工審核後會出現在這裡。</span></div> : null}</div></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Manual Review</span><h3>人工審核申請</h3></div>{pendingRequest ? <button type="button" onClick={cancelPending}>取消待審核</button> : null}</div><form className={styles.formStack} onSubmit={submitReview}><label><span className="i20-kicker">真實姓名</span><input value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} disabled={Boolean(pendingRequest)} required /></label><label><span className="i20-kicker">出生年份</span><input value={form.birth_year} onChange={(event) => setForm({ ...form, birth_year: event.target.value })} placeholder="1998" disabled={Boolean(pendingRequest)} required /></label><label><span className="i20-kicker">證件類型</span><select value={form.document_type} onChange={(event) => setForm({ ...form, document_type: event.target.value })} disabled={Boolean(pendingRequest)}><option value="id_card">身分證</option><option value="resident_certificate">居留證</option><option value="passport">護照</option><option value="student_or_work">學生 / 工作證明</option></select></label><label><span className="i20-kicker">證件末四碼</span><input value={form.document_last4} onChange={(event) => setForm({ ...form, document_last4: event.target.value })} disabled={Boolean(pendingRequest)} inputMode="numeric" maxLength={4} required /></label><label><span className="i20-kicker">補充說明</span><textarea value={form.user_note} onChange={(event) => setForm({ ...form, user_note: event.target.value })} disabled={Boolean(pendingRequest)} rows={4} /></label><button className="i20-btn peach" type="submit" disabled={Boolean(pendingRequest)}>送出人工審核</button></form></article>
      </section>
    </FormalOpsShell>
  );
}
