"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BuddyPaymentButton } from "@/components/buddies/BuddyPaymentButton";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  bookingStatusLabel,
  formatHoursLabel,
  formatTwd,
  labelForBuddyCategory,
  labelForBuddyDeliveryMode,
  labelForBuddyInteractionStyle,
  slotStatusLabel,
  type BuddyBookingFeedItem,
  type BuddyReviewFeedItem,
  type BuddyServiceDetail,
  type BuddyServiceSlotRow,
} from "@/lib/buddies";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import { labelForVisibility } from "@/lib/socialProfile";

type CommercialBooking = BuddyBookingFeedItem & {
  viewer_role?: "buyer" | "provider";
  commercial_settlement?: { status?: string | null } | null;
  room_provision_status?: string | null;
};

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(token?: string): HeadersInit {
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function toLocalDateTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hoursBetween(start: string, end: string) {
  return Math.max(
    1,
    Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000,
    ),
  );
}

function nextHourLocalValue() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
}

function paymentLabel(value?: string | null) {
  if (value === "paid") return "款項由平台內部結算保管中";
  if (value === "refunded") return "已退款";
  return "尚未付款";
}

function settlementLabel(value?: string | null) {
  const labels: Record<string, string> = {
    funds_held: "款項保管中",
    service_accepted: "等待履約",
    completed_hold: "完成後保留期",
    releasable: "可撥款",
    dispute_hold: "爭議保留",
    refund_pending: "退款處理中",
    refunded: "已退款",
    payout_processing: "撥款處理中",
    paid_out: "已撥款",
    manual_review: "人工處理",
  };
  return value ? labels[value] || value : "尚未建立結算";
}

