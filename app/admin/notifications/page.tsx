"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminNotificationsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/notifications");
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("正在讀取通知 Outbox…");
  const [form, setForm] = useState({ user_id: "", channel: "in_app", subject: "", body: "", priority: "normal" });

  async function load() {
    const payload = await authedFetch("/api/admin/notifications/outbox?limit=160");
    setItems(payload.notifications || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function runProcessor() {
    const secret = window.prompt("請輸入 NOTIFICATION_PROCESSOR_SECRET / BILLING_AUTOMATION_SECRET / CRON_SECRET：");
    if (!secret) return;
    setMessage("正在處理通知 Outbox…");
    try {
      const res = await fetch("/api/internal/notifications/process", { method: "POST", headers: { "x-cron-secret": secret } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "processor failed");
      await load();
      setMessage("已執行通知處理。");
    } catch (error: any) {
      setMessage(error?.message || "通知處理失敗。");
    }
  }

  async function createNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在建立通知…");
    try {
      await authedFetch("/api/admin/notifications/outbox", { method: "POST", body: JSON.stringify({ ...form, user_id: form.user_id || null, template_key: "admin_manual" }) });
      setForm({ user_id: "", channel: "in_app", subject: "", body: "", priority: "normal" });
      await load();
      setMessage("已建立通知。");
    } catch (error: any) {
      setMessage(error?.message || "建立通知失敗。");
    }
  }

  async function updateNotification(id: string, status: string) {
    setMessage("正在更新通知…");
    try {
      await authedFetch(`/api/admin/notifications/outbox/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      setMessage("已更新通知。");
    } catch (error: any) {
      setMessage(error?.message || "更新通知失敗。");
    }
  }

  return <FormalOpsShell activeHref="/admin/notifications" navItems={adminOpsNav} eyebrow="Notification Outbox" title="通知 Outbox" description="客服、退款、訂閱與重要系統事件不能只靠人工傳話；所有通知都需要狀態、重試、人工介入與可追蹤紀錄。" quoteTitle="Outbox-first" quoteBody="未啟用外部 provider 時會進入 manual_required，不假裝已寄出。" topActions={<button type="button" onClick={runProcessor}>執行通知處理</button>} dataPage="admin-notifications-v111">{message ? <div className={styles.accountLoading}>{message}</div> : null}<section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Create</span><h3>建立站內通知</h3></div></div><form className={styles.formStack} onSubmit={createNotification}><label><span className="i20-kicker">User ID</span><input value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })} placeholder="uuid，可空白測 outbox" /></label><label><span className="i20-kicker">Channel</span><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option value="in_app">in_app</option><option value="email">email</option><option value="sms">sms</option><option value="line">line</option><option value="telegram">telegram</option><option value="webhook">webhook</option></select></label><label><span className="i20-kicker">Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label><span className="i20-kicker">Body</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={5} required /></label><button className="i20-btn peach" type="submit">建立通知</button></form></article><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Outbox</span><h3>通知佇列</h3></div><button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button></div><div className={styles.accountPreferenceList}>{items.map((item) => <div key={item.id}><b>{item.channel}｜{item.status}｜{item.priority}</b><span>{item.subject || item.template_key}｜{item.user_id || item.recipient || "no-recipient"}</span><span>{item.last_error || item.body}｜{formatDateTime(item.created_at)}</span><span><button type="button" onClick={() => updateNotification(item.id, "queued")}>重排</button> <button type="button" onClick={() => updateNotification(item.id, "sent")}>標記已送</button> <button type="button" onClick={() => updateNotification(item.id, "cancelled")}>取消</button></span></div>)}</div></article></section></FormalOpsShell>;
}
