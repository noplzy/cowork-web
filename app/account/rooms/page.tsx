"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FormalOpsShell,
  accountOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function duration(seconds: unknown) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} 小時 ${minutes} 分`;
  return `${minutes} 分鐘`;
}

export default function AccountRoomsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/rooms");
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("正在讀取 Rooms 歷史…");

  async function load() {
    const payload = await authedFetch("/api/account/rooms/history?limit=60");
    setRows(payload.rows || []);
    setMessage("");
  }

  useEffect(() => {
    if (!accessToken) return;
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <FormalOpsShell
      activeHref="/account/rooms"
      navItems={accountOpsNav}
      eyebrow="Rooms History"
      title="我的 Rooms 歷史"
      description="每一場結束後，都能回看實際在場時間、Presence Mode、視覺／音訊使用與異常訊號；不儲存逐字稿、原始影像或完整語音。"
      quoteTitle="可客服、可回查"
      quoteBody="房間不是離開頁面就消失。完成紀錄能協助處理用量、連線、退款與信任問題。"
      topActions={
        <button type="button" onClick={() => load().catch((error) => setMessage(error.message))}>
          重新整理
        </button>
      }
      dataPage="account-rooms-history-v128"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div>
              <span className="i20-kicker">Sessions</span>
              <h3>已完成的房間</h3>
            </div>
          </div>
          <div className={styles.accountPreferenceList}>
            {rows.map((row) => {
              const room = row.room || {};
              const participant = row.participant || {};
              return (
                <div key={participant.room_id}>
                  <b>{room.room_title || "未命名房間"}</b>
                  <span>
                    {formatDateTime(room.actual_ended_at || room.scheduled_end_at)}｜
                    {duration(participant.actual_presence_seconds)}｜
                    {participant.presence_mode || "quiet"}｜
                    {participant.billing_media_class || "unknown"}
                  </span>
                  <span>
                    <Link href={`/account/rooms/${participant.room_id}`}>查看完整紀錄</Link>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && !message ? (
              <div>
                <b>目前沒有可顯示的房後紀錄。</b>
                <span>房間結束並由 summarize cron 產生摘要後，會出現在這裡。</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
