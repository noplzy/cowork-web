"use client";

import { useEffect, useState } from "react";
import { FormalOpsShell, accountOpsNav } from "@/components/formalOps/FormalOpsShell";
import { formatDateTime, useAuthedJson } from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function AccountNotificationsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/notifications");
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("正在讀取通知…");

  async function load() {
    const payload = await authedFetch("/api/account/notifications");
    setItems(payload.notifications || []);
  }

  useEffect(() => {
    if (!accessToken) return;
    load().then(() => setMessage("")).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function updateOne(id: string, action: "read" | "dismiss") {
    setMessage("正在更新通知…");
    try {
      await authedFetch(`/api/account/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await load();
      setMessage("已更新通知。");
    } catch (error: any) {
      setMessage(error?.message || "更新通知失敗。");
    }
  }

  async function markAllRead() {
    setMessage("正在全部標記已讀…");
    try {
      await authedFetch("/api/account/notifications", { method: "PATCH", body: JSON.stringify({ action: "mark_all_read" }) });
      await load();
      setMessage("已全部標記已讀。");
    } catch (error: any) {
      setMessage(error?.message || "更新通知失敗。");
    }
  }

  return <FormalOpsShell activeHref="/account/notifications" navItems={accountOpsNav} eyebrow="Notifications" title="通知中心" description="客服回覆、退款狀態、訂閱與重要營運訊息會集中在這裡，避免只靠 email 或人工記憶。" quoteTitle={`${items.filter((item) => !item.read_at).length} unread`} quoteBody="通知中心目前以站內通知為主，外部 Email / SMS 需 provider adapter 啟用。" topActions={<button type="button" onClick={markAllRead}>全部標記已讀</button>} dataPage="account-notifications-v111">{message ? <div className={styles.accountLoading}>{message}</div> : null}<section className={styles.accountContentGrid}><article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Inbox</span><h3>我的通知</h3></div><button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>重新整理</button></div><div className={styles.accountPreferenceList}>{items.map((item) => <div key={item.id}><b>{item.subject || item.template_key}｜{item.read_at ? "已讀" : "未讀"}</b><span>{item.body}</span><span>{item.channel}｜{item.status}｜{formatDateTime(item.created_at)}</span><span><button type="button" onClick={() => updateOne(item.id, "read")}>已讀</button> <button type="button" onClick={() => updateOne(item.id, "dismiss")}>隱藏</button></span></div>)}{items.length === 0 ? <div><b>目前沒有通知。</b><span>客服回覆或帳務更新後會出現在這裡。</span></div> : null}</div></article></section></FormalOpsShell>;
}
