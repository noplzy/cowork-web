"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminActionCenterPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/action-center");
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取營運工作台…");
  const [form, setForm] = useState({ title: "", description: "", category: "general", severity: "normal" });

  async function load() {
    const data = await authedFetch("/api/admin/ops/action-center");
    setPayload(data);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function createAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在建立營運任務…");
    try {
      await authedFetch("/api/admin/ops/action-center", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", description: "", category: "general", severity: "normal" });
      await load();
      setMessage("已建立任務。");
    } catch (error: any) {
      setMessage(error?.message || "建立任務失敗。");
    }
  }

  async function updateManual(id: string, status: string) {
    setMessage("正在更新任務…");
    try {
      await authedFetch(`/api/admin/ops/action-items/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      setMessage("已更新任務。");
    } catch (error: any) {
      setMessage(error?.message || "更新任務失敗。");
    }
  }

  const summary = payload?.summary || {};
  const allItems = payload?.all || [];
  const errors = payload?.errors || [];

  return <FormalOpsShell activeHref="/admin/action-center" navItems={adminOpsNav} eyebrow="Action Center" title="營運工作台" description="把客服、退款、發票、訂閱、通知、安全檢舉與幽靈房間風險集中成每日處理清單。" quoteTitle={`${summary.total || 0} open items`} quoteBody="這裡是營運優先順序，不是另一個資料表列表。" dataPage="admin-action-center-v111">{message ? <div className={styles.accountLoading}>{message}</div> : null}{errors.length ? <div className={styles.accountLoading}>部分資料表讀取失敗：{errors.join("；")}</div> : null}<section className={styles.accountMetricGrid}>{Object.entries(summary).map(([key, value]: any) => <article className={styles.accountMetricCard} key={key}><span className="i20-kicker">{key}</span><h3>{key.replaceAll("_", " ")}</h3><b>{value}</b><p>待處理項目</p></article>)}</section><section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Detected</span><h3>系統偵測任務</h3></div><button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button></div><div className={styles.accountPreferenceList}>{allItems.map((item: any) => <div key={item.key || item.id}><b>{item.severity}｜{item.title}</b><span>{item.category}｜{item.description || "—"}｜{formatDateTime(item.created_at)}</span><span>{item.href ? <Link href={item.href}>前往處理</Link> : null}{item.id ? <><button type="button" onClick={() => updateManual(item.id, "in_progress")}>處理中</button> <button type="button" onClick={() => updateManual(item.id, "resolved")}>完成</button></> : null}</span></div>)}{allItems.length === 0 ? <div><b>目前沒有待處理任務。</b><span>如果這是真的，今天可以提早喝咖啡；如果不是，表示偵測規則還要補。</span></div> : null}</div></article><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Manual</span><h3>建立人工任務</h3></div></div><form className={styles.formStack} onSubmit={createAction}><label><span className="i20-kicker">Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span className="i20-kicker">Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="general">general</option><option value="support">support</option><option value="billing">billing</option><option value="refund">refund</option><option value="safety">safety</option><option value="rooms">rooms</option><option value="notification">notification</option></select></label><label><span className="i20-kicker">Severity</span><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option><option value="critical">critical</option></select></label><label><span className="i20-kicker">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} /></label><button className="i20-btn peach" type="submit">建立任務</button></form></article></section></FormalOpsShell>;
}
