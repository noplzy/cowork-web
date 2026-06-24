"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type TabKey = "identity" | "applications" | "disputes";

function statusBadge(value: string) {
  if (["approved", "resolved"].includes(value)) return "完成";
  if (["rejected", "cancelled"].includes(value)) return "結束";
  if (["needs_more_info", "reviewing"].includes(value)) return "處理中";
  return "待處理";
}

export default function AdminTrustPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/trust");
  const [tab, setTab] = useState<TabKey>("identity");
  const [identity, setIdentity] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [message, setMessage] = useState("正在讀取信任審核中心…");

  async function load() {
    const [identityPayload, applicationsPayload, disputesPayload] = await Promise.all([
      authedFetch("/api/admin/trust/identity?status=pending,needs_more_info&limit=160"),
      authedFetch("/api/admin/trust/buddies/applications?status=submitted,needs_more_info&limit=160"),
      authedFetch("/api/admin/trust/buddies/disputes?status=open,reviewing&limit=160"),
    ]);
    setIdentity(identityPayload.requests || []);
    setApplications(applicationsPayload.applications || []);
    setDisputes(disputesPayload.disputes || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const totals = useMemo(() => ({ identity: identity.length, applications: applications.length, disputes: disputes.length }), [identity, applications, disputes]);

  async function reviewIdentity(id: string, action: string) {
    const reviewer_note = action === "approve" ? window.prompt("核准備註，可空白：") || "" : window.prompt("請填寫退回 / 拒絕 / 取消原因：");
    if (reviewer_note === null) return;
    setMessage("正在更新身份審核…");
    try {
      await authedFetch(`/api/admin/trust/identity/${id}`, { method: "PATCH", body: JSON.stringify({ action, reviewer_note }) });
      await load();
      setMessage("已更新身份審核。");
    } catch (error: any) {
      setMessage(error?.message || "更新身份審核失敗。");
    }
  }

  async function reviewApplication(id: string, action: string) {
    const reviewer_note = action === "approve" ? window.prompt("核准備註，可空白：") || "" : window.prompt("請填寫退回 / 拒絕 / 停權原因：");
    if (reviewer_note === null) return;
    setMessage("正在更新安感夥伴申請…");
    try {
      await authedFetch(`/api/admin/trust/buddies/applications/${id}`, { method: "PATCH", body: JSON.stringify({ action, reviewer_note }) });
      await load();
      setMessage("已更新安感夥伴申請。");
    } catch (error: any) {
      setMessage(error?.message || "更新安感夥伴申請失敗。");
    }
  }

  async function reviewDispute(id: string, action: string) {
    const admin_note = action === "review" ? window.prompt("進入審核備註，可空白：") || "" : window.prompt("請填寫爭議處理說明：");
    if (admin_note === null) return;
    setMessage("正在更新 Buddies 爭議…");
    try {
      await authedFetch(`/api/admin/trust/buddies/disputes/${id}`, { method: "PATCH", body: JSON.stringify({ action, admin_note }) });
      await load();
      setMessage("已更新 Buddies 爭議。");
    } catch (error: any) {
      setMessage(error?.message || "更新 Buddies 爭議失敗。");
    }
  }

  return (
    <FormalOpsShell
      activeHref="/admin/trust"
      navItems={adminOpsNav}
      eyebrow="Trust Review"
      title="信任審核中心"
      description="Buddies、身份綁定與陪伴交易不能只靠前台表單；需要管理員審核、原因紀錄、狀態回寫與 audit log。"
      quoteTitle={`${totals.identity + totals.applications + totals.disputes} items`}
      quoteBody="本頁只處理信任與治理審核，不處理金流 payout。"
      topActions={<><Link href="/admin/action-center">營運工作台</Link><Link href="/admin/roles">權限管理</Link><button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button></>}
      dataPage="admin-trust-review-v116"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountMetricGrid}>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Identity</span><h3>身分審核</h3><b>{totals.identity}</b><p>人工審核申請，通過後會回寫 manual_review binding。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Buddies</span><h3>夥伴申請</h3><b>{totals.applications}</b><p>核准前必須已有通過的身份審核。</p></article>
        <article className={styles.accountMetricCard}><span className="i20-kicker">Disputes</span><h3>爭議案件</h3><b>{totals.disputes}</b><p>建立處理紀錄並同步 buddy booking 狀態。</p></article>
      </section>

      <section className={styles.accountContentCard}>
        <div className={styles.accountContentHead}>
          <div><span className="i20-kicker">Queues</span><h3>審核隊列</h3></div>
          <div className={styles.accountTopActions}>
            <button type="button" onClick={() => setTab("identity")}>身分</button>
            <button type="button" onClick={() => setTab("applications")}>夥伴申請</button>
            <button type="button" onClick={() => setTab("disputes")}>爭議</button>
          </div>
        </div>

        {tab === "identity" ? <div className={styles.accountPreferenceList}>{identity.map((item) => <div key={item.id}><b>{statusBadge(item.review_status)}｜{item.review_status}｜{item.legal_name || item.user_id}</b><span>{item.request_type}｜出生年 {item.birth_year || "—"}｜證件 {item.document_type || "—"} ***{item.document_last4 || "—"}｜{formatDateTime(item.created_at)}</span><span>{item.user_note || "無補充說明"}</span><span><Link href={`/admin/users/${item.user_id}`}>使用者 360</Link> <button type="button" onClick={() => reviewIdentity(item.id, "approve")}>核准</button> <button type="button" onClick={() => reviewIdentity(item.id, "needs_more_info")}>補件</button> <button type="button" onClick={() => reviewIdentity(item.id, "reject")}>拒絕</button></span></div>)}{!identity.length ? <div><b>目前沒有待處理身份審核。</b><span>—</span></div> : null}</div> : null}

        {tab === "applications" ? <div className={styles.accountPreferenceList}>{applications.map((item) => <div key={item.id}><b>{statusBadge(item.application_status)}｜{item.application_status}｜{item.display_title || item.user_id}</b><span>user {item.user_id}｜identity {item.identity_request_id || "no-request"}｜{formatDateTime(item.created_at)}</span><span>{item.experience_summary || "無經驗摘要"}</span><span>{item.service_boundaries || "無服務邊界"}</span><span><Link href={`/admin/users/${item.user_id}`}>使用者 360</Link> <button type="button" onClick={() => reviewApplication(item.id, "approve")}>核准</button> <button type="button" onClick={() => reviewApplication(item.id, "needs_more_info")}>補件</button> <button type="button" onClick={() => reviewApplication(item.id, "reject")}>拒絕</button> <button type="button" onClick={() => reviewApplication(item.id, "suspend")}>停權</button></span></div>)}{!applications.length ? <div><b>目前沒有待處理夥伴申請。</b><span>—</span></div> : null}</div> : null}

        {tab === "disputes" ? <div className={styles.accountPreferenceList}>{disputes.map((item) => <div key={item.id}><b>{statusBadge(item.dispute_status)}｜{item.dispute_status}｜{item.reason_category}</b><span>booking {item.booking_id || "—"}｜opened_by {item.opened_by_user_id || "—"}｜{formatDateTime(item.created_at)}</span><span>{item.description}</span><span>{item.booking_id ? <Link href={`/admin/users/${item.opened_by_user_id}`}>開案者 360</Link> : null} <button type="button" onClick={() => reviewDispute(item.id, "review")}>進入審核</button> <button type="button" onClick={() => reviewDispute(item.id, "resolve")}>結案</button> <button type="button" onClick={() => reviewDispute(item.id, "reject")}>駁回</button> <button type="button" onClick={() => reviewDispute(item.id, "cancel")}>取消</button></span></div>)}{!disputes.length ? <div><b>目前沒有待處理爭議。</b><span>—</span></div> : null}</div> : null}
      </section>
    </FormalOpsShell>
  );
}
