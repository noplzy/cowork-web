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
  BUDDY_HOUR_OPTIONS,
  BUDDY_INTERACTION_OPTIONS,
  BUDDY_SERVICE_STATUS_OPTIONS,
  BUDDY_VISIBILITY_OPTIONS,
  bookingStatusLabel,
  buddyServiceStatusLabel,
  buddyTagsToInput,
  computeBookingEndAt,
  descForBuddyCategory,
  emptyBuddyServiceInput,
  formatHoursLabel,
  formatTwd,
  labelForBuddyCategory,
  labelForBuddyDeliveryMode,
  labelForBuddyInteractionStyle,
  nextHourLocalValue,
  paymentStatusLabel,
  type BuddyBookingFeedItem,
  type BuddyCategoryFilter,
  type BuddyServiceInput,
  type BuddyServiceListItem,
} from "@/lib/buddies";
import { formatDateTimeRange, labelForVisibility } from "@/lib/socialProfile";

type TabKey = "market" | "my_services" | "my_bookings";

function authHeaders(token?: string): HeadersInit {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function jsonHeaders(token?: string): HeadersInit {
  const headers = new Headers(authHeaders(token));
  headers.set("Content-Type", "application/json");
  return headers;
}

function renderProviderName(service: BuddyServiceListItem) {
  return service.provider_profile?.display_name || "安感島使用者";
}

export default function BuddiesPage() {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [resolved, setResolved] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("market");
  const [category, setCategory] = useState<BuddyCategoryFilter>("all");
  const [search, setSearch] = useState("");

  const [services, setServices] = useState<BuddyServiceListItem[]>([]);
  const [myServices, setMyServices] = useState<BuddyServiceListItem[]>([]);
  const [bookings, setBookings] = useState<BuddyBookingFeedItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [actingBookingId, setActingBookingId] = useState("");
  const [msg, setMsg] = useState("");

  const [serviceForm, setServiceForm] = useState<BuddyServiceInput>(emptyBuddyServiceInput());
  const [editingServiceId, setEditingServiceId] = useState("");
  const [selectedService, setSelectedService] = useState<BuddyServiceListItem | null>(null);
  const [bookingStartAt, setBookingStartAt] = useState(nextHourLocalValue());
  const [bookingHours, setBookingHours] = useState<number>(1);
  const [bookingNote, setBookingNote] = useState("");

  async function loadPublicServices(token?: string, nextCategory: BuddyCategoryFilter = category, nextSearch: string = search) {
    const query = new URLSearchParams();
    if (nextCategory !== "all") query.set("category", nextCategory);
    if (nextSearch.trim()) query.set("q", nextSearch.trim());

    const resp = await fetch(`/api/buddies/services?${query.toString()}`, {
      headers: authHeaders(token),
      cache: "no-store",
    });

    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok) {
      throw new Error(json?.error || "讀取安感夥伴服務失敗。");
    }

    setServices((json?.services ?? []) as BuddyServiceListItem[]);
  }

  async function loadPrivateData(token?: string) {
    if (!token) {
      setMyServices([]);
      setBookings([]);
      return;
    }

    const [servicesResp, bookingsResp] = await Promise.all([
      fetch("/api/buddies/services?mine=1", {
        headers: authHeaders(token),
        cache: "no-store",
      }),
      fetch("/api/buddies/bookings", {
        headers: authHeaders(token),
        cache: "no-store",
      }),
    ]);

    const servicesJson = await servicesResp.json().catch(() => ({} as any));
    const bookingsJson = await bookingsResp.json().catch(() => ({} as any));

    if (!servicesResp.ok) {
      throw new Error(servicesJson?.error || "讀取你的安感夥伴服務失敗。");
    }
    if (!bookingsResp.ok) {
      throw new Error(bookingsJson?.error || "讀取你的安感夥伴預約失敗。");
    }

    setMyServices((servicesJson?.services ?? []) as BuddyServiceListItem[]);
    setBookings((bookingsJson?.bookings ?? []) as BuddyBookingFeedItem[]);
  }

  async function reloadAll(token?: string, nextCategory: BuddyCategoryFilter = category, nextSearch: string = search) {
    setLoading(true);
    try {
      await Promise.all([loadPublicServices(token, nextCategory, nextSearch), loadPrivateData(token)]);
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

      setEmail(session?.email ?? "");
      setUserId(session?.user.id ?? "");
      setAccessToken(session?.accessToken ?? "");
      setResolved(true);

      await reloadAll(session?.accessToken ?? "", category, search);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredServices = useMemo(() => services, [services]);
  const topTags = useMemo(() => {
    const counter = new Map<string, number>();
    filteredServices.forEach((item) => {
      item.tag_list?.forEach((tag) => {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [filteredServices]);

  const bookingPreviewEnd = useMemo(
    () => computeBookingEndAt(bookingStartAt, bookingHours),
    [bookingHours, bookingStartAt],
  );

  function resetServiceForm() {
    setEditingServiceId("");
    setServiceForm(emptyBuddyServiceInput());
  }

  async function applySearch(nextCategory: BuddyCategoryFilter = category, nextSearch = search) {
    await loadPublicServices(accessToken, nextCategory, nextSearch).catch((error: any) => {
      setMsg(error?.message || "查找安感夥伴失敗。");
    });
  }

  async function submitService() {
    if (!accessToken) {
      setMsg("請先登入後再管理安感夥伴服務。");
      return;
    }

    setSavingService(true);
    setMsg("");

    const resp = await fetch("/api/buddies/services", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({
        id: editingServiceId || undefined,
        ...serviceForm,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    setSavingService(false);

    if (!resp.ok) {
      setMsg(json?.error || "儲存安感夥伴服務失敗。");
      return;
    }

    setMsg(`服務已儲存。Build Tag: ${json?.build_tag ?? BUDDIES_BUILD_TAG}`);
    resetServiceForm();
    await reloadAll(accessToken, category, search);
  }

  function startEditingService(item: BuddyServiceListItem) {
    setEditingServiceId(item.id);
    setServiceForm({
      id: item.id,
      title: item.title,
      summary: item.summary,
      description: item.description ?? "",
      buddy_category: item.buddy_category,
      interaction_style: item.interaction_style,
      delivery_mode: item.delivery_mode,
      visibility: item.visibility,
      tag_list_input: buddyTagsToInput(item.tag_list),
      price_per_hour_twd: item.price_per_hour_twd,
      status: item.status,
    });
    setActiveTab("my_services");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submitBooking() {
    if (!selectedService) {
      setMsg("請先選擇要預約的服務。");
      return;
    }
    if (!accessToken) {
      setMsg("請先登入後再預約安感夥伴。");
      return;
    }

    setSubmittingBooking(true);
    setMsg("");

    const resp = await fetch("/api/buddies/bookings", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({
        service_id: selectedService.id,
        scheduled_start_at: new Date(bookingStartAt).toISOString(),
        hours_booked: bookingHours,
        buyer_note: bookingNote,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    setSubmittingBooking(false);

    if (!resp.ok) {
      setMsg(json?.error || "建立安感夥伴預約失敗。");
      return;
    }

    setMsg(`已送出預約。Build Tag: ${json?.build_tag ?? BUDDIES_BUILD_TAG}`);
    setSelectedService(null);
    setBookingHours(1);
    setBookingNote("");
    setBookingStartAt(nextHourLocalValue());
    await reloadAll(accessToken, category, search);
  }

  async function updateBooking(bookingId: string, action: "accept" | "decline" | "cancel" | "complete") {
    if (!accessToken) {
      setMsg("請先登入後再操作安感夥伴預約。");
      return;
    }

    setActingBookingId(bookingId);
    setMsg("");

    const resp = await fetch(`/api/buddies/bookings/${bookingId}`, {
      method: "PATCH",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({
        action,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    setActingBookingId("");

    if (!resp.ok) {
      setMsg(json?.error || "更新安感夥伴預約失敗。");
      return;
    }

    setMsg(`預約狀態已更新。Build Tag: ${json?.build_tag ?? BUDDIES_BUILD_TAG}`);
    await reloadAll(accessToken, category, search);
  }

  const marketStats = [
    { label: "公開服務", value: services.filter((item) => item.status === "active").length },
    { label: "熱門標籤", value: topTags.length },
    { label: "我的服務", value: myServices.length },
    { label: "我的預約", value: bookings.length },
  ];

  return (
    <main className="cc-container">
      <TopNav email={resolved ? email : undefined} />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Buddies Marketplace</span>
          <p className="cc-eyebrow">安感夥伴｜參考成熟搭子市場的場景分類，但保留安感島自己的邊界與節奏</p>
          <h1 className="cc-h1" style={{ maxWidth: "10ch" }}>
            先找對場景，再找對的人。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "54ch", marginTop: 0 }}>
            Buddies 不再只是一頁品牌說明，而是正式承接供需雙邊的服務頁。
            你可以上架自己的同行服務，也可以依場景、標籤、價格與互動形式找人。
          </p>

          <div className="cc-action-row">
            <button
              className={activeTab === "market" ? "cc-btn-primary" : "cc-btn"}
              type="button"
              onClick={() => setActiveTab("market")}
            >
              找安感夥伴
            </button>
            <button
              className={activeTab === "my_services" ? "cc-btn-primary" : "cc-btn"}
              type="button"
              onClick={() => setActiveTab("my_services")}
            >
              我的服務
            </button>
            <button
              className={activeTab === "my_bookings" ? "cc-btn-primary" : "cc-btn"}
              type="button"
              onClick={() => setActiveTab("my_bookings")}
            >
              我的預約
            </button>
          </div>

          <div className="cc-note cc-stack-sm">
            <div className="cc-h3">這版做的不是假頁</div>
            <div className="cc-muted">
              服務上架、分類、搜尋、預約與狀態流都照最終可上線架構製作，不另外做之後要拆掉的假流程。
            </div>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">探索摘要</p>
                <h2 className="cc-h2">分類改成更像成熟市場的做法</h2>
              </div>
              <span className="cc-pill-accent">v2</span>
            </div>

            <div className="cc-grid-2" style={{ gap: 12 }}>
              {marketStats.map((item) => (
                <div key={item.label} className="cc-panel">
                  <div className="cc-caption">{item.label}</div>
                  <div className="cc-h3" style={{ marginTop: 8 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="cc-caption" style={{ lineHeight: 1.7 }}>
              Build Tag：{BUDDIES_BUILD_TAG}
            </div>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">熱門搜尋示例</p>
            <div className="cc-caption" style={{ lineHeight: 1.75 }}>
              深夜讀書、陪煮晚餐、電影搭子、跑步陪跑、拍照打卡、陪診、留學交流、失眠陪伴
            </div>
          </div>
        </aside>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-card cc-stack-md">
        <div>
          <p className="cc-card-kicker">探索篩選</p>
          <h2 className="cc-h2">大類少一點，標籤多一點。</h2>
        </div>

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          <button
            type="button"
            className={category === "all" ? "cc-btn-primary" : "cc-btn"}
            onClick={async () => {
              setCategory("all");
              await applySearch("all", search);
            }}
          >
            全部
          </button>
          {BUDDY_CATEGORY_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={category === item.value ? "cc-btn-primary" : "cc-btn"}
              onClick={async () => {
                setCategory(item.value);
                await applySearch(item.value, search);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="cc-action-row" style={{ alignItems: "stretch" }}>
          <input
            className="cc-input"
            style={{ flex: 1, minWidth: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋：深夜讀書、陪煮晚餐、電影搭子、跑步陪跑、拍照打卡…"
          />
          <button className="cc-btn-primary" type="button" onClick={() => void applySearch()}>
            搜尋
          </button>
        </div>

        {topTags.length ? (
          <div className="cc-action-row" style={{ marginTop: 0 }}>
            {topTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="cc-btn"
                onClick={() => {
                  setSearch(tag);
                  void applySearch(category, tag);
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {activeTab === "market" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">服務列表</p>
                <h2 className="cc-h2">
                  {category === "all" ? "全部安感夥伴" : labelForBuddyCategory(category)}
                </h2>
              </div>
              <span className="cc-pill-soft">{filteredServices.length} services</span>
            </div>

            {loading ? (
              <div className="cc-note">正在整理服務列表…</div>
            ) : filteredServices.length === 0 ? (
              <div className="cc-note">目前沒有符合條件的服務。你可以換一個分類，或直接自己上架第一筆服務。</div>
            ) : (
              <div className="cc-stack-sm">
                {filteredServices.map((item) => (
                  <article key={item.id} className="cc-card cc-card-outline cc-stack-sm">
                    <div className="cc-card-row" style={{ alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{item.title}</span>
                          <span className="cc-pill-soft">{labelForBuddyCategory(item.buddy_category)}</span>
                          <span className="cc-pill-soft">{labelForBuddyInteractionStyle(item.interaction_style)}</span>
                          <span className="cc-pill-soft">{labelForBuddyDeliveryMode(item.delivery_mode)}</span>
                          <span className="cc-pill-soft">{labelForVisibility(item.visibility)}</span>
                          {item.provider_profile?.is_professional_buddy ? (
                            <span className="cc-pill-success">專業搭子候選</span>
                          ) : null}
                        </div>
                        <div className="cc-caption" style={{ marginTop: 8 }}>
                          由 {renderProviderName(item)} 提供
                          {item.provider_profile?.handle ? ` · @${item.provider_profile.handle}` : ""}
                        </div>
                      </div>

                      <div className="cc-stack-sm" style={{ alignItems: "flex-end" }}>
                        <div className="cc-h3">{formatTwd(item.price_per_hour_twd)} / 小時</div>
                        <button
                          type="button"
                          className="cc-btn-primary"
                          onClick={() => {
                            setSelectedService(item);
                            setActiveTab("market");
                            if (typeof window !== "undefined") {
                              window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: "smooth" });
                            }
                          }}
                        >
                          立即預約
                        </button>
                      </div>
                    </div>

                    <div className="cc-muted" style={{ lineHeight: 1.75 }}>
                      {item.summary}
                    </div>

                    {item.tag_list?.length ? (
                      <div className="cc-page-meta">
                        {item.tag_list.map((tag) => (
                          <span key={tag} className="cc-pill-soft">#{tag}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="cc-grid-3" style={{ gap: 12 }}>
                      <div className="cc-panel">
                        <div className="cc-caption">已完成</div>
                        <div className="cc-h3" style={{ marginTop: 8 }}>{item.completed_bookings}</div>
                      </div>
                      <div className="cc-panel">
                        <div className="cc-caption">評價</div>
                        <div className="cc-h3" style={{ marginTop: 8 }}>
                          {item.average_rating ? `${item.average_rating} / 5` : "尚無"}
                        </div>
                      </div>
                      <div className="cc-panel">
                        <div className="cc-caption">說明</div>
                        <div className="cc-caption" style={{ marginTop: 8, lineHeight: 1.65 }}>
                          {descForBuddyCategory(item.buddy_category)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">預約面板</p>
              <h2 className="cc-h2">先看場景，再決定這次要約多久。</h2>
            </div>

            {!selectedService ? (
              <div className="cc-note">先從左側選一項服務，這裡才會出現預約表單。</div>
            ) : (
              <>
                <div className="cc-note cc-stack-sm">
                  <div className="cc-h3">{selectedService.title}</div>
                  <div className="cc-caption">
                    {renderProviderName(selectedService)} · {labelForBuddyCategory(selectedService.buddy_category)} · {formatTwd(selectedService.price_per_hour_twd)} / 小時
                  </div>
                  <div className="cc-muted" style={{ lineHeight: 1.75 }}>{selectedService.summary}</div>
                </div>

                <label className="cc-field">
                  <span className="cc-field-label">開始時間</span>
                  <input
                    className="cc-input"
                    type="datetime-local"
                    value={bookingStartAt}
                    onChange={(e) => setBookingStartAt(e.target.value)}
                  />
                </label>

                <label className="cc-field">
                  <span className="cc-field-label">本次時數</span>
                  <select
                    className="cc-select"
                    value={bookingHours}
                    onChange={(e) => setBookingHours(Number(e.target.value))}
                  >
                    {BUDDY_HOUR_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {formatHoursLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cc-field">
                  <span className="cc-field-label">補充說明</span>
                  <textarea
                    className="cc-textarea"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    placeholder="例如：我想找跑步陪跑，每週二和週四晚上 8 點後較方便。"
                  />
                </label>

                <div className="cc-grid-2" style={{ gap: 12 }}>
                  <div className="cc-panel">
                    <div className="cc-caption">結束時間</div>
                    <div className="cc-h3" style={{ marginTop: 8 }}>
                      {formatDateTimeRange(bookingStartAt, bookingPreviewEnd)}
                    </div>
                  </div>
                  <div className="cc-panel">
                    <div className="cc-caption">本次總價</div>
                    <div className="cc-h3" style={{ marginTop: 8 }}>
                      {formatTwd(selectedService.price_per_hour_twd * bookingHours)}
                    </div>
                  </div>
                </div>

                <div className="cc-action-row">
                  <button
                    type="button"
                    className="cc-btn-primary"
                    disabled={submittingBooking}
                    onClick={submitBooking}
                  >
                    {submittingBooking ? "送出中…" : "送出預約"}
                  </button>
                  <button type="button" className="cc-btn" onClick={() => setSelectedService(null)}>
                    清除選擇
                  </button>
                </div>
              </>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === "my_services" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">上架 / 編輯服務</p>
              <h2 className="cc-h2">分類學成熟市場，結構走正式版。</h2>
            </div>

            <label className="cc-field">
              <span className="cc-field-label">服務名稱</span>
              <input
                className="cc-input"
                value={serviceForm.title}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例如：深夜讀書陪跑 1 小時 / 跑步陪跑 / 城市拍照搭子"
              />
            </label>

            <label className="cc-field">
              <span className="cc-field-label">140 字摘要</span>
              <textarea
                className="cc-textarea"
                value={serviceForm.summary}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="例如：適合需要有人一起開始的人，節奏穩，不會一直追著你問進度。"
              />
            </label>

            <div className="cc-grid-2">
              <label className="cc-field">
                <span className="cc-field-label">大類</span>
                <select
                  className="cc-select"
                  value={serviceForm.buddy_category}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, buddy_category: e.target.value as any }))}
                >
                  {BUDDY_CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-field">
                <span className="cc-field-label">互動形式</span>
                <select
                  className="cc-select"
                  value={serviceForm.interaction_style}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, interaction_style: e.target.value as any }))}
                >
                  {BUDDY_INTERACTION_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cc-grid-2">
              <label className="cc-field">
                <span className="cc-field-label">服務方式</span>
                <select
                  className="cc-select"
                  value={serviceForm.delivery_mode}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, delivery_mode: e.target.value as any }))}
                >
                  {BUDDY_DELIVERY_MODE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-field">
                <span className="cc-field-label">可見性</span>
                <select
                  className="cc-select"
                  value={serviceForm.visibility}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, visibility: e.target.value as any }))}
                >
                  {BUDDY_VISIBILITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="cc-field">
              <span className="cc-field-label">標籤（逗號分隔）</span>
              <input
                className="cc-input"
                value={serviceForm.tag_list_input}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, tag_list_input: e.target.value }))}
                placeholder="例如：跑步, 健身, 新手友善, 深夜, 拍照, 陪診"
              />
            </label>

            <label className="cc-field">
              <span className="cc-field-label">詳細說明</span>
              <textarea
                className="cc-textarea"
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="補充節奏、時段、適合對象、會不會主動帶節奏、是否接受臨時約等。"
              />
            </label>

            <div className="cc-grid-2">
              <label className="cc-field">
                <span className="cc-field-label">每小時價格</span>
                <input
                  className="cc-input"
                  type="number"
                  min={100}
                  max={20000}
                  value={serviceForm.price_per_hour_twd}
                  onChange={(e) =>
                    setServiceForm((prev) => ({ ...prev, price_per_hour_twd: Number(e.target.value || 0) }))
                  }
                />
              </label>

              <label className="cc-field">
                <span className="cc-field-label">狀態</span>
                <select
                  className="cc-select"
                  value={serviceForm.status}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, status: e.target.value as any }))}
                >
                  {BUDDY_SERVICE_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cc-action-row">
              <button type="button" className="cc-btn-primary" disabled={savingService} onClick={submitService}>
                {savingService ? "儲存中…" : editingServiceId ? "更新服務" : "建立服務"}
              </button>
              <button type="button" className="cc-btn" onClick={resetServiceForm}>
                清空表單
              </button>
            </div>
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">我的服務</p>
                <h2 className="cc-h2">每一筆服務都獨立上架，不再只有模糊介紹頁。</h2>
              </div>
              <span className="cc-pill-soft">{myServices.length} items</span>
            </div>

            {!resolved ? (
              <div className="cc-note">正在確認登入狀態…</div>
            ) : !accessToken ? (
              <div className="cc-note">請先登入後再管理你的服務。</div>
            ) : myServices.length === 0 ? (
              <div className="cc-note">你還沒有任何服務。先從最熟的一種場景開始，不要一次上太多。</div>
            ) : (
              <div className="cc-stack-sm">
                {myServices.map((item) => (
                  <article key={item.id} className="cc-card cc-card-outline cc-stack-sm">
                    <div className="cc-card-row" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{item.title}</span>
                          <span className="cc-pill-soft">{labelForBuddyCategory(item.buddy_category)}</span>
                          <span className="cc-pill-soft">{labelForBuddyDeliveryMode(item.delivery_mode)}</span>
                          <span className="cc-pill-soft">{buddyServiceStatusLabel(item.status)}</span>
                        </div>
                        <div className="cc-muted" style={{ lineHeight: 1.75, marginTop: 8 }}>{item.summary}</div>
                      </div>

                      <div className="cc-stack-sm" style={{ alignItems: "flex-end" }}>
                        <div className="cc-h3">{formatTwd(item.price_per_hour_twd)} / 小時</div>
                        <button type="button" className="cc-btn" onClick={() => startEditingService(item)}>
                          編輯
                        </button>
                      </div>
                    </div>

                    {item.tag_list?.length ? (
                      <div className="cc-page-meta">
                        {item.tag_list.map((tag) => (
                          <span key={tag} className="cc-pill-soft">#{tag}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="cc-caption">
                      已完成 {item.completed_bookings} 筆 · 待回覆 {item.pending_bookings} 筆 · 可見性 {labelForVisibility(item.visibility)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === "my_bookings" ? (
        <section className="cc-section">
          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">我的預約</p>
                <h2 className="cc-h2">接受、婉拒、取消、完成，先把狀態流做乾淨。</h2>
              </div>
              <span className="cc-pill-soft">{bookings.length} bookings</span>
            </div>

            {!resolved ? (
              <div className="cc-note">正在確認登入狀態…</div>
            ) : !accessToken ? (
              <div className="cc-note">請先登入後再查看你的預約。</div>
            ) : bookings.length === 0 ? (
              <div className="cc-note">你目前還沒有任何預約。</div>
            ) : (
              <div className="cc-stack-sm">
                {bookings.map((item) => {
                  const isProvider = item.provider_user_id === userId;
                  return (
                    <article key={item.id} className="cc-card cc-card-outline cc-stack-sm">
                      <div className="cc-card-row" style={{ alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cc-row" style={{ flexWrap: "wrap" }}>
                            <span className="cc-h3">{item.service?.title ?? "未命名服務"}</span>
                            <span className="cc-pill-soft">{bookingStatusLabel(item.booking_status)}</span>
                            <span className="cc-pill-soft">{paymentStatusLabel(item.payment_status)}</span>
                            {item.service?.buddy_category ? (
                              <span className="cc-pill-soft">{labelForBuddyCategory(item.service.buddy_category)}</span>
                            ) : null}
                          </div>

                          <div className="cc-muted" style={{ lineHeight: 1.75, marginTop: 8 }}>
                            {formatDateTimeRange(item.scheduled_start_at, item.scheduled_end_at)}
                            <br />
                            {isProvider
                              ? `預約人：${item.buyer_profile?.display_name ?? "安感島使用者"}`
                              : `服務提供者：${item.provider_profile?.display_name ?? "安感島使用者"}`}
                            <br />
                            共 {formatHoursLabel(item.hours_booked)} · 金額 {formatTwd(item.total_amount_twd)}
                          </div>

                          {item.buyer_note ? <div className="cc-note">{item.buyer_note}</div> : null}
                          {item.provider_note ? <div className="cc-caption">提供者備註：{item.provider_note}</div> : null}
                        </div>

                        <div className="cc-action-row" style={{ marginTop: 0, alignItems: "flex-end" }}>
                          {isProvider && item.booking_status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="cc-btn-primary"
                                disabled={actingBookingId === item.id}
                                onClick={() => void updateBooking(item.id, "accept")}
                              >
                                接受
                              </button>
                              <button
                                type="button"
                                className="cc-btn"
                                disabled={actingBookingId === item.id}
                                onClick={() => void updateBooking(item.id, "decline")}
                              >
                                婉拒
                              </button>
                            </>
                          ) : null}

                          {["pending", "accepted"].includes(item.booking_status) ? (
                            <button
                              type="button"
                              className="cc-btn"
                              disabled={actingBookingId === item.id}
                              onClick={() => void updateBooking(item.id, "cancel")}
                            >
                              取消
                            </button>
                          ) : null}

                          {isProvider && item.booking_status === "accepted" ? (
                            <button
                              type="button"
                              className="cc-btn-primary"
                              disabled={actingBookingId === item.id}
                              onClick={() => void updateBooking(item.id, "complete")}
                            >
                              完成
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
