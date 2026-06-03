"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { Image20Logo } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type SessionState = { token: string; email: string };

type ShellProps = {
  active: string;
  admin?: boolean;
  title: string;
  eyebrow: string;
  heading: string;
  body: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const accountLinks = [
  ["/account", "我的中心"],
  ["/account/billing", "帳務紀錄"],
  ["/account/support", "客服紀錄"],
  ["/rooms", "同行空間"],
  ["/contact", "客服入口"],
] as const;

const adminLinks = [
  ["/admin", "營運總覽"],
  ["/admin/support", "客服單"],
  ["/admin/safety", "安全檢舉"],
  ["/admin/refunds", "退款審核"],
  ["/account", "回我的中心"],
] as const;

function useSessionOrRedirect(nextPath: string) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [message, setMessage] = useState("正在讀取帳號狀態…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snapshot = await getClientSessionSnapshot().catch(() => null);
      if (!snapshot?.accessToken) {
        router.replace(`/auth/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      if (cancelled) return;
      setSession({ token: snapshot.accessToken, email: snapshot.email });
      setMessage("");
    })();
    return () => { cancelled = true; };
  }, [router, nextPath]);

  return { session, message, setMessage };
}

async function authedFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTwd(value?: number | string | null) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function OpsShell({ active, admin, title, eyebrow, heading, body, children, actions }: ShellProps) {
  const links = admin ? adminLinks : accountLinks;
  return (
    <main className={styles.accountDashboard} data-image20-dom-page={admin ? "admin-ops-ui-v104" : "account-ops-ui-v104"}>
      <aside className={styles.accountSidebar}>
        <Image20Logo />
        <nav aria-label={admin ? "營運後台導覽" : "帳號中心導覽"} className={styles.accountSideNav}>
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={href === active ? styles.accountSideActive : undefined}>{label}</Link>
          ))}
        </nav>
        <div className={styles.accountSidebarNote}>
          <b>{admin ? "內部營運入口" : "正式客服與帳務"}</b>
          <span>{admin ? "若權限失敗，請確認 ADMIN_USER_IDS / ADMIN_EMAILS。" : "Google 表單保留，登入後案件則進站內正式紀錄。"}</span>
        </div>
      </aside>

      <section className={styles.accountMain}>
        <header className={styles.accountTopbar}>
          <div><span>{title}</span><b>{admin ? "Admin Console" : "Account Center"}</b></div>
          <div className={styles.accountTopActions}>{actions}</div>
        </header>
        <section className={styles.accountHero}>
          <div className={styles.accountHeroBackdrop} aria-hidden="true" />
          <div className={styles.accountHeroCopy}>
            <span className="i20-kicker">{eyebrow}</span>
            <h1 className="i20-serif">{heading}</h1>
            <p>{body}</p>
          </div>
        </section>
        {children}
      </section>
    </main>
  );
}

export function AccountSupportClientPage() {
  const { session, message, setMessage } = useSessionOrRedirect("/account/support");
  const [tickets, setTickets] = useState<any[]>([]);
  const [form, setForm] = useState({ category: "technical", subject: "", description: "" });

  async function load(token = session?.token || "") {
    if (!token) return;
    const payload = await authedFetch(token, "/api/support/tickets");
    setTickets(payload.tickets || []);
  }

  useEffect(() => { if (session?.token) load(session.token).catch((e) => setMessage(e.message)); }, [session?.token]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token) return;
    setMessage("正在建立客服單…");
    await authedFetch(session.token, "/api/support/tickets", { method: "POST", body: JSON.stringify(form) })
      .then(async () => { setForm({ category: "technical", subject: "", description: "" }); await load(); setMessage("已建立客服單。"); })
      .catch((e) => setMessage(e.message));
  }

  return (
    <OpsShell active="/account/support" title="客服中心" eyebrow="Support Desk" heading="需要協助時，讓問題留下清楚紀錄。" body="付款、退款、房間、檢舉與 Buddies 問題會逐步從外部表單轉入站內客服單。" actions={<><Link href="/contact">公開客服入口</Link><Link href="/account/billing">帳務紀錄</Link></>}>
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">New Ticket</span><h3>建立客服單</h3></div></div>
          <form className={styles.formStack} onSubmit={submit}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {[["technical","技術 / 使用問題"],["room","房間問題"],["payment","付款問題"],["refund","退款協助"],["safety","安全與檢舉"],["buddies","安感夥伴"],["account","帳號問題"],["other","其他"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={form.subject} minLength={4} required placeholder="主旨，例如：付款狀態異常" onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea value={form.description} required rows={7} placeholder="請描述時間、操作路徑、訂單或房間資訊。" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="i20-btn peach" type="submit">送出客服單</button>
          </form>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">History</span><h3>我的客服紀錄</h3></div><button type="button" onClick={() => load().catch((e) => setMessage(e.message))}>重新整理</button></div>
          <div className={styles.accountPreferenceList}>
            {tickets.map((ticket) => <div key={ticket.id}><b>{ticket.subject}</b><span>{ticket.category}｜{ticket.status}｜{ticket.priority}｜{formatDate(ticket.updated_at)}</span></div>)}
            {tickets.length === 0 ? <div><b>目前沒有客服單。</b><span>遇到付款、房間或安全問題時，可建立第一張客服單。</span></div> : null}
          </div>
        </article>
      </section>
    </OpsShell>
  );
}

export function AccountBillingClientPage() {
  const { session, message, setMessage } = useSessionOrRedirect("/account/billing");
  const [payload, setPayload] = useState<any>(null);

  async function load(token = session?.token || "") {
    if (!token) return;
    const data = await authedFetch(token, "/api/account/billing");
    setPayload(data);
  }

  useEffect(() => { if (session?.token) load(session.token).catch((e) => setMessage(e.message)); }, [session?.token]);

  const orders = payload?.payment_orders || [];
  const ledger = payload?.billing_ledger || [];
  const refunds = payload?.refund_requests || [];
  const invoices = payload?.invoice_events || [];

  return (
    <OpsShell active="/account/billing" title="帳務中心" eyebrow="Billing Center" heading="付款、權益與退款紀錄，應該清楚留在同一處。" body="這裡會顯示付款訂單、帳務事件、發票狀態與退款申請。" actions={<><Link href="/pricing">查看方案</Link><Link href="/account/support">客服單</Link></>}>
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Orders</span><h3>付款訂單</h3><b>{orders.length}</b><p>付款建立、成功或失敗紀錄。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Ledger</span><h3>帳務事件</h3><b>{ledger.length}</b><p>付款、權益、退款與人工調整。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Refund</span><h3>退款申請</h3><b>{refunds.length}</b><p>退款需要客服與營運審核。</p></article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Payment Orders</span><h3>付款紀錄</h3></div></div><div className={styles.accountPreferenceList}>{orders.map((o:any)=><div key={o.id || o.merchant_trade_no}><b>{o.item_name || o.plan_code || "付款訂單"}｜{formatTwd(o.amount)}</b><span>{o.status}｜{o.merchant_trade_no}｜{formatDate(o.created_at)}</span></div>)}{orders.length===0?<div><b>目前沒有付款紀錄。</b></div>:null}</div></article>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Ledger / Invoice</span><h3>帳務與發票事件</h3></div></div><div className={styles.accountPreferenceList}>{ledger.slice(0,8).map((x:any)=><div key={x.id}><b>{x.ledger_type}｜{formatTwd(x.amount_twd)}</b><span>{x.direction}｜{x.description || "—"}｜{formatDate(x.occurred_at)}</span></div>)}{invoices.slice(0,4).map((x:any)=><div key={x.id}><b>發票事件｜{x.event_type}</b><span>{x.invoice_number || "尚未開立"}｜{formatDate(x.created_at)}</span></div>)}{ledger.length===0&&invoices.length===0?<div><b>目前沒有帳務事件。</b><span>付款成功後會逐步補入。</span></div>:null}</div></article>
      </section>
    </OpsShell>
  );
}

export function AdminHomeClientPage() {
  const { session, message, setMessage } = useSessionOrRedirect("/admin");
  const [payload, setPayload] = useState<any>(null);

  async function load(token = session?.token || "") {
    if (!token) return;
    const data = await authedFetch(token, "/api/admin/ops/summary");
    setPayload(data);
  }
  useEffect(() => { if (session?.token) load(session.token).catch((e) => setMessage(e.message)); }, [session?.token]);
  const summary = payload?.summary || {};
  return <OpsShell admin active="/admin" title="Admin Ops" eyebrow="Operations" heading="讓客服、安全、退款與房間狀態可以被看見。" body="正式商業平台不能只靠資料庫查詢；營運總覽是客服與風控閉環的第一步。" actions={<><Link href="/admin/support">客服單</Link><Link href="/admin/refunds">退款</Link></>}>
    {message ? <div className={styles.accountLoading}>{message}</div> : null}
    <section className={styles.accountMetricGrid}>{Object.entries(summary).map(([k,v]:any)=><article className={styles.accountMetricCard} key={k}><span className="i20-kicker">{k}</span><h3>{k.replaceAll("_"," ")}</h3><b>{v?.count ?? "—"}</b><p>{v?.error || "目前狀態可讀取。"}</p></article>)}</section>
    <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Reliability</span><h3>近期可靠性事件</h3></div></div><div className={styles.accountPreferenceList}>{(payload?.recent_reliability_events||[]).map((e:any)=><div key={e.id}><b>{e.event_type}｜{e.severity}</b><span>{e.source}｜{e.room_id || "no-room"}｜{e.created_at}</span></div>)}{(payload?.recent_reliability_events||[]).length===0?<div><b>目前沒有近期事件。</b><span>cleanup、檢舉與 Daily 刪除事件會逐步出現在這裡。</span></div>:null}</div></article></section>
  </OpsShell>;
}

function AdminQueuePage({ kind }: { kind: "support" | "safety" | "refunds" }) {
  const path = kind === "support" ? "/admin/support" : kind === "safety" ? "/admin/safety" : "/admin/refunds";
  const api = kind === "support" ? "/api/admin/support/tickets?limit=120" : kind === "safety" ? "/api/admin/safety/reports?limit=120" : "/api/admin/billing/refunds?limit=120";
  const key = kind === "support" ? "tickets" : kind === "safety" ? "reports" : "refunds";
  const title = kind === "support" ? "客服單處理" : kind === "safety" ? "安全檢舉" : "退款審核";
  const { session, message, setMessage } = useSessionOrRedirect(path);
  const [items, setItems] = useState<any[]>([]);

  async function load(token = session?.token || "") { if (!token) return; const data = await authedFetch(token, api); setItems(data[key] || []); }
  useEffect(() => { if (session?.token) load(session.token).catch((e) => setMessage(e.message)); }, [session?.token]);

  async function patchItem(id: string, action: string) {
    if (!session?.token) return;
    const url = kind === "support" ? `/api/admin/support/tickets/${id}` : kind === "safety" ? `/api/admin/safety/reports/${id}` : `/api/admin/billing/refunds/${id}`;
    const body = kind === "support" ? { status: action, admin_note: `quick update: ${action}` } : kind === "safety" ? { status: action, create_case: action === "actioned", admin_note: `quick update: ${action}` } : { status: action, admin_note: `quick update: ${action}` };
    setMessage("正在更新…");
    await authedFetch(session.token, url, { method: "PATCH", body: JSON.stringify(body) }).then(async () => { await load(); setMessage("已更新。"); }).catch((e) => setMessage(e.message));
  }

  return <OpsShell admin active={path} title={title} eyebrow="Admin Queue" heading={`${title}，需要能被查詢、處理與稽核。`} body="這是正式營運的基礎 UI，先讓資料流可操作，再逐步補完整管理後台體驗。" actions={<button type="button" onClick={() => load().catch((e)=>setMessage(e.message))}>重新整理</button>}>
    {message ? <div className={styles.accountLoading}>{message}</div> : null}
    <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Queue</span><h3>{title}</h3></div></div><div className={styles.accountPreferenceList}>{items.map((item:any)=><div key={item.id}><b>{item.subject || item.category || item.reason_category || item.event_type || item.id}</b><span>{item.status}｜{item.priority || item.severity || formatTwd(item.amount_twd)}｜{item.user_id || item.reporter_user_id || "—"}</span><span>{kind === "support" ? <><button onClick={()=>patchItem(item.id,"admin_review")}>審核中</button> <button onClick={()=>patchItem(item.id,"resolved")}>已處理</button> <button onClick={()=>patchItem(item.id,"closed")}>關閉</button></> : kind === "safety" ? <><button onClick={()=>patchItem(item.id,"triaged")}>分流</button> <button onClick={()=>patchItem(item.id,"actioned")}>建立 case</button> <button onClick={()=>patchItem(item.id,"dismissed")}>駁回</button></> : <><button onClick={()=>patchItem(item.id,"reviewing")}>審核中</button> <button onClick={()=>patchItem(item.id,"approved")}>核准</button> <button onClick={()=>patchItem(item.id,"rejected")}>拒絕</button> <button onClick={()=>patchItem(item.id,"refunded")}>已退款</button></>}</span></div>)}{items.length===0?<div><b>目前沒有資料。</b><span>相關案件建立後會出現在這裡。</span></div>:null}</div></article></section>
  </OpsShell>;
}

export function AdminSupportClientPage() { return <AdminQueuePage kind="support" />; }
export function AdminSafetyClientPage() { return <AdminQueuePage kind="safety" />; }
export function AdminRefundsClientPage() { return <AdminQueuePage kind="refunds" />; }
