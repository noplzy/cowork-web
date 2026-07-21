"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuddyPaymentButton } from "@/components/buddies/BuddyPaymentButton";
import {
  FormalOpsShell,
  accountOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  formatTwd,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import styles from "@/components/image20/Image20Auxiliary.module.css";

function label(value: string) {
  const map: Record<string, string> = {
    pending: "待提供者回覆",
    accepted: "已接受",
    declined: "已婉拒",
    cancelled: "已取消",
    completed: "雙方已完成",
    unpaid: "未付款",
    paid: "款項由平台保管中",
    refunded: "已退款",
    funds_held: "款項保管中",
    service_accepted: "待履約",
    completed_hold: "完成後保留期",
    releasable: "可撥款",
    dispute_hold: "爭議保留",
    refund_pending: "退款處理中",
    payout_processing: "撥款處理中",
    paid_out: "已撥款",
    manual_review: "人工處理",
  };
  return map[value] || value || "—";
}

export default function AccountBuddyBookingsPage() {
  const { accessToken, authedFetch } = useAuthedJson("/account/buddies/bookings");
  const [rows, setRows] = useState([] as any[]);
  const [message, setMessage] = useState("正在讀取 Buddies 預約…");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const payload = await authedFetch("/api/buddies/bookings");
    setRows(payload.bookings || []);
    setMessage("");
  }

  async function openRoom(bookingId: string) {
    setBusyId(bookingId);
    setMessage("正在確認履約時間並建立私人房…");
    try {
      const result = await authedFetch(`/api/buddies/bookings/${bookingId}/room`, { method: "POST" });
      const roomId = result.room?.id || result.booking?.linked_room_id;
      if (!roomId) throw new Error("履約房尚未準備完成。");
      window.location.href = `/rooms/${roomId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立履約房失敗。");
      setBusyId("");
    }
  }

  async function openDispute(bookingId: string) {
    const description = window.prompt("請說明爭議情況（至少 10 個字）。") || "";
    if (description.trim().length < 10) return;
    setBusyId(bookingId);
    setMessage("正在建立爭議並凍結撥款…");
    try {
      await authedFetch(`/api/buddies/bookings/${bookingId}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason_category: "service_issue", description }),
      });
      await load();
      setMessage("爭議已建立，這筆結算已停止撥款並交由客服處理。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立爭議失敗。");
    } finally {
      setBusyId("");
    }
  }

  async function act(bookingId: string, action: "accept" | "decline" | "cancel" | "complete") {
    setBusyId(bookingId);
    setMessage("");
    try {
      await authedFetch(`/api/buddies/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失敗。");
    } finally {
      setBusyId("");
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <FormalOpsShell
      activeHref="/account/buddies/bookings"
      navItems={accountOpsNav}
      eyebrow="Buddies Bookings"
      title="安感夥伴預約與付款"
      description="受控試營運只開放遠端服務。付款會先進入平台內部結算保管，雙方完成後經保留期才可撥款；這不是法律上的第三方價金信託或 escrow。"
      quoteTitle="付款、履約、爭議都可回查"
      quoteBody="提供者不能在未付款時建立履約房；單方按完成也不會立刻撥款。"
      topActions={<button type="button" onClick={() => void load()}>重新整理</button>}
      dataPage="account-buddy-bookings-v131"
    >
      {message ? <div className={styles.accountLoading}>{message}</div> : null}
      <section className={styles.accountContentGrid}>
        <article className={styles.accountContentCard}>
          <div className={styles.accountContentHead}>
            <div><span className="i20-kicker">Bookings</span><h3>我的預約</h3></div>
            <Link href="/buddies">尋找服務</Link>
          </div>
          <div className={styles.accountPreferenceList}>
            {rows.map((row) => {
              const settlement = row.commercial_settlement || {};
              return (
                <div key={row.id} style={{ alignItems: "start" }}>
                  <b>{row.service?.title || "安感夥伴服務"}</b>
                  <span>{formatDateTime(row.scheduled_start_at)} ～ {formatDateTime(row.scheduled_end_at)}</span>
                  <span>{formatTwd(row.total_amount_twd)}｜{label(row.booking_status)}｜{label(row.payment_status)}</span>
                  <span>結算：{label(settlement.status)}</span>
                  {row.linked_room_id ? <Link href={`/rooms/${row.linked_room_id}`}>進入履約房</Link> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {row.viewer_role === "buyer" && row.payment_status === "unpaid" && row.booking_status === "pending" ? (
                      <BuddyPaymentButton bookingId={row.id} disabled={busyId === row.id} />
                    ) : null}
                    {row.viewer_role === "provider" && row.booking_status === "pending" ? (
                      <>
                        <button type="button" onClick={() => void act(row.id, "accept")} disabled={busyId === row.id}>提供者接受</button>
                        <button type="button" onClick={() => void act(row.id, "decline")} disabled={busyId === row.id}>提供者婉拒</button>
                      </>
                    ) : null}
                    {row.booking_status === "accepted" ? (
                      <>
                        <button type="button" onClick={() => void openRoom(row.id)} disabled={busyId === row.id}>建立／進入履約房</button>
                        <button type="button" onClick={() => void act(row.id, "complete")} disabled={busyId === row.id}>確認我已完成</button>
                        <button type="button" onClick={() => void act(row.id, "cancel")} disabled={busyId === row.id}>取消並進入退款流程</button>
                      </>
                    ) : null}
                    {row.payment_status === "paid" && !["refunded", "paid_out"].includes(settlement.status || "") ? (
                      <button type="button" onClick={() => void openDispute(row.id)} disabled={busyId === row.id}>建立爭議／停止撥款</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && !message ? <div><b>目前沒有預約。</b><span>從安感夥伴服務詳情選擇遠端時段後，預約會出現在這裡。</span></div> : null}
          </div>
        </article>
      </section>
    </FormalOpsShell>
  );
}
