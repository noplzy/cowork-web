"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  BUDDIES_BUILD_TAG,
  BUDDY_CATEGORY_OPTIONS,
  BUDDY_DELIVERY_MODE_OPTIONS,
  BUDDY_INTERACTION_OPTIONS,
  BUDDY_SERVICE_STATUS_OPTIONS,
  BUDDY_SORT_OPTIONS,
  BUDDY_VISIBILITY_OPTIONS,
  bookingStatusLabel,
  buddyServiceStatusLabel,
  buddyTagsToInput,
  emptyBuddyServiceInput,
  formatTwd,
  labelForBuddyCategory,
  labelForBuddyDeliveryMode,
  labelForBuddyInteractionStyle,
  paymentStatusLabel,
  type BuddyBookingFeedItem,
  type BuddyCategoryFilter,
  type BuddyServiceInput,
  type BuddyServiceListItem,
  type BuddyServiceMetrics,
  type BuddySortKey,
} from "@/lib/buddies";
import { labelForVisibility } from "@/lib/socialProfile";

type TopTab = "market" | "my_services";

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function jsonHeaders(token?: string): HeadersInit {
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}
function providerName(service: BuddyServiceListItem) {
  return service.provider_profile?.display_name || "安感島使用者";
}
function trustLabel(service: BuddyServiceListItem) {
  if (service.provider_profile?.is_professional_buddy) return "專業搭子候選";
  if (service.provider_profile?.handle) return "公開檔案已完成";
  return "可站內預約";
}

