"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  BUDDIES_BUILD_TAG,
  bookingStatusLabel,
  emptyBuddyServiceInput,
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
import { labelForVisibility } from "@/lib/socialProfile";

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function jsonHeaders(token?: string): HeadersInit {
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}
function toLocalDateTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" });
}
function hoursBetween(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (60 * 60 * 1000)));
}
function nextHourLocalValue() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
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
  const [myBookings, setMyBookings] = useState<BuddyBookingFeedItem[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  async function loadAll(token = accessToken) {
    if (!serviceId) return;
    setLoading(true);
    try {
      const [serviceResp, bookingsResp] = await Promise.all([
        fetch(`/api/buddies/services/${serviceId}`, { headers: authHeaders(token), cache: "no-store" }),
        token ? fetch("/api/buddies/bookings", { headers: authHeaders(token), cache: "no-store" }) : Promise.resolve(null),
      ]);
      const serviceJson = await serviceResp.json().catch(() => ({} as any));
      if (!serviceResp.ok) throw new Error(serviceJson?.error || "讀取服務詳情失敗。");
      setService(serviceJson?.service ?? null);

      if (bookingsResp) {
        const bookingsJson = await bookingsResp.json().catch(() => ({} as any));
        if (bookingsResp.ok) {
          const related = ((bookingsJson?.bookings ?? []) as BuddyBookingFeedItem[]).filter((item) => item.service_id === serviceId);
          setMyBookings(related);
        }
      }
    } catch (error: any) {
      setMsg(error?.message || "讀取服務詳情失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      setResolved(true);
      setEmail(session?.email ?? "");
      setUserId(session?.user.id ?? "");
      setAccessToken(session?.accessToken ?? "");
      await loadAll(session?.accessToken ?? "");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const isOwner = Boolean(service && service.provider_user_id === userId);
  const selectedSlot = useMemo(() => service?.upcoming_slots.find((item) => item.id === selectedSlotId) ?? null, [service, selectedSlotId]);
  const completedBookingForReview = useMemo(
    () => myBookings.find((item) => item.booking_status === "completed" && (item.buyer_user_id === userId || item.provider_user_id === userId)),
    [myBookings, userId],
  );

  async function createSlot() {
    if (!serviceId) return;
    setBusy(true);
    setMsg("");
    const resp = await fetch(`/api/buddies/services/${serviceId}/slots`, {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ starts_at: new Date(slotStartInput).toISOString(), hours: slotHours, note: slotNote }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) {
      setMsg(json?.error || "建立可預約時段失敗。");
      return;
    }
    setMsg("已新增可預約時段。");
    setSlotNote("");
    await loadAll(accessToken);
  }

  async function deleteSlot(slotId: string) {
    if (!serviceId) return;
    setBusy(true);
    setMsg("");
    const resp = await fetch(`/api/buddies/services/${serviceId}/slots?slotId=${encodeURIComponent(slotId)}`, {
      method: "DELETE",
      headers: authHeaders(accessToken),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) {
      setMsg(json?.error || "刪除可預約時段失敗。");
      return;
    }
    setMsg("已刪除可預約時段。");
    await loadAll(accessToken);
  }

  async function createBooking() {
    if (!serviceId || !selectedSlotId) return;
    setBusy(true);
    setMsg("");
    const resp = await fetch("/api/buddies/bookings", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ service_id: serviceId, slot_id: selectedSlotId, buyer_note: bookingNote }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) {
      setMsg(json?.error || "建立預約失敗。");
      return;
    }
    setMsg("已送出預約，等待提供者回覆。");
    setBookingNote("");
    setSelectedSlotId("");
    await loadAll(accessToken);
  }

  async function actBooking(bookingId: string, action: "accept" | "decline" | "cancel" | "complete") {
    setBusy(true);
    setMsg("");
    const resp = await fetch(`/api/buddies/bookings/${bookingId}`, {
      method: "PATCH",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ action }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) {
      setMsg(json?.error || "更新預約狀態失敗。");
      return;
    }
    if (action === "accept") setMsg("已接受預約，履約房已自動建立。");
    else if (action === "complete") setMsg("已標記完成。");
    else if (action === "cancel") setMsg("已取消預約。");
    else setMsg("已婉拒預約。");
    await loadAll(accessToken);
  }

  async function submitReview() {
    if (!serviceId || !completedBookingForReview) return;
    setBusy(true);
    setMsg("");
    const resp = await fetch(`/api/buddies/services/${serviceId}/reviews`, {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ booking_id: completedBookingForReview.id, rating, comment: reviewComment }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) {
      setMsg(json?.error || "寫入評價失敗。");
      return;
    }
    setMsg("已寫入評價。");
    setReviewComment("");
    await loadAll(accessToken);
  }

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section">
        <div className="cc-action-row">
          <button type="button" className="cc-btn" onClick={() => router.push("/buddies")}>← 回安感夥伴</button>
          <span className="cc-pill-soft">Build {BUDDIES_BUILD_TAG}</span>
        </div>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      {loading ? (
        <section className="cc-section cc-card cc-empty-state"><div className="cc-stack-sm"><div className="cc-h3">正在讀取服務詳情…</div></div></section>
      ) : !service ? (
        <section className="cc-section cc-card cc-empty-state"><div className="cc-stack-sm"><div className="cc-h3">找不到這個服務。</div></div></section>
      ) : (
        <>
          <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
            <article className="cc-card cc-stack-md">
              <div className="cc-card-row">
                <div>
                  <span className="cc-kicker">Service Detail</span>
                  <h1 className="cc-h2">{service.title}</h1>
                </div>
                <span className="cc-pill-accent">{formatTwd(service.price_per_hour_twd)} / 小時</span>
              </div>

              <div className="cc-action-row" style={{ flexWrap: "wrap", marginTop: 0 }}>
                <span className="cc-pill-soft">{labelForBuddyCategory(service.buddy_category)}</span>
                <span className="cc-pill-soft">{labelForBuddyDeliveryMode(service.delivery_mode)}</span>
                <span className="cc-pill-soft">{labelForBuddyInteractionStyle(service.interaction_style)}</span>
                <span className="cc-pill-soft">{labelForVisibility(service.visibility)}</span>
                {service.provider_profile?.is_professional_buddy ? <span className="cc-pill-success">專業搭子候選</span> : null}
              </div>

              <p className="cc-lead" style={{ margin: 0 }}>{service.summary}</p>
              {service.description ? <div className="cc-muted" style={{ lineHeight: 1.85 }}>{service.description}</div> : null}

              <div className="cc-note cc-stack-sm">
                <div><strong>提供者：</strong>{service.provider_profile?.display_name ?? "安感島使用者"}</div>
                <div><strong>可預約時段：</strong>{service.open_slots_count} 個</div>
                <div><strong>已完成：</strong>{service.completed_bookings} 次</div>
                <div><strong>評價：</strong>{service.average_rating ? `${service.average_rating} / 5（${service.review_count} 則）` : "尚無評價"}</div>
                {service.availability_note ? <div><strong>補充：</strong>{service.availability_note}</div> : null}
              </div>

              <div className="cc-action-row" style={{ flexWrap: "wrap" }}>
                {service.tag_list.map((tag) => <span key={tag} className="cc-pill-soft">{tag}</span>)}
              </div>

              {service.provider_profile?.handle ? (
                <Link href={`/u/${service.provider_profile.handle}`} className="cc-btn-link">查看公開檔案 →</Link>
              ) : null}
            </article>

            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">{isOwner ? "管理可預約時段" : "選擇可預約時段"}</p>
                <h2 className="cc-h2">{isOwner ? "真正的可預約模型，要有獨立時段。" : "先選 slot，再送出預約。"}</h2>
              </div>

              {isOwner ? (
                <>
                  <div className="cc-grid-2">
                    <label className="cc-field"><span className="cc-field-label">開始時間</span><input className="cc-input" type="datetime-local" value={slotStartInput} onChange={(e) => setSlotStartInput(e.target.value)} /></label>
                    <label className="cc-field"><span className="cc-field-label">時數</span><select className="cc-select" value={slotHours} onChange={(e) => setSlotHours(Number(e.target.value))}>{[1,2,3,4].map((n) => <option key={n} value={n}>{formatHoursLabel(n)}</option>)}</select></label>
                  </div>
                  <label className="cc-field"><span className="cc-field-label">備註</span><input className="cc-input" value={slotNote} onChange={(e) => setSlotNote(e.target.value)} placeholder="例如：這段適合初次聊聊與需求確認。" /></label>
                  <button type="button" className="cc-btn-primary" onClick={createSlot} disabled={busy}>新增可預約時段</button>
                </>
              ) : (
                <>
                  <div className="cc-stack-sm">
                    {service.upcoming_slots.length === 0 ? (
                      <div className="cc-note">這個服務目前還沒有公開可預約時段。</div>
                    ) : (
                      service.upcoming_slots.map((slot) => (
                        <button key={slot.id} type="button" className={selectedSlotId === slot.id ? "cc-btn-primary" : "cc-btn"} onClick={() => setSelectedSlotId(slot.id)} style={{ justifyContent: "space-between" }}>
                          <span>{toLocalDateTime(slot.starts_at)} ～ {toLocalDateTime(slot.ends_at)}</span>
                          <span>{slotStatusLabel(slot.slot_status)}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <label className="cc-field"><span className="cc-field-label">留言給提供者</span><textarea className="cc-textarea" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} placeholder="例如：我想先從 1 小時試試看。" /></label>
                  <button type="button" className="cc-btn-primary" onClick={createBooking} disabled={busy || !selectedSlotId || !resolved}>送出預約</button>
                </>
              )}

              <div className="cc-stack-sm">
                {service.upcoming_slots.map((slot) => (
                  <div key={slot.id} className="cc-note cc-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div>{toLocalDateTime(slot.starts_at)} ～ {toLocalDateTime(slot.ends_at)}（{formatHoursLabel(hoursBetween(slot.starts_at, slot.ends_at))}）</div>
                    {isOwner ? <button type="button" className="cc-btn" disabled={busy} onClick={() => deleteSlot(slot.id)}>刪除</button> : null}
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">這個服務的預約</p>
                <h2 className="cc-h2">accepted 後自動串 Rooms 履約房</h2>
              </div>
              {myBookings.length === 0 ? (
                <div className="cc-note">你和這個服務目前還沒有相關預約。</div>
              ) : (
                <div className="cc-stack-sm">
                  {myBookings.map((booking) => (
                    <div key={booking.id} className="cc-card cc-card-soft cc-stack-sm">
                      <div className="cc-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div className="cc-stack-sm">
                          <div className="cc-h3">{bookingStatusLabel(booking.booking_status)} · {formatTwd(booking.total_amount_twd)}</div>
                          <div className="cc-muted">{toLocalDateTime(booking.scheduled_start_at)} ～ {toLocalDateTime(booking.scheduled_end_at)}</div>
                          <div className="cc-caption">付款：{booking.payment_status}</div>
                          {booking.linked_room_id ? <Link href={`/rooms/${booking.linked_room_id}`} className="cc-btn-link">前往履約房 →</Link> : null}
                        </div>

                        <div className="cc-action-row">
                          {isOwner && booking.booking_status === "pending" ? (
                            <>
                              <button type="button" className="cc-btn-primary" disabled={busy} onClick={() => actBooking(booking.id, "accept")}>接受</button>
                              <button type="button" className="cc-btn" disabled={busy} onClick={() => actBooking(booking.id, "decline")}>婉拒</button>
                            </>
                          ) : null}
                          {(booking.buyer_user_id === userId || booking.provider_user_id === userId) && booking.booking_status === "accepted" ? (
                            <>
                              <button type="button" className="cc-btn" disabled={busy} onClick={() => actBooking(booking.id, "complete")}>完成</button>
                              <button type="button" className="cc-btn" disabled={busy} onClick={() => actBooking(booking.id, "cancel")}>取消</button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">評價</p>
                <h2 className="cc-h2">已完成預約後，才能寫入評價。</h2>
              </div>

              {completedBookingForReview ? (
                <>
                  <div className="cc-grid-2">
                    <label className="cc-field"><span className="cc-field-label">評分</span><select className="cc-select" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} 星</option>)}</select></label>
                  </div>
                  <label className="cc-field"><span className="cc-field-label">評論</span><textarea className="cc-textarea" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="說明這次體驗是否準時、互動是否符合描述。" /></label>
                  <button type="button" className="cc-btn-primary" onClick={submitReview} disabled={busy}>送出評價</button>
                </>
              ) : (
                <div className="cc-note">目前沒有可寫評價的已完成預約。</div>
              )}

              <div className="cc-stack-sm">
                {service.recent_reviews.length === 0 ? (
                  <div className="cc-note">尚無公開評價。</div>
                ) : (
                  service.recent_reviews.map((review) => (
                    <div key={review.id} className="cc-card cc-card-soft cc-stack-sm">
                      <div className="cc-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div className="cc-h3">{review.reviewer_profile?.display_name ?? "安感島使用者"}</div>
                        <span className="cc-pill-soft">{review.rating} / 5</span>
                      </div>
                      {review.comment ? <div className="cc-muted" style={{ lineHeight: 1.8 }}>{review.comment}</div> : null}
                      <div className="cc-caption">{toLocalDateTime(review.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
