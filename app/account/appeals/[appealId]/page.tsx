"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AccountAppealDetailPage() {
  const params = useParams<{ appealId: string }>();
  const appealId = params?.appealId || "";
  const { accessToken, authedFetch } = useAuthedJson(`/account/appeals/${appealId}`);
  const [payload, setPayload] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("正在讀取申訴…");

  async function load() {
    const data = await authedFetch(`/api/appeals/${encodeURIComponent(appealId)}`);
    setPayload(data);
  }

  useEffect(() => {
    if (!accessToken || !appealId) return;
    load().then(() => setNotice("")).catch((error) => setNotice(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, appealId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("正在送出補充…");
    try {
      await authedFetch(`/api/appeals/${appealId}/messages`, { method: "POST", body: JSON.stringify({ body: reply }) });
      setReply("");
      await load();
      setNotice("已送出補充。");
    } catch (error: any) {
      setNotice(error?.message || "送出補充失敗。");
    }
  }

  async function closeAppeal() {
    setNotice("正在關閉申訴…");
    try {
      await authedFetch(`/api/appeals/${appealId}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
      await load();
      setNotice("申訴已關閉。");
    } catch (error: any) {
      setNotice(error?.message || "關閉申訴失敗。");
    }
  }

  const appeal = payload?.appeal || {};
  const messages = payload?.messages || [];
  const events = payload?.events || [];
  const canReply = ["open", "reviewing"].includes(appeal.status);

  return (
    <FormalOpsShell activeHref="/account/appeals" navItems={accountOpsNav} eyebrow="Appeal" title={`申訴｜${appeal.status || "讀取中"}`} description="你只能看到自己的申訴、使用者可見回覆與相關處置摘要。內部管理備註不會出現在這裡。" quoteTitle={appeal.reason_code} quoteBody={appeal.requested_outcome || "未填期望結果"} topActions={<Link href="/account/appeals">返回申訴列表</Link>} dataPage="account-appeal-detail-v129">
      {notice ? <div className={styles.accountLoading}>{notice}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Decision</span><h3>申訴狀態</h3></div>{["open", "reviewing"].includes(appeal.status) ? <button type="button" onClick={closeAppeal}>關閉申訴</button> : null}</div><div className={styles.accountPreferenceList}><div><b>狀態</b><span>{appeal.status || "—"}</span></div><div><b>管理端回覆</b><span>{appeal.admin_response || "尚未有正式決定。"}</span></div><div><b>審查時間</b><span>{formatDateTime(appeal.review_started_at)} → {formatDateTime(appeal.resolved_at || appeal.closed_at)}</span></div>{payload?.original_action ? <div><b>原處置</b><span>{payload.original_action.action_type}｜{payload.original_action.reason || "—"}</span></div> : null}{payload?.resolution_action ? <div><b>恢復處置</b><span>{payload.resolution_action.action_type}｜{payload.resolution_action.reason || "—"}</span></div> : null}</div></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Messages</span><h3>申訴對話</h3></div></div><div className={styles.accountPreferenceList}>{messages.map((message: any) => <div key={message.id}><b>{message.sender_role === "admin" ? "安感島治理人員" : message.sender_role === "system" ? "系統" : "你"}</b><span>{message.body}</span><span>{formatDateTime(message.created_at)}</span></div>)}</div>{canReply ? <form className={styles.formStack} onSubmit={send}><label><span className="i20-kicker">補充說明</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={5} required /></label><button className="i20-btn peach" type="submit" disabled={!reply.trim()}>送出補充</button></form> : null}</article>
      </section>
      <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Events</span><h3>處理事件</h3></div></div><div className={styles.accountPreferenceList}>{events.map((event: any) => <div key={event.id}><b>{event.event_type}</b><span>{event.from_status || "—"} → {event.to_status || "—"}｜{formatDateTime(event.created_at)}</span></div>)}</div></article></section>
    </FormalOpsShell>
  );
}
