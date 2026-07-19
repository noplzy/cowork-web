"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminAppealDetailPage() {
  const params = useParams<{ appealId: string }>();
  const appealId = params?.appealId || "";
  const { accessToken, authedFetch } = useAuthedJson(`/admin/appeals/${appealId}`);
  const [payload, setPayload] = useState<any>(null);
  const [notice, setNotice] = useState("正在讀取申訴…");
  const [form, setForm] = useState({ status: "reviewing", admin_response: "", decision_reason: "", create_restore_action: false, admin_message: "" });

  async function load() {
    const data = await authedFetch(`/api/admin/appeals/${appealId}`);
    setPayload(data);
    setForm((current) => ({ ...current, status: data.appeal?.status === "open" ? "reviewing" : data.appeal?.status || "reviewing", admin_response: data.appeal?.admin_response || "", decision_reason: data.appeal?.decision_reason || "" }));
  }

  useEffect(() => {
    if (!accessToken || !appealId) return;
    load().then(() => setNotice("")).catch((error) => setNotice(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, appealId]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("正在更新申訴…");
    try {
      await authedFetch(`/api/admin/appeals/${appealId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          admin_response: form.admin_response || null,
          decision_reason: form.decision_reason || null,
          create_restore_action: form.status === "accepted" && form.create_restore_action,
        }),
      });
      await load();
      setNotice("申訴已更新並寫入 audit log。");
    } catch (error: any) {
      setNotice(error?.message || "更新申訴失敗。");
    }
  }

  async function sendMessage() {
    if (!form.admin_message.trim()) return;
    setNotice("正在送出訊息…");
    try {
      await authedFetch(`/api/admin/appeals/${appealId}`, { method: "PATCH", body: JSON.stringify({ admin_message: form.admin_message }) });
      setForm({ ...form, admin_message: "" });
      await load();
      setNotice("訊息已送出。");
    } catch (error: any) {
      setNotice(error?.message || "送出訊息失敗。");
    }
  }

  const appeal = payload?.appeal || {};
  const messages = payload?.messages || [];
  const actions = payload?.moderation_actions || [];

  return (
    <FormalOpsShell activeHref="/admin/appeals" navItems={adminOpsNav} eyebrow="Appeal Review" title={`申訴｜${appeal.status || "讀取中"}`} description="先看原案件與處置，再做 reviewing、accepted、rejected 或 closed。接受申訴不會默默改寫原紀錄，而是新增 restore action。" quoteTitle={appeal.reason_code} quoteBody={`user ${appeal.user_id || "—"}`} topActions={<><Link href="/admin/appeals">返回申訴</Link>{appeal.moderation_case_id ? <Link href={`/admin/moderation/${appeal.moderation_case_id}`}>開啟原案件</Link> : null}</>} dataPage="admin-appeal-detail-v129">
      {notice ? <div className={styles.accountLoading}>{notice}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Decision</span><h3>審查與決定</h3></div></div><form className={styles.formStack} onSubmit={update}><label><span className="i20-kicker">狀態</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="reviewing">reviewing</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="closed">closed</option></select></label><label><span className="i20-kicker">使用者可見回覆</span><textarea value={form.admin_response} onChange={(event) => setForm({ ...form, admin_response: event.target.value })} rows={5} /></label><label><span className="i20-kicker">內部決定原因</span><textarea value={form.decision_reason} onChange={(event) => setForm({ ...form, decision_reason: event.target.value })} rows={4} /></label>{form.status === "accepted" ? <label><input type="checkbox" checked={form.create_restore_action} onChange={(event) => setForm({ ...form, create_restore_action: event.target.checked })} /> 建立 restore moderation action</label> : null}<button className="i20-btn peach" type="submit">儲存決定</button></form></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Context</span><h3>原案件與處置</h3></div></div><div className={styles.accountPreferenceList}><div><b>申訴內容</b><span>{appeal.message || "—"}</span></div><div><b>希望結果</b><span>{appeal.requested_outcome || "—"}</span></div>{actions.map((action: any) => <div key={action.id}><b>{action.action_type}</b><span>{action.reason || "—"}｜{formatDateTime(action.created_at)}</span></div>)}</div></article>
      </section>
      <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Messages</span><h3>申訴對話</h3></div></div><div className={styles.accountPreferenceList}>{messages.map((message: any) => <div key={message.id}><b>{message.sender_role}</b><span>{message.body}</span><span>{formatDateTime(message.created_at)}</span></div>)}</div><div className={styles.formStack}><label><span className="i20-kicker">管理端訊息</span><textarea value={form.admin_message} onChange={(event) => setForm({ ...form, admin_message: event.target.value })} rows={4} /></label><button type="button" onClick={sendMessage} disabled={!form.admin_message.trim()}>送出訊息</button></div></article></section>
    </FormalOpsShell>
  );
}