export default function BuddyServiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ serviceId: string }>();
  const serviceId = params?.serviceId;
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [service, setService] = useState<BuddyServiceDetail | null>(null);
  const [slotStartInput, setSlotStartInput] = useState(nextHourLocalValue());
  const [slotHours, setSlotHours] = useState<number>(1);
  const [slotNote, setSlotNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [myBookings, setMyBookings] = useState<CommercialBooking[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  async function loadAll(token = accessToken) {
    if (!serviceId) return;
    setLoading(true);
    try {
      const [serviceResp, bookingsResp] = await Promise.all([
        fetch(`/api/buddies/services/${serviceId}`, {
          headers: authHeaders(token),
          cache: "no-store",
        }),
        token
          ? fetch("/api/buddies/bookings", {
              headers: authHeaders(token),
              cache: "no-store",
            })
          : Promise.resolve(null),
      ]);
      const serviceJson = await serviceResp.json().catch(() => ({}));
      if (!serviceResp.ok) {
        throw new Error(serviceJson?.error || "讀取服務詳情失敗。");
      }
      setService(serviceJson?.service ?? null);
      if (bookingsResp) {
        const bookingsJson = await bookingsResp.json().catch(() => ({}));
        if (bookingsResp.ok) {
          setMyBookings(
            ((bookingsJson?.bookings ?? []) as CommercialBooking[]).filter(
              (item) => item.service_id === serviceId,
            ),
          );
        }
      }
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "讀取服務詳情失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      setResolved(true);
      setEmail(session?.email ?? "");
      setUserId(session?.user.id ?? "");
      setAccessToken(session?.accessToken ?? "");
      await loadAll(session?.accessToken ?? "");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const isOwner = Boolean(service && service.provider_user_id === userId);
  const selectedSlot = useMemo(
    () => service?.upcoming_slots.find((item) => item.id === selectedSlotId) ?? null,
    [service, selectedSlotId],
  );
  const completedBookingForReview = useMemo(
    () =>
      myBookings.find(
        (item) =>
          item.booking_status === "completed" &&
          (item.buyer_user_id === userId || item.provider_user_id === userId),
      ),
    [myBookings, userId],
  );

  async function createSlot() {
    if (!serviceId) return;
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch(`/api/buddies/services/${serviceId}/slots`, {
        method: "POST",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify({
          starts_at: new Date(slotStartInput).toISOString(),
          hours: slotHours,
          note: slotNote,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "建立可預約時段失敗。");
      setMsg("已新增受控試營運時段。");
      setSlotNote("");
      await loadAll(accessToken);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "建立時段失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlot(slotId: string) {
    if (!serviceId) return;
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch(
        `/api/buddies/services/${serviceId}/slots?slotId=${encodeURIComponent(slotId)}`,
        { method: "DELETE", headers: authHeaders(accessToken) },
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "刪除時段失敗。");
      await loadAll(accessToken);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "刪除時段失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function createBooking() {
    if (!serviceId || !selectedSlotId) return;
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch("/api/buddies/bookings", {
        method: "POST",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify({
          service_id: serviceId,
          slot_id: selectedSlotId,
          buyer_note: bookingNote,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "建立預約失敗。");
      router.push(json?.next_url || "/account/buddies/bookings");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "建立預約失敗。");
      setBusy(false);
    }
  }

  async function actBooking(
    bookingId: string,
    action: "accept" | "decline" | "cancel" | "complete",
  ) {
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch(`/api/buddies/bookings/${bookingId}`, {
        method: "PATCH",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify({ action }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "更新預約狀態失敗。");
      if (action === "accept") {
        setMsg("已接受預約；履約房會在開始前 15 分鐘內由任一方建立。");
      } else if (action === "complete") {
        setMsg("已記錄你的完成確認；雙方都確認後才進入撥款保留期。");
      } else if (action === "cancel") {
        setMsg("已取消並進入退款處理；服務開始後請改走爭議流程。");
      } else {
        setMsg("已婉拒預約並進入退款處理。");
      }
      await loadAll(accessToken);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "更新預約狀態失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function openRoom(bookingId: string) {
    setBusy(true);
    setMsg("正在確認履約時間並準備私人房…");
    try {
      const resp = await fetch(`/api/buddies/bookings/${bookingId}/room`, {
        method: "POST",
        headers: jsonHeaders(accessToken),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "履約房尚未準備完成。");
      const roomId = json?.room?.id || json?.booking?.linked_room_id;
      if (!roomId) throw new Error("沒有取得履約房 ID。");
      window.location.href = `/rooms/${roomId}`;
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "建立履約房失敗。");
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!serviceId || !completedBookingForReview) return;
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch(`/api/buddies/services/${serviceId}/reviews`, {
        method: "POST",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify({
          booking_id: completedBookingForReview.id,
          rating,
          comment: reviewComment,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "寫入評價失敗。");
      setReviewComment("");
      await loadAll(accessToken);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "寫入評價失敗。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cc-container" data-p3-build={P3_BUILD_TAGS.buddiesCommercial}>
      <TopNav email={email} />
      <section className="cc-section">
        <div className="cc-action-row">
          <button type="button" className="cc-btn" onClick={() => router.push("/buddies")}>
            ← 回安感夥伴
          </button>
          <Link className="cc-btn" href="/account/buddies/bookings">
            我的預約與付款
          </Link>
          <span className="cc-pill-soft">Build {P3_BUILD_TAGS.buddiesCommercial}</span>
        </div>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      {loading ? (
        <section className="cc-section cc-card cc-empty-state">正在讀取服務詳情…</section>
      ) : !service ? (
        <section className="cc-section cc-card cc-empty-state">找不到這個服務。</section>
      ) : (
        <>
          <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
            <article className="cc-card cc-stack-md">
              <div className="cc-card-row">
                <div><span className="cc-kicker">Service Detail</span><h1 className="cc-h2">{service.title}</h1></div>
                <span className="cc-pill-accent">{formatTwd(service.price_per_hour_twd)} / 小時</span>
              </div>
              <div className="cc-action-row" style={{ flexWrap: "wrap", marginTop: 0 }}>
                <span className="cc-pill-soft">{labelForBuddyCategory(service.buddy_category)}</span>
                <span className="cc-pill-soft">{labelForBuddyDeliveryMode(service.delivery_mode)}</span>
                <span className="cc-pill-soft">{labelForBuddyInteractionStyle(service.interaction_style)}</span>
                <span className="cc-pill-soft">{labelForVisibility(service.visibility)}</span>
                {service.provider_profile?.is_professional_buddy ? <span className="cc-pill-success">已完成專業搭子審核</span> : null}
              </div>
              <p className="cc-lead" style={{ margin: 0 }}>{service.summary}</p>
              {service.description ? <div className="cc-muted" style={{ lineHeight: 1.85 }}>{service.description}</div> : null}
              <div className="cc-note cc-stack-sm">
                <div><strong>提供者：</strong>{service.provider_profile?.display_name ?? "安感島使用者"}</div>
                <div><strong>可預約時段：</strong>{service.open_slots_count} 個</div>
                <div><strong>已完成：</strong>{service.completed_bookings} 次</div>
                <div><strong>評價：</strong>{service.average_rating ? `${service.average_rating} / 5（${service.review_count} 則）` : "尚無評價"}</div>
                <div><strong>試營運邊界：</strong>只開放遠端 1～2 小時；先付款、提供者接受後履約。</div>
              </div>
              <div className="cc-action-row" style={{ flexWrap: "wrap" }}>
                {service.tag_list.map((tag) => <span key={tag} className="cc-pill-soft">{tag}</span>)}
              </div>
              {service.provider_profile?.handle ? <Link href={`/u/${service.provider_profile.handle}`} className="cc-btn-link">查看公開檔案 →</Link> : null}
            </article>

            <article className="cc-card cc-stack-md">
              <div><p className="cc-card-kicker">{isOwner ? "管理可預約時段" : "選擇可預約時段"}</p><h2 className="cc-h2">{isOwner ? "試營運時段最多 2 小時。" : "先建立預約，再到帳戶完成付款。"}</h2></div>
              {isOwner ? (
                <>
                  <div className="cc-grid-2">
                    <label className="cc-field"><span className="cc-field-label">開始時間</span><input className="cc-input" type="datetime-local" value={slotStartInput} onChange={(event) => setSlotStartInput(event.target.value)} /></label>
                    <label className="cc-field"><span className="cc-field-label">時數</span><select className="cc-select" value={slotHours} onChange={(event) => setSlotHours(Number(event.target.value))}>{[1, 2].map((hours) => <option key={hours} value={hours}>{formatHoursLabel(hours)}</option>)}</select></label>
                  </div>
                  <label className="cc-field"><span className="cc-field-label">備註</span><input className="cc-input" value={slotNote} onChange={(event) => setSlotNote(event.target.value)} placeholder="例如：這段適合初次聊聊與需求確認。" /></label>
                  <button type="button" className="cc-btn-primary" onClick={() => void createSlot()} disabled={busy}>新增可預約時段</button>
                </>
              ) : (
                <>
                  <div className="cc-stack-sm">
                    {service.upcoming_slots.length === 0 ? <div className="cc-note">這個服務目前還沒有公開可預約時段。</div> : service.upcoming_slots.map((slot) => (
                      <button key={slot.id} type="button" className={selectedSlotId === slot.id ? "cc-btn-primary" : "cc-btn"} onClick={() => setSelectedSlotId(slot.id)} style={{ justifyContent: "space-between" }}>
                        <span>{toLocalDateTime(slot.starts_at)} ～ {toLocalDateTime(slot.ends_at)}</span><span>{slotStatusLabel(slot.slot_status)}</span>
                      </button>
                    ))}
                  </div>
                  {selectedSlot ? <div className="cc-note">本次共 {formatHoursLabel(hoursBetween(selectedSlot.starts_at, selectedSlot.ends_at))}，預估 {formatTwd(service.price_per_hour_twd * hoursBetween(selectedSlot.starts_at, selectedSlot.ends_at))}。</div> : null}
                  <label className="cc-field"><span className="cc-field-label">留言給提供者</span><textarea className="cc-textarea" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="例如：我想先從 1 小時試試看。" /></label>
                  <button type="button" className="cc-btn-primary" onClick={() => void createBooking()} disabled={busy || !selectedSlotId || !resolved}>建立預約並前往付款</button>
                </>
              )}
              <div className="cc-stack-sm">{service.upcoming_slots.map((slot: BuddyServiceSlotRow) => <div key={slot.id} className="cc-note cc-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}><div>{toLocalDateTime(slot.starts_at)} ～ {toLocalDateTime(slot.ends_at)}</div>{isOwner ? <button type="button" className="cc-btn" disabled={busy} onClick={() => void deleteSlot(slot.id)}>刪除</button> : null}</div>)}</div>
            </article>
          </section>

          <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
            <article className="cc-card cc-stack-md">
              <div><p className="cc-card-kicker">這個服務的預約</p><h2 className="cc-h2">付款、接受、履約與雙方完成確認。</h2></div>
              {myBookings.length === 0 ? <div className="cc-note">你和這個服務目前還沒有相關預約。</div> : <div className="cc-stack-sm">{myBookings.map((booking) => (
                <div key={booking.id} className="cc-card cc-card-soft cc-stack-sm">
                  <div className="cc-h3">{bookingStatusLabel(booking.booking_status)} · {formatTwd(booking.total_amount_twd)}</div>
                  <div className="cc-muted">{toLocalDateTime(booking.scheduled_start_at)} ～ {toLocalDateTime(booking.scheduled_end_at)}</div>
                  <div className="cc-caption">付款：{paymentLabel(booking.payment_status)}｜結算：{settlementLabel(booking.commercial_settlement?.status)}</div>
                  <div className="cc-action-row" style={{ flexWrap: "wrap" }}>
                    {booking.buyer_user_id === userId && booking.booking_status === "pending" && booking.payment_status === "unpaid" ? <BuddyPaymentButton bookingId={booking.id} disabled={busy} /> : null}
                    {isOwner && booking.booking_status === "pending" ? <><button type="button" className="cc-btn-primary" disabled={busy || booking.payment_status !== "paid"} onClick={() => void actBooking(booking.id, "accept")}>接受已付款預約</button><button type="button" className="cc-btn" disabled={busy} onClick={() => void actBooking(booking.id, "decline")}>婉拒並退款</button></> : null}
                    {booking.booking_status === "accepted" ? <><button type="button" className="cc-btn-primary" disabled={busy} onClick={() => void openRoom(booking.id)}>建立／進入履約房</button><button type="button" className="cc-btn" disabled={busy} onClick={() => void actBooking(booking.id, "complete")}>確認我已完成</button><button type="button" className="cc-btn" disabled={busy} onClick={() => void actBooking(booking.id, "cancel")}>開始前取消</button></> : null}
                    {booking.linked_room_id ? <Link href={`/rooms/${booking.linked_room_id}`} className="cc-btn-link">前往履約房 →</Link> : null}
                  </div>
                </div>
              ))}</div>}
            </article>

            <article className="cc-card cc-stack-md">
              <div><p className="cc-card-kicker">評價</p><h2 className="cc-h2">雙方完成預約後，才能寫入評價。</h2></div>
              {completedBookingForReview ? <><label className="cc-field"><span className="cc-field-label">評分</span><select className="cc-select" value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} 星</option>)}</select></label><label className="cc-field"><span className="cc-field-label">評論</span><textarea className="cc-textarea" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /></label><button type="button" className="cc-btn-primary" onClick={() => void submitReview()} disabled={busy}>送出評價</button></> : <div className="cc-note">目前沒有可寫評價的已完成預約。</div>}
              <div className="cc-stack-sm">{service.recent_reviews.length === 0 ? <div className="cc-note">尚無公開評價。</div> : service.recent_reviews.map((review: BuddyReviewFeedItem) => <div key={review.id} className="cc-card cc-card-soft cc-stack-sm"><div className="cc-row" style={{ justifyContent: "space-between" }}><div className="cc-h3">{review.reviewer_profile?.display_name ?? "安感島使用者"}</div><span className="cc-pill-soft">{review.rating} / 5</span></div>{review.comment ? <div className="cc-muted">{review.comment}</div> : null}<div className="cc-caption">{toLocalDateTime(review.created_at)}</div></div>)}</div>
            </article>
          </section>
        </>
      )}
      <SiteFooter />
    </main>
  );
}
