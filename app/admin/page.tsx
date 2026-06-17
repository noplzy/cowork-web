"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function severityWeight(value: string) { if (value === "critical") return 5; if (value === "high") return 4; if (value === "normal") return 3; if (value === "low") return 2; return 1; }

export default function AdminPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin");
  const [summaryPayload, setSummaryPayload] = useState<any>(null);
  const [actionPayload, setActionPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取營運總覽…");

  async function load() {
    const [summary, actionCenter] = await Promise.all([authedFetch("/api/admin/ops/summary"), authedFetch("/api/admin/ops/action-center")]);
    setSummaryPayload(summary); setActionPayload(actionCenter);
  }
  useEffect(() => { if (!accessToken) return; load().then(() => setMessage("")).catch((error) => setMessage(error.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessToken]);

  const summary = summaryPayload?.summary || {};
  const allItems = useMemo(() => [...(actionPayload?.all || [])].sort((a: any, b: any) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 12), [actionPayload]);
  const healthScore = Math.max(0, 100 - Number(actionPayload?.summary?.total || 0) * 4);

  return (
    <FormalOpsShell activeHref="/admin" navItems={adminOpsNav} eyebrow="Admin Ops" title="營運指揮台" description="以 DESIGN.md 的方式，把管理端拆成清楚的視覺主題、狀態層級、元件規則與可操作任務；每天先判斷風險，再進單一資料表處理。" quoteTitle={`${actionPayload?.summary?.total || 0} action items`} quoteBody={`系統健康度 ${healthScore}%｜先看高風險，再處理一般營運。`} topActions={<><Link href="/admin/action-center">營運工作台</Link><Link href="/admin/users">使用者 360</Link><Link href="/admin/rooms">房間 360</Link><Link href="/buddies">Buddies 前台</Link></>} dataPage="admin-ops-v114-design-md">
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}><span className="i20-kicker">System Health</span><h3>今日營運健康度</h3><b>{healthScore}%</b><p>以 action items 數量粗估；越多待處理事項，越不適合正式導流。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">People</span><h3>客服與安全</h3><b>{Number(summary.open_tickets?.count || 0) + Number(summary.open_reports?.count || 0)}</b><p>客服單與安全檢舉是使用者信任的第一順位。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Rooms</span><h3>Active Rooms</h3><b>{summary.active_rooms?.count ?? "—"}</b><p>{summary.active_rooms?.error || "需持續監控 ghost room / cleanup / Daily 狀態。"}</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Buddies</span><h3>非金流里程碑</h3><b>Profile / Identity / Booking</b><p>金流審核期間，優先完成個人檔案、身分綁定與 Buddies 履約流程。</p></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Command Queue</span><h3>前 12 個待處理事項</h3></div><Link href="/admin/action-center">全部查看</Link></div><div className={styles.accountPreferenceList}>{allItems.map((item: any) => <div key={item.key || item.id}><b>{item.severity}｜{item.title}</b><span>{item.category}｜{item.description || "—"}｜{formatDateTime(item.created_at)}</span>{item.href ? <span><Link href={item.href}>前往處理</Link></span> : null}</div>)}{!allItems.length ? <div><b>目前沒有待處理事項。</b><span>這是好事，但不是可以停止監控的理由。</span></div> : null}</div></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Operating Areas</span><h3>成熟商業平台模組</h3></div></div><div className={styles.accountPreferenceList}><div><b>使用者 360</b><span>個人檔案、身分綁定、付款、房間、客服、AI 額度。</span><span><Link href="/admin/users">進入</Link></span></div><div><b>房間 360</b><span>Daily / Supabase / presence / cleanup / sponsor pass。</span><span><Link href="/admin/rooms">進入</Link></span></div><div><b>Buddies</b><span>服務上架、時段、預約、履約房、評價、爭議。</span><span><Link href="/buddies">前台</Link></span></div><div><b>通知 Outbox</b><span>模板、偏好、站內通知與外部 provider gate。</span><span><Link href="/admin/notifications">進入</Link></span></div></div></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Metrics</span><h3>目前資料表摘要</h3></div></div><div className={styles.accountPreferenceList}>{Object.entries(summary).map(([key, value]: any) => <div key={key}><b>{key.replaceAll("_", " ")}</b><span>{value?.count ?? "—"}｜{value?.error || "可讀取"}</span></div>)}</div></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Reliability</span><h3>近期可靠性事件</h3></div></div><div className={styles.accountPreferenceList}>{(summaryPayload?.recent_reliability_events || []).map((event: any) => <div key={event.id}><b>{event.event_type}｜{event.severity}</b><span>{event.source}｜{event.room_id || "no-room"}｜{formatDateTime(event.created_at)}</span></div>)}</div></article>
      </section>
    </FormalOpsShell>
  );
}
