"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminAppealsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/appeals");
  const [appeals, setAppeals] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("正在讀取申訴…");

  async function load(nextStatus = status) {
    const query = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : "";
    const payload = await authedFetch(`/api/admin/appeals${query}`);
    setAppeals(payload.appeals || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setNotice("")).catch((error) => setNotice(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <FormalOpsShell activeHref="/admin/appeals" navItems={adminOpsNav} eyebrow="Appeals Review" title="申訴審查" description="申訴決定必須連回原治理案件、原處置、使用者回覆、恢復動作與 admin audit。" quoteTitle="Permission required" quoteBody="只有具備 appeals.manage 的管理角色可以讀取或更新申訴。" dataPage="admin-appeals-v129">
      {notice ? <div className={styles.accountLoading}>{notice}</div> : null}
      <section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Filters</span><h3>申訴佇列</h3></div><select value={status} onChange={(event) => { const next = event.target.value; setStatus(next); load(next).catch((error) => setNotice(error.message)); }}><option value="">全部</option><option value="open">open</option><option value="reviewing">reviewing</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="closed">closed</option></select></div><div className={styles.accountPreferenceList}>{appeals.map((appeal) => <div key={appeal.id}><b><Link href={`/admin/appeals/${appeal.id}`}>{appeal.reason_code}｜{appeal.status}</Link></b><span>user {appeal.user_id}｜case {appeal.moderation_case_id || "—"}</span><span>{formatDateTime(appeal.updated_at)}</span></div>)}{appeals.length === 0 ? <div><b>目前沒有符合條件的申訴。</b><span>新的申訴會出現在這裡。</span></div> : null}</div></article></section>
    </FormalOpsShell>
  );
}
