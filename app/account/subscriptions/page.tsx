"use client";
import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, formatTwd, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";
import type { InvoiceCarrierKind, InvoiceKind, InvoicePreference } from "@/lib/invoicePreferences";

type InvoiceFormState = {
  kind: InvoiceKind;
  buyerEmail: string;
  businessIdentifier: string;
  businessName: string;
  carrierKind: InvoiceCarrierKind;
  carrierNumber: string;
  loveCode: string;
};

const defaultInvoice: InvoiceFormState = {
  kind: "personal",
  buyerEmail: "",
  businessIdentifier: "",
  businessName: "",
  carrierKind: "ecpay",
  carrierNumber: "",
  loveCode: "",
};

function buildInvoicePreference(state: InvoiceFormState): InvoicePreference {
  return {
    kind: state.kind,
    buyerEmail: state.buyerEmail,
    businessIdentifier: state.kind === "business" ? state.businessIdentifier : undefined,
    businessName: state.kind === "business" ? state.businessName : undefined,
    carrierKind: state.kind === "donation" ? "none" : state.carrierKind,
    carrierNumber: ["mobile_barcode", "citizen_certificate"].includes(state.carrierKind) ? state.carrierNumber : undefined,
    loveCode: state.kind === "donation" ? state.loveCode : undefined,
    source: "account_subscriptions_v119",
  };
}

export default function Page() {
  const { accessToken, authedFetch } = useAuthedJson("/account/subscriptions");
  const [subs, setSubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [msg, setMsg] = useState("正在讀取訂閱資料…");
  const [invoice, setInvoice] = useState<InvoiceFormState>(defaultInvoice);

  async function load() {
    const p = await authedFetch("/api/account/subscriptions");
    setSubs(p.subscriptions || []);
    setEvents(p.events || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMsg("")).catch((e) => setMsg(e.message));
  }, [accessToken]);

  function update<K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) {
    setInvoice((current) => ({ ...current, [key]: value }));
  }

  async function start(planCode: string) {
    setMsg("正在建立自動扣款授權…");
    try {
      const invoicePreference = buildInvoicePreference(invoice);
      const p = await authedFetch("/api/payments/ecpay/recurring/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode, invoicePreference }),
      });
      const f = document.createElement("form");
      f.method = p.method || "POST";
      f.action = p.action;
      f.style.display = "none";
      Object.entries(p.fields || {}).forEach(([n, v]) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = n;
        i.value = String(v);
        f.appendChild(i);
      });
      document.body.appendChild(f);
      f.submit();
    } catch (e: any) {
      setMsg(e?.message || "建立自動扣款失敗。");
    }
  }

  async function cancel(id: string) {
    const reason = window.prompt("請簡短填寫取消原因：", "暫停使用");
    if (reason === null) return;
    setMsg("正在送出取消訂閱申請…");
    try {
      await authedFetch(`/api/account/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel", reason }) });
      await load();
      setMsg("已送出取消訂閱申請。若 provider API 尚未啟用，營運端會進入 manual_required。");
    } catch (e: any) {
      setMsg(e?.message || "取消訂閱失敗。");
    }
  }

  return (
    <FormalOpsShell activeHref="/account/subscriptions" navItems={accountOpsNav} eyebrow="Subscriptions" title="訂閱管理" description="正式自動扣款需要同時支援授權、續扣、取消、退款與發票；這裡顯示你的訂閱狀態與取消申請。" quoteTitle="安全優先" quoteBody="自動扣款未完全開通前，不會宣稱正式訂閱已上線。" dataPage="account-subscriptions-v119-invoice-preference">
      {msg ? <div className={styles.accountLoading}>{msg}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Invoice</span><h3>訂閱發票資料</h3></div></div>
          <div className={styles.accountPreferenceList}>
            <div><b>發票類型</b><span><select value={invoice.kind} onChange={(e) => update("kind", e.target.value as InvoiceKind)}><option value="personal">個人電子發票</option><option value="business">公司 / 統編發票</option><option value="donation">捐贈發票</option></select></span></div>
            <div><b>通知 Email</b><span><input value={invoice.buyerEmail} onChange={(e) => update("buyerEmail", e.target.value)} placeholder="預設使用帳號 Email" /></span></div>
            {invoice.kind !== "donation" ? <div><b>載具</b><span><select value={invoice.carrierKind} onChange={(e) => update("carrierKind", e.target.value as InvoiceCarrierKind)}><option value="ecpay">綠界電子發票載具 / Email 通知</option><option value="mobile_barcode">手機條碼載具</option><option value="citizen_certificate">自然人憑證載具</option><option value="none">不使用載具</option></select></span></div> : null}
            {invoice.kind === "business" ? <><div><b>統一編號</b><span><input value={invoice.businessIdentifier} onChange={(e) => update("businessIdentifier", e.target.value)} placeholder="8 碼統編" /></span></div><div><b>公司抬頭</b><span><input value={invoice.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="公司名稱" /></span></div></> : null}
            {invoice.kind !== "donation" && ["mobile_barcode", "citizen_certificate"].includes(invoice.carrierKind) ? <div><b>載具號碼</b><span><input value={invoice.carrierNumber} onChange={(e) => update("carrierNumber", e.target.value.toUpperCase())} placeholder={invoice.carrierKind === "mobile_barcode" ? "/ABC1234" : "AB12345678901234"} /></span></div> : null}
            {invoice.kind === "donation" ? <div><b>愛心碼</b><span><input value={invoice.loveCode} onChange={(e) => update("loveCode", e.target.value)} placeholder="3 到 7 碼數字" /></span></div> : null}
          </div>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Start</span><h3>建立自動扣款授權</h3></div></div>
          <div className={styles.accountPreferenceList}>
            <div><b>安心同行｜NT$299 / 月</b><span>需 Vercel 開啟 ECPAY_RECURRING_ENABLED，且綠界定期定額服務已開通。</span><span><button type="button" onClick={() => start("companion_basic_299")}>建立授權</button></span></div>
            <div><b>常駐同行｜NT$599 / 月</b><span>需進階房間工具、帳務紀錄與客服處理流程完成後再正式開放。</span><span><button type="button" onClick={() => start("companion_regular_599")}>建立授權</button></span></div>
          </div>
        </article>
      </section>
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Profiles</span><h3>我的訂閱</h3></div><button type="button" onClick={() => load().catch((e) => setMsg(e.message))}>重新整理</button></div><div className={styles.accountPreferenceList}>{subs.map((s) => <div key={s.id}><b>{s.plan_code}｜{formatTwd(s.period_amount)}</b><span>{s.status}｜下次扣款 {formatDateTime(s.next_charge_at)}｜本期至 {formatDateTime(s.current_period_end)}</span>{["active", "past_due", "pending"].includes(String(s.status)) ? <span><button type="button" onClick={() => cancel(s.id)}>取消訂閱</button></span> : null}</div>)}{subs.length === 0 ? <div><b>目前沒有訂閱。</b><span>一次性 VIP 付款不會出現在訂閱列表。</span></div> : null}</div></article>
      </section>
      <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Events</span><h3>訂閱事件</h3></div></div><div className={styles.accountPreferenceList}>{events.map((e) => <div key={e.id}><b>{e.event_type}</b><span>{e.merchant_trade_no || "—"}｜{formatDateTime(e.created_at)}</span></div>)}</div></article></section>
    </FormalOpsShell>
  );
}
