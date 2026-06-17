"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";

type Tab = "market" | "services" | "slots" | "bookings" | "provider";
type Service = { id: string; title: string; summary: string; price_per_hour_twd: number; buddy_category: string; delivery_mode: string; status?: string; open_slots_count?: number; provider_profile?: { display_name?: string | null; is_professional_buddy?: boolean | null } | null };
type Slot = { id: string; service_id: string; starts_at: string; ends_at: string; slot_status: string; note?: string | null };
type Booking = { id: string; service_id: string; slot_id: string | null; buyer_user_id: string; provider_user_id: string; booking_status: string; payment_status: string; scheduled_start_at: string; scheduled_end_at: string; total_amount_twd: number; linked_room_id?: string | null; linked_room_invite_code?: string | null; service?: { title?: string; summary?: string } | null };

const serviceDefaults = { title: "", summary: "", description: "", buddy_category: "focus", interaction_style: "guided", delivery_mode: "remote", visibility: "public", tag_list_input: "", price_per_hour_twd: 300, accepts_new_users: true, accepts_last_minute: false, availability_note: "", status: "draft" };

function formatDateTime(value?: string | null) { if (!value) return "—"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "—"; return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); }
function localValue(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function nextHourValue() { const date = new Date(); date.setMinutes(0, 0, 0); date.setHours(date.getHours() + 1); return localValue(date); }
function addHoursLocal(value: string, hours: number) { const date = new Date(value); date.setHours(date.getHours() + hours); return localValue(date); }

export default function BuddiesPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<Tab>("market");
  const [services, setServices] = useState<Service[]>([]);
  const [myServices, setMyServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedServiceSlots, setSelectedServiceSlots] = useState<Slot[]>([]);
  const [buyerNote, setBuyerNote] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [serviceForm, setServiceForm] = useState(serviceDefaults);
  const [slotForm, setSlotForm] = useState({ service_id: "", starts_at: nextHourValue(), ends_at: addHoursLocal(nextHourValue(), 1), note: "" });
  const [providerForm, setProviderForm] = useState({ display_title: "", experience_summary: "", service_boundaries: "" });

  const authHeaders = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  useEffect(() => { let cancelled = false; (async () => { const session = await getClientSessionSnapshot().catch(() => null); if (cancelled) return; setEmail(session?.email ?? ""); setToken(session?.accessToken ?? ""); setUserId(session?.user?.id ?? ""); })(); return () => { cancelled = true; }; }, []);
  useEffect(() => { loadAll().catch((error) => setMsg(error.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function readJson(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));
    const res = await fetch(path, { ...init, headers, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
    return body;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const marketplace = await readJson("/api/buddies/services");
      setServices(marketplace.services || []);
      if (token) {
        const [mine, bookingPayload, slotPayload, applicationPayload] = await Promise.all([
          readJson("/api/buddies/services?mine=1"),
          readJson("/api/buddies/bookings"),
          readJson("/api/buddies/slots?mine=1"),
          readJson("/api/buddies/provider/application").catch(() => ({ applications: [] })),
        ]);
        setMyServices(mine.services || []);
        setBookings(bookingPayload.bookings || []);
        setSlots(slotPayload.slots || []);
        const app = applicationPayload.applications?.[0];
        if (app) setProviderForm({ display_title: app.display_title || "", experience_summary: app.experience_summary || "", service_boundaries: app.service_boundaries || "" });
      }
      setMsg("");
    } finally { setLoading(false); }
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return setMsg("請先登入後再管理服務。"); setMsg("正在儲存服務…");
    try { await readJson("/api/buddies/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(serviceForm) }); setServiceForm(serviceDefaults); await loadAll(); setTab("services"); setMsg("已儲存服務。若要公開出現在市場，服務狀態需為上架中。"); } catch (error: any) { setMsg(error.message || "儲存服務失敗。"); }
  }

  async function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return setMsg("請先登入後再管理時段。"); setMsg("正在建立時段…");
    try { await readJson("/api/buddies/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slotForm) }); setSlotForm({ service_id: slotForm.service_id, starts_at: nextHourValue(), ends_at: addHoursLocal(nextHourValue(), 1), note: "" }); await loadAll(); setMsg("已建立可預約時段。"); } catch (error: any) { setMsg(error.message || "建立時段失敗。"); }
  }

  async function loadSlotsForService(serviceId: string) {
    setSelectedServiceId(serviceId); setMsg("正在讀取可預約時段…");
    try { const payload = await readJson(`/api/buddies/slots?service_id=${encodeURIComponent(serviceId)}`); setSelectedServiceSlots(payload.slots || []); setMsg((payload.slots || []).length ? "請選擇一個時段送出預約。" : "這個服務目前沒有開放時段。"); } catch (error: any) { setMsg(error.message || "讀取時段失敗。"); }
  }

  async function bookSlot(slotId: string) {
    if (!token) return setMsg("請先登入後再預約。"); setMsg("正在送出預約…");
    try { await readJson("/api/buddies/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_id: selectedServiceId, slot_id: slotId, buyer_note: buyerNote }) }); setBuyerNote(""); setSelectedServiceSlots([]); await loadAll(); setTab("bookings"); setMsg("已送出預約，等待對方回覆。金流審核期間不會進入正式付款。"); } catch (error: any) { setMsg(error.message || "送出預約失敗。"); }
  }

  async function updateBooking(bookingId: string, action: "accept" | "decline" | "cancel" | "complete") {
    setMsg("正在更新預約…");
    try { await readJson(`/api/buddies/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); await loadAll(); setMsg("已更新預約。"); } catch (error: any) { setMsg(error.message || "更新預約失敗。"); }
  }

  async function openDispute(bookingId: string) {
    const description = window.prompt("請簡短說明爭議原因："); if (!description) return; setMsg("正在建立爭議案件…");
    try { await readJson(`/api/buddies/bookings/${bookingId}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason_category: "other", description }) }); await loadAll(); setMsg("已建立爭議案件，後續會進入營運審核。"); } catch (error: any) { setMsg(error.message || "建立爭議失敗。"); }
  }

  async function submitProviderApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return setMsg("請先登入後再申請成為安感夥伴。"); setMsg("正在送出安感夥伴申請…");
    try { await readJson("/api/buddies/provider/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...providerForm, submit: true }) }); await loadAll(); setMsg("已送出安感夥伴申請。"); } catch (error: any) { setMsg(error.message || "送出申請失敗。"); }
  }

  return (
    <Image20SidebarShell title="安感夥伴" email={email} lead="把陪伴做成有邊界、可預約、可審核的服務。金流審核期間，Buddies 先完成服務、時段、預約、履約房、評價與爭議流程。">
      <div className="i20-page" data-image20-dom-page="buddies-v114-operations">
        <section className="i20-panel dark" style={{ backgroundImage: "linear-gradient(90deg,rgba(7,21,29,.95),rgba(7,21,29,.55)),url(/site-assets/image20/hero/brand-hero-evening-shared-presence.png)", backgroundSize: "cover", backgroundPosition: "center", minHeight: 250 }}>
          <span className="i20-kicker">Buddies</span><h2 className="i20-serif" style={{ fontSize: 44 }}>找安感夥伴，或開始提供陪伴服務。</h2><p>Buddies 不是交友牆，而是把陪伴服務整理成可以被理解、預約與審核的入口。</p>
          <div className="i20-actions-row">{(["market", "services", "slots", "bookings", "provider"] as Tab[]).map((item) => <button key={item} className={`i20-btn ${tab === item ? "peach" : "ghost"}`} onClick={() => setTab(item)}>{item === "market" ? "找夥伴" : item === "services" ? "我的服務" : item === "slots" ? "時段" : item === "bookings" ? "預約" : "夥伴申請"}</button>)}</div>
        </section>
        {msg ? <div className="i20-panel" style={{ marginTop: 18 }}>{msg}</div> : null}

        {tab === "market" ? <><section className="i20-grid four" style={{ marginTop: 18 }}>{loading ? <div className="i20-card">讀取中…</div> : services.length ? services.map((service) => <article className="i20-card" key={service.id}><div className="i20-avatar">{service.provider_profile?.display_name?.[0] || "島"}</div><span className="i20-kicker">{service.provider_profile?.is_professional_buddy ? "Verified Buddy" : "Buddy Service"}</span><h3>{service.title}</h3><p>{service.summary}</p><div className="i20-chip-row"><span className="i20-chip">NT${service.price_per_hour_twd}/hr</span><span className="i20-chip">{service.buddy_category}</span><span className="i20-chip">{service.delivery_mode}</span><span className="i20-chip">{service.open_slots_count || 0} 時段</span></div><button className="i20-btn light" onClick={() => loadSlotsForService(service.id)}>查看可預約時段</button></article>) : <div className="i20-card">目前沒有上架服務。</div>}</section>{selectedServiceSlots.length ? <section className="i20-panel" style={{ marginTop: 18 }}><span className="i20-kicker">Book</span><h3>選擇時段</h3><textarea className="i20-textarea" value={buyerNote} onChange={(event) => setBuyerNote(event.target.value)} placeholder="想先讓對方知道的需求或界線。" /><div className="i20-grid four" style={{ marginTop: 14 }}>{selectedServiceSlots.map((slot) => <article className="i20-card" key={slot.id}><b>{formatDateTime(slot.starts_at)} ～ {formatDateTime(slot.ends_at)}</b><p>{slot.note || "可預約時段"}</p><button className="i20-btn peach" onClick={() => bookSlot(slot.id)}>送出預約</button></article>)}</div></section> : null}</> : null}

        {tab === "services" ? <section className="i20-room-layout" style={{ marginTop: 18 }}><article className="i20-panel"><span className="i20-kicker">Provider Console</span><h3>上架我的陪伴服務</h3><form className="i20-list" onSubmit={saveService}><div className="i20-field"><label>服務標題</label><input className="i20-input" value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} /></div><div className="i20-field"><label>摘要</label><input className="i20-input" value={serviceForm.summary} onChange={(event) => setServiceForm({ ...serviceForm, summary: event.target.value })} /></div><div className="i20-form-grid"><select className="i20-select" value={serviceForm.buddy_category} onChange={(event) => setServiceForm({ ...serviceForm, buddy_category: event.target.value })}><option value="focus">專注陪伴</option><option value="life">生活陪伴</option><option value="support">情感支持</option><option value="hobby">興趣同好</option><option value="share">主題交流</option><option value="sports">運動健身</option><option value="travel">旅行出遊</option></select><select className="i20-select" value={serviceForm.status} onChange={(event) => setServiceForm({ ...serviceForm, status: event.target.value })}><option value="draft">草稿</option><option value="active">上架中</option><option value="paused">暫停接單</option><option value="archived">封存</option></select><input className="i20-input" type="number" value={serviceForm.price_per_hour_twd} onChange={(event) => setServiceForm({ ...serviceForm, price_per_hour_twd: Number(event.target.value) })} /></div><textarea className="i20-textarea" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="完整說明服務內容、適合對象與不適合情境。" /><input className="i20-input" value={serviceForm.tag_list_input} onChange={(event) => setServiceForm({ ...serviceForm, tag_list_input: event.target.value })} placeholder="讀書、家務、深夜陪伴" /><button className="i20-btn peach" type="submit">儲存服務</button></form></article><aside className="i20-panel dark"><h3>我的服務</h3><div className="i20-list">{myServices.map((service) => <div className="i20-card" key={service.id}><b>{service.title}</b><p>{service.status}｜NT${service.price_per_hour_twd}/hr｜{service.open_slots_count || 0} 時段</p></div>)}{!myServices.length ? <p>尚未建立服務。</p> : null}</div></aside></section> : null}

        {tab === "slots" ? <section className="i20-room-layout" style={{ marginTop: 18 }}><article className="i20-panel"><span className="i20-kicker">Availability</span><h3>建立可預約時段</h3><form className="i20-list" onSubmit={saveSlot}><select className="i20-select" value={slotForm.service_id} onChange={(event) => setSlotForm({ ...slotForm, service_id: event.target.value })}><option value="">選擇服務</option>{myServices.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select><div className="i20-form-grid"><input className="i20-input" type="datetime-local" value={slotForm.starts_at} onChange={(event) => setSlotForm({ ...slotForm, starts_at: event.target.value })} /><input className="i20-input" type="datetime-local" value={slotForm.ends_at} onChange={(event) => setSlotForm({ ...slotForm, ends_at: event.target.value })} /></div><textarea className="i20-textarea" value={slotForm.note} onChange={(event) => setSlotForm({ ...slotForm, note: event.target.value })} placeholder="這個時段的補充說明。" /><button className="i20-btn peach" type="submit">建立時段</button></form></article><aside className="i20-panel"><h3>我的時段</h3><div className="i20-list">{slots.map((slot) => <div className="i20-card" key={slot.id}><b>{formatDateTime(slot.starts_at)} ～ {formatDateTime(slot.ends_at)}</b><p>{slot.slot_status}｜{slot.note || "—"}</p></div>)}{!slots.length ? <p>尚未建立時段。</p> : null}</div></aside></section> : null}

        {tab === "bookings" ? <section className="i20-panel" style={{ marginTop: 18 }}><span className="i20-kicker">Bookings</span><h3>我的預約</h3><div className="i20-grid four" style={{ marginTop: 18 }}>{bookings.map((booking) => { const isProvider = booking.provider_user_id === userId; return <article className="i20-card" key={booking.id}><b>{booking.service?.title || "安感夥伴預約"}</b><p>{formatDateTime(booking.scheduled_start_at)} ～ {formatDateTime(booking.scheduled_end_at)}</p><div className="i20-chip-row"><span className="i20-chip">{booking.booking_status}</span><span className="i20-chip">{booking.payment_status}</span><span className="i20-chip">NT${booking.total_amount_twd}</span></div>{booking.linked_room_id ? <p>履約房：{booking.linked_room_invite_code || booking.linked_room_id}</p> : null}<div className="i20-actions-row">{isProvider && booking.booking_status === "pending" ? <button className="i20-btn peach" onClick={() => updateBooking(booking.id, "accept")}>接受</button> : null}{isProvider && booking.booking_status === "pending" ? <button className="i20-btn ghost" onClick={() => updateBooking(booking.id, "decline")}>婉拒</button> : null}{["pending", "accepted"].includes(booking.booking_status) ? <button className="i20-btn ghost" onClick={() => updateBooking(booking.id, "cancel")}>取消</button> : null}{booking.booking_status === "accepted" ? <button className="i20-btn light" onClick={() => updateBooking(booking.id, "complete")}>完成</button> : null}<button className="i20-btn ghost" onClick={() => openDispute(booking.id)}>爭議</button></div></article>; })}{!bookings.length ? <div className="i20-card">目前沒有預約。</div> : null}</div></section> : null}

        {tab === "provider" ? <section className="i20-room-layout" style={{ marginTop: 18 }}><article className="i20-panel"><span className="i20-kicker">Apply</span><h3>申請成為專業安感夥伴</h3><form className="i20-list" onSubmit={submitProviderApplication}><input className="i20-input" value={providerForm.display_title} onChange={(event) => setProviderForm({ ...providerForm, display_title: event.target.value })} placeholder="你想提供的陪伴定位" /><textarea className="i20-textarea" value={providerForm.experience_summary} onChange={(event) => setProviderForm({ ...providerForm, experience_summary: event.target.value })} placeholder="相關經驗、可提供的陪伴類型、可服務時段。" rows={6} /><textarea className="i20-textarea" value={providerForm.service_boundaries} onChange={(event) => setProviderForm({ ...providerForm, service_boundaries: event.target.value })} placeholder="明確列出不提供的內容與安全邊界。" rows={6} /><button className="i20-btn peach" type="submit">送出夥伴申請</button></form></article><aside className="i20-panel dark"><h3>成熟商業上線前的邊界</h3><p>金流審核期間，Buddies 只完成服務、時段、預約、履約與爭議底座；不宣稱 payout、抽成、退費已正式上線。</p></aside></section> : null}
      </div>
    </Image20SidebarShell>
  );
}