export default function BuddiesPage() {
  const [resolved, setResolved] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeTab, setActiveTab] = useState<TopTab>("market");
  const [category, setCategory] = useState<BuddyCategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [delivery, setDelivery] = useState<"all" | "remote" | "in_person" | "hybrid">("all");
  const [sort, setSort] = useState<BuddySortKey>("recommended");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [msg, setMsg] = useState("");
  const [services, setServices] = useState<BuddyServiceListItem[]>([]);
  const [myServices, setMyServices] = useState<BuddyServiceListItem[]>([]);
  const [bookings, setBookings] = useState<BuddyBookingFeedItem[]>([]);
  const [metrics, setMetrics] = useState<BuddyServiceMetrics>({ active_services: 0, pending_requests: 0, completed_bookings: 0 });
  const [serviceForm, setServiceForm] = useState<BuddyServiceInput>(emptyBuddyServiceInput());
  const [editingServiceId, setEditingServiceId] = useState("");

  async function loadMarket(nextCategory = category, nextSearch = search, nextDelivery = delivery, nextSort = sort, nextVerified = verifiedOnly, token = accessToken) {
    const query = new URLSearchParams();
    if (nextCategory !== "all") query.set("category", nextCategory);
    if (nextSearch.trim()) query.set("q", nextSearch.trim());
    if (nextDelivery !== "all") query.set("delivery", nextDelivery);
    if (nextSort !== "recommended") query.set("sort", nextSort);
    if (nextVerified) query.set("verified", "1");

    const resp = await fetch(`/api/buddies/services?${query.toString()}`, { headers: authHeaders(token), cache: "no-store" });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok) throw new Error(json?.error || "讀取安感夥伴服務失敗。");
    setServices((json?.services ?? []) as BuddyServiceListItem[]);
  }

  async function loadMine(token = accessToken, currentUserId = userId) {
    if (!token) {
      setMyServices([]);
      setBookings([]);
      setMetrics({ active_services: 0, pending_requests: 0, completed_bookings: 0 });
      return;
    }
    const [servicesResp, bookingsResp] = await Promise.all([
      fetch("/api/buddies/services?mine=1", { headers: authHeaders(token), cache: "no-store" }),
      fetch("/api/buddies/bookings", { headers: authHeaders(token), cache: "no-store" }),
    ]);
    const servicesJson = await servicesResp.json().catch(() => ({} as any));
    const bookingsJson = await bookingsResp.json().catch(() => ({} as any));
    if (!servicesResp.ok) throw new Error(servicesJson?.error || "讀取你的服務失敗。");
    if (!bookingsResp.ok) throw new Error(bookingsJson?.error || "讀取你的預約失敗。");

    const nextMyServices = (servicesJson?.services ?? []) as BuddyServiceListItem[];
    const nextBookings = (bookingsJson?.bookings ?? []) as BuddyBookingFeedItem[];
    setMyServices(nextMyServices);
    setBookings(nextBookings);
    setMetrics({
      active_services: nextMyServices.filter((item) => item.status === "active").length,
      pending_requests: nextBookings.filter((item) => item.provider_user_id === currentUserId && item.booking_status === "pending").length,
      completed_bookings: nextBookings.filter((item) => item.provider_user_id === currentUserId && item.booking_status === "completed").length,
    });
  }

  async function reloadAll(nextCategory = category, nextSearch = search, nextDelivery = delivery, nextSort = sort, nextVerified = verifiedOnly, token = accessToken, currentUserId = userId) {
    setLoading(true);
    try {
      await Promise.all([loadMarket(nextCategory, nextSearch, nextDelivery, nextSort, nextVerified, token), loadMine(token, currentUserId)]);
    } catch (error: any) {
      setMsg(error?.message || "讀取安感夥伴資料失敗。");
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
      await reloadAll(category, search, delivery, sort, verifiedOnly, session?.accessToken ?? "", session?.user.id ?? "");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryCounts = useMemo(() => {
    const base: Record<BuddyCategoryFilter, number> = { all: services.length, focus: 0, life: 0, sports: 0, hobby: 0, share: 0, support: 0, travel: 0 };
    services.forEach((item) => { base[item.buddy_category] += 1; });
    return base;
  }, [services]);

  async function applyFilters(next: Partial<{ category: BuddyCategoryFilter; search: string; delivery: "all" | "remote" | "in_person" | "hybrid"; sort: BuddySortKey; verified: boolean }>) {
    const nextCategory = next.category ?? category;
    const nextSearch = next.search ?? search;
    const nextDelivery = next.delivery ?? delivery;
    const nextSort = next.sort ?? sort;
    const nextVerified = next.verified ?? verifiedOnly;
    setCategory(nextCategory);
    setSearch(nextSearch);
    setDelivery(nextDelivery);
    setSort(nextSort);
    setVerifiedOnly(nextVerified);
    await reloadAll(nextCategory, nextSearch, nextDelivery, nextSort, nextVerified, accessToken, userId);
  }

  async function saveService() {
    setSavingService(true);
    setMsg("");
    const resp = await fetch("/api/buddies/services", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({
        id: editingServiceId || undefined,
        ...serviceForm,
        tag_list_input: serviceForm.tag_list_input,
      }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setSavingService(false);
    if (!resp.ok) {
      setMsg(json?.error || "儲存服務失敗。");
      return;
    }
    setMsg(editingServiceId ? "已更新服務。" : "已建立服務。");
    setEditingServiceId("");
    setServiceForm(emptyBuddyServiceInput());
    await reloadAll(category, search, delivery, sort, verifiedOnly, accessToken, userId);
  }

  function editService(service: BuddyServiceListItem) {
    setActiveTab("my_services");
    setEditingServiceId(service.id);
    setServiceForm({
      title: service.title,
      summary: service.summary,
      description: service.description ?? "",
      buddy_category: service.buddy_category,
      interaction_style: service.interaction_style,
      delivery_mode: service.delivery_mode,
      visibility: service.visibility,
      tag_list_input: buddyTagsToInput(service.tag_list),
      price_per_hour_twd: service.price_per_hour_twd,
      accepts_new_users: service.accepts_new_users,
      accepts_last_minute: service.accepts_last_minute,
      availability_note: service.availability_note ?? "",
      status: service.status,
    });
  }

  function resetServiceForm() {
    setEditingServiceId("");
    setServiceForm(emptyBuddyServiceInput());
  }

  const incomingBookings = bookings.filter((item) => item.provider_user_id === userId);
  const outgoingBookings = bookings.filter((item) => item.buyer_user_id === userId);

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Buddies Marketplace</span>
          <p className="cc-eyebrow">安感夥伴｜真正的雙邊市集：找人、上架、預約、履約都在這裡開始</p>
          <h1 className="cc-h1" style={{ maxWidth: "10ch" }}>先決定你是要找搭子，還是提供服務。</h1>
          <p className="cc-lead" style={{ maxWidth: "50ch", marginTop: 0 }}>
            這一頁不再只是品牌介紹，而是安感夥伴的正式市場入口。你可以直接瀏覽服務、查看詳情、選擇可預約時段，或管理自己的服務與收到的預約。
          </p>
          <div className="cc-action-row">
            <button type="button" className={activeTab === "market" ? "cc-btn-primary" : "cc-btn"} onClick={() => setActiveTab("market")}>找安感夥伴</button>
            <button type="button" className={activeTab === "my_services" ? "cc-btn-primary" : "cc-btn"} onClick={() => setActiveTab("my_services")}>我的服務</button>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">市場摘要</p>
                <h2 className="cc-h2">成熟搭子頁先看供給，再談理念。</h2>
              </div>
              <span className="cc-pill-accent">Build {BUDDIES_BUILD_TAG}</span>
            </div>
            <div className="cc-grid-3" style={{ gap: 12 }}>
              <div className="cc-panel"><div className="cc-caption">市場服務數</div><div className="cc-h2">{services.length}</div></div>
              <div className="cc-panel"><div className="cc-caption">你上架中的服務</div><div className="cc-h2">{metrics.active_services}</div></div>
              <div className="cc-panel"><div className="cc-caption">待回覆預約</div><div className="cc-h2">{metrics.pending_requests}</div></div>
            </div>
            <div className="cc-note cc-stack-sm">
              <div><strong>已驗證標示：</strong>目前先以公開檔案 / 專業搭子候選旗標呈現。</div>
              <div><strong>履約房：</strong>預約接受後會自動建立 Rooms 履約房。</div>
            </div>
          </div>
        </aside>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      {activeTab === "market" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">探索篩選</p>
              <h2 className="cc-h2">先縮小場景，再看誰真的適合你。</h2>
            </div>

            <div className="cc-action-row" style={{ flexWrap: "wrap" }}>
              <button type="button" className={category === "all" ? "cc-btn-primary" : "cc-btn"} onClick={() => applyFilters({ category: "all" })}>
                全部 <span className="cc-pill-soft">{categoryCounts.all}</span>
              </button>
              {BUDDY_CATEGORY_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={category === item.value ? "cc-btn-primary" : "cc-btn"} onClick={() => applyFilters({ category: item.value })}>
                  {item.label} <span className="cc-pill-soft">{categoryCounts[item.value]}</span>
                </button>
              ))}
            </div>

            <div className="cc-action-row" style={{ marginTop: 0 }}>
              <input className="cc-input" style={{ flex: 1, minWidth: 0 }} value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="例如：陪診、跑步陪跑、拍照打卡、深夜讀書…" />
              <button type="button" className="cc-btn" onClick={() => applyFilters({ search: searchDraft })}>搜尋</button>
            </div>

            <div className="cc-grid-3" style={{ gap: 12 }}>
              <label className="cc-field">
                <span className="cc-field-label">提供方式</span>
                <select className="cc-select" value={delivery} onChange={(e) => applyFilters({ delivery: e.target.value as any })}>
                  <option value="all">全部</option>
                  {BUDDY_DELIVERY_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-field-label">排序</span>
                <select className="cc-select" value={sort} onChange={(e) => applyFilters({ sort: e.target.value as BuddySortKey })}>
                  {BUDDY_SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-field-label">信任條件</span>
                <button type="button" className={verifiedOnly ? "cc-btn-primary" : "cc-btn"} onClick={() => applyFilters({ verified: !verifiedOnly })}>
                  {verifiedOnly ? "只看專業搭子候選" : "顯示全部"}
                </button>
              </label>
            </div>
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">市場列表</p>
                <h2 className="cc-h2">真正成熟的搭子頁，主體應該是服務卡。</h2>
              </div>
              <span className="cc-pill-soft">{services.length} services</span>
            </div>

            {loading ? (
              <div className="cc-note">正在讀取服務列表…</div>
            ) : services.length === 0 ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">目前還沒有符合條件的公開服務。</div>
                <div className="cc-muted">要不要成為第一位安感夥伴？</div>
                <button type="button" className="cc-btn-primary" onClick={() => setActiveTab("my_services")}>上架我的服務</button>
              </div>
            ) : (
              <ul className="cc-list">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link href={`/buddies/${service.id}`} className="cc-listlink">
                      <div className="cc-stack-sm">
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{service.title}</span>
                          <span className="cc-pill-soft">{labelForBuddyCategory(service.buddy_category)}</span>
                          <span className="cc-pill-soft">{labelForBuddyDeliveryMode(service.delivery_mode)}</span>
                          <span className="cc-pill-soft">{labelForBuddyInteractionStyle(service.interaction_style)}</span>
                          <span className="cc-pill-soft">{trustLabel(service)}</span>
                        </div>
                        <div className="cc-muted">{providerName(service)} · {formatTwd(service.price_per_hour_twd)} / 小時</div>
                        <div className="cc-caption" style={{ lineHeight: 1.7 }}>{service.summary}</div>
                        <div className="cc-action-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
                          {service.tag_list.slice(0, 5).map((tag) => <span key={tag} className="cc-pill-soft">{tag}</span>)}
                          <span className="cc-pill-soft">可預約時段 {service.open_slots_count}</span>
                          <span className="cc-pill-soft">已完成 {service.completed_bookings}</span>
                          {service.average_rating ? <span className="cc-pill-soft">評價 {service.average_rating} / 5</span> : null}
                        </div>
                      </div>
                      <span className="cc-btn-link">查看詳情 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">上架 / 編輯服務</p>
              <h2 className="cc-h2">先把服務說清楚，再去承接預約與履約。</h2>
            </div>

            <label className="cc-field"><span className="cc-field-label">標題</span><input className="cc-input" value={serviceForm.title} onChange={(e) => setServiceForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
            <label className="cc-field"><span className="cc-field-label">摘要</span><input className="cc-input" value={serviceForm.summary} onChange={(e) => setServiceForm((prev) => ({ ...prev, summary: e.target.value }))} /></label>
            <label className="cc-field"><span className="cc-field-label">詳細說明</span><textarea className="cc-textarea" value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} /></label>

            <div className="cc-grid-2">
              <label className="cc-field"><span className="cc-field-label">分類</span><select className="cc-select" value={serviceForm.buddy_category} onChange={(e) => setServiceForm((prev) => ({ ...prev, buddy_category: e.target.value as any }))}>{BUDDY_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="cc-field"><span className="cc-field-label">互動形式</span><select className="cc-select" value={serviceForm.interaction_style} onChange={(e) => setServiceForm((prev) => ({ ...prev, interaction_style: e.target.value as any }))}>{BUDDY_INTERACTION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            </div>

            <div className="cc-grid-3" style={{ gap: 12 }}>
              <label className="cc-field"><span className="cc-field-label">提供方式</span><select className="cc-select" value={serviceForm.delivery_mode} onChange={(e) => setServiceForm((prev) => ({ ...prev, delivery_mode: e.target.value as any }))}>{BUDDY_DELIVERY_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="cc-field"><span className="cc-field-label">可見性</span><select className="cc-select" value={serviceForm.visibility} onChange={(e) => setServiceForm((prev) => ({ ...prev, visibility: e.target.value as any }))}>{BUDDY_VISIBILITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="cc-field"><span className="cc-field-label">狀態</span><select className="cc-select" value={serviceForm.status} onChange={(e) => setServiceForm((prev) => ({ ...prev, status: e.target.value as any }))}>{BUDDY_SERVICE_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            </div>

            <div className="cc-grid-2">
              <label className="cc-field"><span className="cc-field-label">每小時價格</span><input className="cc-input" type="number" min={100} step={50} value={serviceForm.price_per_hour_twd} onChange={(e) => setServiceForm((prev) => ({ ...prev, price_per_hour_twd: Number(e.target.value) }))} /></label>
              <label className="cc-field"><span className="cc-field-label">標籤</span><input className="cc-input" value={serviceForm.tag_list_input} onChange={(e) => setServiceForm((prev) => ({ ...prev, tag_list_input: e.target.value }))} placeholder="例如：讀書、深夜、失眠陪伴" /></label>
            </div>

            <label className="cc-field"><span className="cc-field-label">可預約時段說明</span><textarea className="cc-textarea" value={serviceForm.availability_note} onChange={(e) => setServiceForm((prev) => ({ ...prev, availability_note: e.target.value }))} placeholder="例如：平日 19:00 後，週末上午可安排。" /></label>

            <div className="cc-action-row">
              <button type="button" className="cc-btn-primary" onClick={saveService} disabled={savingService || !resolved}>{savingService ? "儲存中…" : editingServiceId ? "更新服務" : "建立服務"}</button>
              <button type="button" className="cc-btn" onClick={resetServiceForm}>清空表單</button>
            </div>
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">我的服務 / 預約</p>
                <h2 className="cc-h2">供給面也要像成熟產品，不是只有一顆按鈕。</h2>
              </div>
              <span className="cc-pill-soft">{myServices.length} services</span>
            </div>

            <div className="cc-grid-3" style={{ gap: 12 }}>
              <div className="cc-panel"><div className="cc-caption">上架中</div><div className="cc-h2">{metrics.active_services}</div></div>
              <div className="cc-panel"><div className="cc-caption">待回覆</div><div className="cc-h2">{metrics.pending_requests}</div></div>
              <div className="cc-panel"><div className="cc-caption">已完成</div><div className="cc-h2">{metrics.completed_bookings}</div></div>
            </div>

            <div className="cc-stack-sm">
              {myServices.length === 0 ? <div className="cc-note">你還沒有服務，先建立第一筆。</div> : myServices.map((service) => (
                <div key={service.id} className="cc-card cc-card-soft cc-stack-sm">
                  <div className="cc-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div className="cc-stack-sm">
                      <div className="cc-h3">{service.title}</div>
                      <div className="cc-caption">{labelForBuddyCategory(service.buddy_category)} · {formatTwd(service.price_per_hour_twd)} / 小時 · {buddyServiceStatusLabel(service.status)}</div>
                    </div>
                    <div className="cc-action-row">
                      <button type="button" className="cc-btn" onClick={() => editService(service)}>編輯</button>
                      <Link href={`/buddies/${service.id}`} className="cc-btn-primary">管理詳情 / 時段</Link>
                    </div>
                  </div>
                </div>
              ))}

              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">收到的預約</div>
                {incomingBookings.length === 0 ? <div className="cc-muted">目前沒有收到預約。</div> : incomingBookings.slice(0, 6).map((item) => (
                  <div key={item.id} className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>{item.service?.title ?? "服務"} · {bookingStatusLabel(item.booking_status)} · {paymentStatusLabel(item.payment_status)}</div>
                    <div>{item.linked_room_id ? <Link href={`/rooms/${item.linked_room_id}`} className="cc-btn-link">履約房 →</Link> : null}</div>
                  </div>
                ))}
              </div>

              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">我送出的預約</div>
                {outgoingBookings.length === 0 ? <div className="cc-muted">你還沒有送出任何預約。</div> : outgoingBookings.slice(0, 6).map((item) => (
                  <div key={item.id} className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>{item.service?.title ?? "服務"} · {bookingStatusLabel(item.booking_status)} · {paymentStatusLabel(item.payment_status)}</div>
                    <div>{item.linked_room_id ? <Link href={`/rooms/${item.linked_room_id}`} className="cc-btn-link">履約房 →</Link> : null}</div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
