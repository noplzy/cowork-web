"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type ProfileForm = {
  display_name: string; handle: string; avatar_url: string; bio: string; tags_input: string; visibility: "public" | "members" | "friends";
  accepting_friend_requests: boolean; accepting_schedule_invites: boolean; show_upcoming_schedule: boolean;
  notify_friend_requests: boolean; notify_schedule_updates: boolean; notify_room_reminders: boolean;
};
const emptyForm: ProfileForm = { display_name: "", handle: "", avatar_url: "", bio: "", tags_input: "", visibility: "public", accepting_friend_requests: true, accepting_schedule_invites: true, show_upcoming_schedule: true, notify_friend_requests: true, notify_schedule_updates: true, notify_room_reminders: true };
function tagsToInput(tags: unknown) { return Array.isArray(tags) ? tags.join("、") : ""; }

export default function AccountProfilePage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/profile");
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [auth, setAuth] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取個人檔案…");

  async function load() {
    const payload = await authedFetch("/api/account/profile");
    const profile = payload.profile || {};
    const settings = payload.settings || {};
    setAuth(payload.auth || null);
    setForm({
      display_name: profile.display_name || "", handle: profile.handle || "", avatar_url: profile.avatar_url || "", bio: profile.bio || "", tags_input: tagsToInput(profile.tags), visibility: profile.visibility || "public",
      accepting_friend_requests: profile.accepting_friend_requests !== false, accepting_schedule_invites: profile.accepting_schedule_invites !== false, show_upcoming_schedule: profile.show_upcoming_schedule !== false,
      notify_friend_requests: settings.notify_friend_requests !== false, notify_schedule_updates: settings.notify_schedule_updates !== false, notify_room_reminders: settings.notify_room_reminders !== false,
    });
  }

  useEffect(() => { if (!accessToken) return; load().then(() => setMessage("")).catch((error) => setMessage(error.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessToken]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在儲存個人檔案…");
    try { await authedFetch("/api/account/profile", { method: "PATCH", body: JSON.stringify(form) }); await load(); setMessage("已儲存個人檔案。"); }
    catch (error: any) { setMessage(error?.message || "儲存失敗。"); }
  }

  return (
    <FormalOpsShell activeHref="/account/profile" navItems={accountOpsNav} eyebrow="Profile" title="個人檔案" description="讓房間、好友、排程與安感夥伴使用一致的公開身份；公開範圍與通知邊界也在這裡管理。" quoteTitle={form.display_name || "你的公開名片"} quoteBody={auth?.email ? `登入 Email：${auth.email}` : "可先補齊顯示名稱與個人代號。"} dataPage="account-profile-v114">
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Public Card</span><h3>公開名片</h3></div></div>
          <form className={styles.formStack} onSubmit={save}>
            <label><span className="i20-kicker">顯示名稱</span><input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} required /></label>
            <label><span className="i20-kicker">個人代號</span><input value={form.handle} onChange={(event) => setForm({ ...form, handle: event.target.value })} placeholder="islander-wade" required /></label>
            <label><span className="i20-kicker">頭像 URL</span><input value={form.avatar_url} onChange={(event) => setForm({ ...form, avatar_url: event.target.value })} placeholder="https://..." /></label>
            <label><span className="i20-kicker">簡介</span><textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={5} /></label>
            <label><span className="i20-kicker">標籤</span><input value={form.tags_input} onChange={(event) => setForm({ ...form, tags_input: event.target.value })} placeholder="讀書、家務、夜間專注" /></label>
            <label><span className="i20-kicker">公開範圍</span><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as ProfileForm["visibility"] })}><option value="public">公開可見</option><option value="members">僅會員可見</option><option value="friends">僅好友可見</option></select></label>
            <button className="i20-btn peach" type="submit">儲存個人檔案</button>
          </form>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Boundaries</span><h3>互動與通知邊界</h3></div></div>
          <div className={styles.accountPreferenceList}>{[
            ["accepting_friend_requests", "接受好友邀請"], ["accepting_schedule_invites", "接受排程邀請"], ["show_upcoming_schedule", "公開即將到來排程"], ["notify_friend_requests", "好友邀請通知"], ["notify_schedule_updates", "排程更新通知"], ["notify_room_reminders", "房間提醒通知"],
          ].map(([key, label]) => <div key={key}><b>{label}</b><span>{(form as any)[key] ? "已開啟" : "已關閉"}</span><span><button type="button" onClick={() => setForm({ ...form, [key]: !(form as any)[key] } as ProfileForm)}>{(form as any)[key] ? "關閉" : "開啟"}</button></span></div>)}</div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
