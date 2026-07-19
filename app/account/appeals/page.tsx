"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const reasonLabels: Record<string, string> = {
  mistaken_identity: "對象辨識有誤",
  missing_context: "缺少重要脈絡",
  incorrect_facts: "事實內容不正確",
  disproportionate_action: "處置比例不合理",
  resolved_issue: "問題已經排除",
  other: "其他",
};

export default function AccountAppealsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/appeals");
  const [appeals, setAppeals] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [notice, setNotice] = useState("正在讀取申訴與治理紀錄…");
  const [form, setForm] = useState({
    moderation_action_id: "",
    moderation_case_id: "",
    reason_code: "missing_context",
    message: "",
    requested_outcome: "",
  });

  async function load() {
    const [appealPayload, moderationPayload] = await Promise.all([
      authedFetch("/api/appeals?limit=100"),
      authedFetch("/api/account/moderation/actions"),
    ]);
    setAppeals(appealPayload.appeals || []);
    setActions(moderationPayload.actions || []);
    setCases(moderationPayload.cases || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setNotice("")).catch((error) => setNotice(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const selectedAction = useMemo(
    () => actions.find((item) => item.id === form.moderation_action_id),
    [actions, form.moderation_action_id],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("正在送出申訴…");
    try {
      const actionId = form.moderation_action_id || null;
      const caseId = actionId ? selectedAction?.case_id || null : form.moderation_case_id || null;
      await authedFetch("/api/appeals", {
        method: "POST",
        body: JSON.stringify({
          moderation_action_id: actionId,
          moderation_case_id: caseId,
          reason_code: form.reason_code,
          message: form.message,
          requested_outcome: form.requested_outcome || null,
          idempotency_key: `account:${actionId || caseId}:${form.reason_code}`,
        }),
      });
      setForm({ moderation_action_id: "", moderation_case_id: "", reason_code: "missing_context", message: "", requested_outcome: "" });
      await load();
      setNotice("申訴已送出。若同一處置已有進行中的申訴，系統會回傳原申訴而不重複建立。");
    } catch (error: any) {
      setNotice(error?.message || "送出申訴失敗。");
    }
  }

  return (
    <FormalOpsShell
      activeHref="/account/appeals"
      navItems={accountOpsNav}
      eyebrow="Appeals"
      title="申訴與處置回查"
      description="申訴不是寄出一封信就結束。每一次補充、審查、決定與恢復動作都應留下可回查紀錄。"
      quoteTitle="一個處置，一個進行中申訴"
      quoteBody="重複提交不會製造多張案件；接受申訴時，管理端可建立獨立 restore 處置。"
      dataPage="account-appeals-v129"
    >
      {notice ? <div className={styles.accountLoading}>{notice}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">New Appeal</span><h3>提出申訴</h3></div></div>
          <form className={styles.formStack} onSubmit={submit}>
            <label><span className="i20-kicker">關聯處置</span><select value={form.moderation_action_id} onChange={(event) => setForm({ ...form, moderation_action_id: event.target.value, moderation_case_id: "" })}><option value="">不指定處置，改選治理案件</option>{actions.map((item) => <option key={item.id} value={item.id}>{item.action_type}｜{formatDateTime(item.created_at)}</option>)}</select></label>
            {!form.moderation_action_id ? <label><span className="i20-kicker">關聯案件</span><select value={form.moderation_case_id} onChange={(event) => setForm({ ...form, moderation_case_id: event.target.value })}><option value="">請選擇治理案件</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.severity}｜{item.status}｜{item.summary || item.id}</option>)}</select></label> : null}
            <label><span className="i20-kicker">原因</span><select value={form.reason_code} onChange={(event) => setForm({ ...form, reason_code: event.target.value })}>{Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="i20-kicker">申訴內容</span><textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={7} minLength={10} required /></label>
            <label><span className="i20-kicker">希望的處理結果</span><textarea value={form.requested_outcome} onChange={(event) => setForm({ ...form, requested_outcome: event.target.value })} rows={3} /></label>
            <button className="i20-btn peach" type="submit" disabled={!form.message.trim() || (!form.moderation_action_id && !form.moderation_case_id)}>送出申訴</button>
          </form>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">History</span><h3>我的申訴</h3></div><button type="button" onClick={() => load().catch((error) => setNotice(error.message))}>重新整理</button></div>
          <div className={styles.accountPreferenceList}>{appeals.map((appeal) => <div key={appeal.id}><b><Link href={`/account/appeals/${appeal.id}`}>{reasonLabels[appeal.reason_code] || appeal.reason_code}｜{appeal.status}</Link></b><span>{appeal.requested_outcome || "未填期望結果"}</span><span>{formatDateTime(appeal.updated_at)}</span></div>)}{appeals.length === 0 ? <div><b>目前沒有申訴。</b><span>只有與你本人相關的治理案件或處置可以提出申訴。</span></div> : null}</div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
