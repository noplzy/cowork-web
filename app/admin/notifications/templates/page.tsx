"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, adminOpsNav } from "@/components/formalOps/FormalOpsShell";
import { useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AdminNotificationTemplatesPage() {
  const { accessToken, authedFetch } = useAuthedJson("/admin/notifications/templates");
  const [templates, setTemplates] = useState<any[]>([]);
  const [message, setMessage] = useState("正在讀取通知模板…");
  const [form, setForm] = useState({ template_key: "", category: "system", channel: "in_app", subject_template: "", body_template: "", required_variables: "" });

  async function load() {
    const payload = await authedFetch("/api/admin/notifications/templates");
    setTemplates(payload.templates || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在儲存通知模板…");
    try {
      await authedFetch("/api/admin/notifications/templates", { method: "POST", body: JSON.stringify({ ...form, required_variables: form.required_variables.split(",").map((item) => item.trim()).filter(Boolean) }) });
      setForm({ template_key: "", category: "system", channel: "in_app", subject_template: "", body_template: "", required_variables: "" });
      await load();
      setMessage("已儲存通知模板。");
    } catch (error: any) {
      setMessage(error?.message || "儲存失敗。");
    }
  }

  async function toggleTemplate(template: any) {
    setMessage("正在更新模板狀態…");
    try {
      await authedFetch(`/api/admin/notifications/templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !template.enabled }) });
      await load();
      setMessage("已更新模板。");
    } catch (error: any) {
      setMessage(error?.message || "更新失敗。");
    }
  }

  return <FormalOpsShell activeHref="/admin/notifications" navItems={adminOpsNav} eyebrow="Notification Templates" title="通知模板" description="將客服、帳務、安全、房間與 AI 通知模板化，避免每個 route 硬寫不同文案。" quoteTitle="Template-first" quoteBody="下一步可接 Email / SMS / LINE provider adapter。" dataPage="admin-notification-templates-v112">{message ? <div className={styles.accountLoading}>{message}</div> : null}<section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Create</span><h3>建立 / 覆蓋模板</h3></div></div><form className={styles.formStack} onSubmit={saveTemplate}><label><span className="i20-kicker">Template Key</span><input value={form.template_key} onChange={(event) => setForm({ ...form, template_key: event.target.value })} required /></label><label><span className="i20-kicker">Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="support">support</option><option value="billing">billing</option><option value="safety">safety</option><option value="room">room</option><option value="ai">ai</option><option value="system">system</option><option value="marketing">marketing</option></select></label><label><span className="i20-kicker">Channel</span><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option value="in_app">in_app</option><option value="email">email</option><option value="sms">sms</option><option value="line">line</option><option value="telegram">telegram</option><option value="webhook">webhook</option></select></label><label><span className="i20-kicker">Subject Template</span><input value={form.subject_template} onChange={(event) => setForm({ ...form, subject_template: event.target.value })} /></label><label><span className="i20-kicker">Body Template</span><textarea value={form.body_template} onChange={(event) => setForm({ ...form, body_template: event.target.value })} rows={6} required /></label><label><span className="i20-kicker">Required Variables</span><input value={form.required_variables} onChange={(event) => setForm({ ...form, required_variables: event.target.value })} placeholder="subject,status,balance" /></label><button className="i20-btn peach" type="submit">儲存模板</button></form></article><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Templates</span><h3>模板列表</h3></div><button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button></div><div className={styles.accountPreferenceList}>{templates.map((template) => <div key={template.id}><b>{template.template_key}｜{template.channel}｜{template.enabled ? "enabled" : "disabled"}</b><span>{template.category}｜{template.subject_template || "no subject"}</span><span>{template.body_template}</span><span><button type="button" onClick={() => toggleTemplate(template)}>{template.enabled ? "停用" : "啟用"}</button></span></div>)}</div></article></section></FormalOpsShell>;
}
