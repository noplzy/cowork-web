"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  FormalOpsShell,
  accountOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function secondsLabel(value: unknown) {
  const seconds = Math.max(0, Number(value || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

export default function AccountRoomDetailPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId || "";
  const { accessToken, authedFetch } = useAuthedJson(
    `/account/rooms/${roomId}`,
  );
  const [payload, setPayload] = useState<any>(null);
  const [message, setMessage] = useState("正在讀取房間紀錄…");

  useEffect(() => {
    if (!accessToken || !roomId) return;
    authedFetch(`/api/account/rooms/history/${encodeURIComponent(roomId)}`)
      .then((data) => {
        setPayload(data);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
    // `authedFetch` is recreated by useAuthedJson; depending on it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, roomId]);

  const room = payload?.room || {};
  const summary = payload?.summary || {};
  const participant = payload?.participant || {};
  const accessSessions = payload?.access_sessions || [];
  const reliability = payload?.reliability_events || [];

  return (
    <FormalOpsShell
      activeHref="/account/rooms"
      navItems={accountOpsNav}
      eyebrow="Room Record"
      title={room.title || summary.room_title || "房間紀錄"}
      description="這是你的個人房後紀錄，只顯示與你有關的 Presence、access session 與 reliability 訊號。"
      quoteTitle="Privacy by default"
      quoteBody="不儲存逐字稿、原始影像或完整語音；只保留營運、成本與客服所需的狀態資料。"
      topActions={<Link href="/account/rooms">返回 Rooms 歷史</Link>}
      dataPage="account-room-detail-v128"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}

      {payload ? (
        <>
          <section className={styles.accountContentGrid}>
            <article className={styles.accountContentCard}>
              <div className={styles.accountContentHead}>
                <div>
                  <span className="i20-kicker">Summary</span>
                  <h3>本場摘要</h3>
                </div>
              </div>
              <div className={styles.accountPreferenceList}>
                <div><b>結束時間</b><span>{formatDateTime(summary.actual_ended_at || room.ended_at || room.scheduled_end_at)}</span></div>
                <div><b>結束原因</b><span>{summary.end_reason || room.cleanup_reason || room.status || "—"}</span></div>
                <div><b>我的實際在場</b><span>{secondsLabel(participant.actual_presence_seconds)}</span></div>
                <div><b>Presence Mode</b><span>{participant.presence_mode || "quiet"}</span></div>
                <div><b>媒體計費分類</b><span>{participant.billing_media_class || "unknown"}</span></div>
                <div><b>視覺／音訊秒數</b><span>{secondsLabel(participant.visual_seconds)}／{secondsLabel(participant.audio_only_seconds)}</span></div>
                <div><b>BRB／Hidden／延長確認</b><span>{participant.brb_count || 0}／{participant.hidden_count || 0}／{participant.extension_confirm_count || 0}</span></div>
              </div>
            </article>

            <article className={styles.accountContentCard}>
              <div className={styles.accountContentHead}>
                <div>
                  <span className="i20-kicker">Access</span>
                  <h3>入場與用量紀錄</h3>
                </div>
              </div>
              <div className={styles.accountPreferenceList}>
                {accessSessions.map((session: any) => (
                  <div key={session.id}>
                    <b>{session.entitlement_source || "unknown"}｜{session.charge_status || "—"}</b>
                    <span>{secondsLabel(session.connected_seconds)}｜視覺 {secondsLabel(session.visual_seconds)}｜音訊 {secondsLabel(session.audio_only_seconds)}</span>
                    <span>{session.usage_status || "pending"}｜{session.reconciliation_source || "尚未對帳"}</span>
                  </div>
                ))}
                {accessSessions.length === 0 ? <div><b>沒有 access session。</b><span>可能是舊房間或尚未完成 P0 migration。</span></div> : null}
              </div>
            </article>
          </section>

          <section className={styles.accountContentGrid}>
            <article className={styles.accountContentCard}>
              <div className={styles.accountContentHead}>
                <div>
                  <span className="i20-kicker">Reliability</span>
                  <h3>連線與信任訊號</h3>
                </div>
              </div>
              <div className={styles.accountPreferenceList}>
                {reliability.map((event: any) => (
                  <div key={event.id}>
                    <b>{event.event_type}</b>
                    <span>{event.severity}｜{event.source}｜{formatDateTime(event.created_at)}</span>
                  </div>
                ))}
                {reliability.length === 0 ? <div><b>沒有異常訊號。</b><span>這不代表監考，只表示目前沒有需要客服回查的事件。</span></div> : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </FormalOpsShell>
  );
}
