"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const toggles = [
  ["in_app_enabled", "站內通知"],
  ["email_enabled", "Email 通知"],
  ["sms_enabled", "SMS 通知"],
  ["line_enabled", "LINE 通知"],
  ["telegram_enabled", "Telegram 通知"],
  ["support_updates", "客服更新"],
  ["billing_updates", "帳務 / 退款 / 訂閱"],
  ["safety_updates", "安全與治理"],
  ["room_updates", "房間提醒"],
  ["marketing_updates", "行銷 / 活動資訊"],
] as const;

export default function AccountNotificationPreferencesPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/notification-preferences");
  const [preferences, setPreferences] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState("正在讀取通知偏好…");

  async function load() {
    const payload = await authedFetch("/api/account/notification-preferences");
    setPreferences(payload.preferences || {});
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function save(next: Record<string, any>) {
    setPreferences(next);
    setMessage("正在儲存通知偏好…");
    try {
      const payload = await authedFetch("/api/account/notification-preferences", { method: "PATCH", body: JSON.stringify(next) });
      setPreferences(payload.preferences || next);
      setMessage("已儲存通知偏好。");
    } catch (error: any) {
      setMessage(error?.message || "儲存失敗。");
    }
  }

  return (
    <FormalOpsShell activeHref="/account/notification-preferences" navItems={accountOpsNav} eyebrow="Notification Preferences" title="通知偏好" description="你可以選擇要接收哪些類型的通知。重要客服、帳務與安全訊息仍建議保留。" quoteTitle="低干擾" quoteBody="安感島會避免不必要的打擾，但重要狀態要可追蹤。" dataPage="account-notification-preferences-v112">
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Channels / Categories</span><h3>通知開關</h3></div></div>
          <div className={styles.accountPreferenceList}>
            {toggles.map(([key, label]) => (
              <div key={key}><b>{label}</b><span>{preferences?.[key] ? "已開啟" : "已關閉"}</span><span><button type="button" onClick={() => preferences && save({ ...preferences, [key]: !preferences[key] })}>{preferences?.[key] ? "關閉" : "開啟"}</button></span></div>
            ))}
          </div>
        </article>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}><div><span className="i20-kicker">Quiet Hours</span><h3>安靜時段</h3></div></div>
          <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); if (preferences) save(preferences); }}>
            <label><span className="i20-kicker">啟用安靜時段</span><select value={preferences?.quiet_hours_enabled ? "1" : "0"} onChange={(event) => preferences && setPreferences({ ...preferences, quiet_hours_enabled: event.target.value === "1" })}><option value="0">關閉</option><option value="1">開啟</option></select></label>
            <label><span className="i20-kicker">開始</span><input value={preferences?.quiet_hours_start || ""} placeholder="23:00" onChange={(event) => preferences && setPreferences({ ...preferences, quiet_hours_start: event.target.value })} /></label>
            <label><span className="i20-kicker">結束</span><input value={preferences?.quiet_hours_end || ""} placeholder="08:00" onChange={(event) => preferences && setPreferences({ ...preferences, quiet_hours_end: event.target.value })} /></label>
            <button className="i20-btn peach" type="submit">儲存安靜時段</button>
          </form>
        </article>
      </section>
    </FormalOpsShell>
  );
}
