"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

type BuddyCategory = "focus" | "life" | "sports" | "hobby" | "share" | "support" | "travel";
type DeliveryMode = "remote" | "in_person" | "hybrid";
type InteractionStyle = "silent" | "light-chat" | "guided" | "open-share";
type ServiceVisibility = "public" | "members" | "friends";
type ServiceStatus = "draft" | "active" | "paused" | "archived";
type SortKey = "recommended" | "price_asc" | "price_desc" | "rating" | "recent" | "popular";
type ViewTab = "market" | "services" | "bookings";

type PublicProfilePreview = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tags: string[] | null;
  is_professional_buddy: boolean | null;
};

type BuddyService = {
  id: string;
  provider_user_id: string;
  title: string;
  summary: string;
  description: string | null;
  buddy_category: BuddyCategory;
  interaction_style: InteractionStyle;
  delivery_mode: DeliveryMode;
  visibility: ServiceVisibility;
  tag_list: string[];
  price_per_hour_twd: number;
  accepts_new_users: boolean;
  accepts_last_minute: boolean;
  availability_note: string | null;
  status: ServiceStatus;
  provider_profile: PublicProfilePreview | null;
  review_count: number;
  average_rating: number | null;
  completed_bookings: number;
  pending_bookings: number;
  open_slots_count: number;
  updated_at: string;
};

type BuddyBooking = {
  id: string;
  service_id: string;
  booking_status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  payment_status: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  hours_booked: number;
  total_amount_twd: number;
  buyer_user_id: string;
  provider_user_id: string;
  service: {
    title: string;
    summary: string;
    buddy_category: BuddyCategory;
    delivery_mode: DeliveryMode;
    price_per_hour_twd: number;
  } | null;
  buyer_profile: PublicProfilePreview | null;
  provider_profile: PublicProfilePreview | null;
};

type ServicePayload = {
  id?: string;
  title: string;
  summary: string;
  description: string;
  buddy_category: BuddyCategory;
  interaction_style: InteractionStyle;
  delivery_mode: DeliveryMode;
  visibility: ServiceVisibility;
  tag_list_input: string;
  price_per_hour_twd: number;
  accepts_new_users: boolean;
  accepts_last_minute: boolean;
  availability_note: string;
  status: ServiceStatus;
};

const CATEGORY_OPTIONS: Array<{ value: "all" | BuddyCategory; label: string }> = [
  { value: "all", label: "全部" },
  { value: "focus", label: "專注陪伴" },
  { value: "life", label: "生活陪伴" },
  { value: "sports", label: "運動健身" },
  { value: "hobby", label: "興趣同好" },
  { value: "share", label: "主題交流" },
  { value: "support", label: "情感支持" },
  { value: "travel", label: "旅行出遊" },
];

const CATEGORY_LABEL: Record<BuddyCategory, string> = {
  focus: "專注陪伴",
  life: "生活陪伴",
  sports: "運動健身",
  hobby: "興趣同好",
  share: "主題交流",
  support: "情感支持",
  travel: "旅行出遊",
};

const DELIVERY_LABEL: Record<DeliveryMode, string> = {
  remote: "線上",
  in_person: "線下",
  hybrid: "混合",
};

const INTERACTION_LABEL: Record<InteractionStyle, string> = {
  silent: "安靜同行",
  "light-chat": "輕聊天",
  guided: "引導型",
  "open-share": "開放分享",
};

const VISIBILITY_LABEL: Record<ServiceVisibility, string> = {
  public: "公開",
  members: "會員限定",
  friends: "好友限定",
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  draft: "草稿",
  active: "上架中",
  paused: "暫停",
  archived: "封存",
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "待回覆",
  accepted: "已接受",
  declined: "已婉拒",
  cancelled: "已取消",
  completed: "已完成",
};

const sceneIdeas = [
  {
    title: "專注陪伴",
    body: "讀書、工作、寫履歷、整理文件。重點是有人一起，不是一直聊天。",
    pills: ["安靜同行", "適合新手"],
    tone: "var(--cc-scene-focus)",
  },
  {
    title: "生活陪伴",
    body: "整理房間、做家務、煮晚餐、陪自己過完一段生活時間。",
    pills: ["輕聊天", "低壓力"],
    tone: "var(--cc-scene-life)",
  },
  {
    title: "情感支持",
    body: "不是高強度諮商，而是在需要時，有人陪你撐過一段時間。",
    pills: ["溫和陪伴", "可預約"],
    tone: "var(--cc-scene-share)",
  },
];

const emptyExamples = [
  {
    title: "陪你讀書 1 小時",
    summary: "適合想先開始但不想一個人撐的人。",
    category: "focus",
    price: 280,
    note: "示例卡片",
  },
  {
    title: "晚餐前一起整理房間",
    summary: "輕聊天、低壓力，適合日常生活陪伴。",
    category: "life",
    price: 320,
    note: "示例卡片",
  },
  {
    title: "失眠時的安靜陪伴",
    summary: "不是高強度情緒諮商，而是有人一起待著。",
    category: "support",
    price: 350,
    note: "示例卡片",
  },
] as const;

const defaultForm: ServicePayload = {
  title: "",
  summary: "",
  description: "",
  buddy_category: "focus",
  interaction_style: "guided",
  delivery_mode: "remote",
  visibility: "public",
  tag_list_input: "",
  price_per_hour_twd: 300,
  accepts_new_users: true,
  accepts_last_minute: false,
  availability_note: "",
  status: "draft",
};

function authHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function BuddiesPage() {
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<ViewTab>("market");
  const [services, setServices] = useState<BuddyService[]>([]);
  const [myServices, setMyServices] = useState<BuddyService[]>([]);
  const [bookings, setBookings] = useState<BuddyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<"all" | BuddyCategory>("all");
  const [delivery, setDelivery] = useState<"all" | DeliveryMode>("all");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<ServicePayload>(defaultForm);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      setEmail(session?.email ?? "");
      setAccessToken(session?.accessToken ?? "");
      setUserId(session?.user.id ?? "");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, category, keyword, delivery, sort, verifiedOnly]);

  async function reloadAll() {
    setLoading(true);
    setMsg("");

    try {
      const serviceUrl = new URL("/api/buddies/services", window.location.origin);
      if (category !== "all") serviceUrl.searchParams.set("category", category);
      if (keyword.trim()) serviceUrl.searchParams.set("q", keyword.trim());
      if (delivery !== "all") serviceUrl.searchParams.set("delivery", delivery);
      if (sort !== "recommended") serviceUrl.searchParams.set("sort", sort);
      if (verifiedOnly) serviceUrl.searchParams.set("verified", "1");

      const requests: Promise<Response>[] = [
        fetch(serviceUrl.toString(), { headers: authHeaders(accessToken) }),
      ];

      if (accessToken) {
        const mineUrl = new URL("/api/buddies/services", window.location.origin);
        mineUrl.searchParams.set("mine", "1");
        requests.push(fetch(mineUrl.toString(), { headers: authHeaders(accessToken) }));
        requests.push(fetch("/api/buddies/bookings", { headers: authHeaders(accessToken) }));
      }

      const responses = await Promise.all(requests);
      const marketJson = await responses[0].json().catch(() => ({} as any));
      if (!responses[0].ok) throw new Error(marketJson?.error || "讀取安感夥伴服務失敗。");
      setServices((marketJson?.services ?? []) as BuddyService[]);

      if (responses[1]) {
        const myServicesJson = await responses[1].json().catch(() => ({} as any));
        if (responses[1].ok) setMyServices((myServicesJson?.services ?? []) as BuddyService[]);
      } else {
        setMyServices([]);
      }

      if (responses[2]) {
        const bookingsJson = await responses[2].json().catch(() => ({} as any));
        if (responses[2].ok) setBookings((bookingsJson?.bookings ?? []) as BuddyBooking[]);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      setMsg(error?.message || "讀取安感夥伴頁面失敗。");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setForm(defaultForm);
  }

  function startEdit(service: BuddyService) {
    setTab("services");
    setEditingId(service.id);
    setForm({
      id: service.id,
      title: service.title,
      summary: service.summary,
      description: service.description ?? "",
      buddy_category: service.buddy_category,
      interaction_style: service.interaction_style,
      delivery_mode: service.delivery_mode,
      visibility: service.visibility,
      tag_list_input: (service.tag_list ?? []).join(", "),
      price_per_hour_twd: service.price_per_hour_twd,
      accepts_new_users: service.accepts_new_users,
      accepts_last_minute: service.accepts_last_minute,
      availability_note: service.availability_note ?? "",
      status: service.status,
    });
    setMsg("已載入服務內容，可直接修改。");
  }

  async function saveService() {
    if (!accessToken) {
      setMsg("請先登入後再管理安感夥伴服務。");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const response = await fetch("/api/buddies/services", {
        method: "POST",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify({
          id: editingId || undefined,
          ...form,
        }),
      });
      const json = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(json?.error || "儲存服務失敗。");
      setMsg(editingId ? "已更新服務。" : "已建立服務。");
      resetForm();
      await reloadAll();
    } catch (error: any) {
      setMsg(error?.message || "儲存服務失敗。");
    } finally {
      setSaving(false);
    }
  }

  const marketCount = services.length;
  const myActiveCount = myServices.filter((item) => item.status === "active").length;
  const pendingCount = bookings.filter((item) => item.provider_user_id === userId && item.booking_status === "pending").length;
  const incomingBookings = useMemo(
    () => bookings.filter((item) => item.provider_user_id === userId),
    [bookings, userId],
  );
  const outgoingBookings = useMemo(
    () => bookings.filter((item) => item.buyer_user_id === userId),
    [bookings, userId],
  );

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Buddies</span>
          <p className="cc-eyebrow">找安感夥伴，或成為安感夥伴。</p>
          <h1 className="cc-h1" style={{ maxWidth: "8ch" }}>
            想找人陪你，或想把自己的陪伴服務放上來，都可以從這裡開始。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "40ch" }}>
            你可以先逛服務、先上架自己的服務，或回來看自己目前的預約狀態。
          </p>
          <div className="cc-action-row">
            <button type="button" className={tab === "market" ? "cc-btn-primary" : "cc-btn"} onClick={() => setTab("market")}>
              找安感夥伴
            </button>
            <button type="button" className={tab === "services" ? "cc-btn-primary" : "cc-btn"} onClick={() => setTab("services")}>
              我的服務
            </button>
            <button type="button" className={tab === "bookings" ? "cc-btn-primary" : "cc-btn"} onClick={() => setTab("bookings")}>
              我的預約
            </button>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">先看這裡能提供什麼</p>
              <h2 className="cc-h2">不是只有一種搭子，而是不同場景的陪伴方式。</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {sceneIdeas.map((item) => (
                <article
                  key={item.title}
                  className="cc-card cc-card-soft cc-stack-sm"
                  style={{ padding: 16, background: `linear-gradient(180deg, rgba(255,255,255,0.28), ${item.tone})` }}
                >
                  <div className="cc-h3">{item.title}</div>
                  <div className="cc-muted" style={{ lineHeight: 1.7 }}>{item.body}</div>
                  <div className="cc-action-row" style={{ marginTop: 0 }}>
                    {item.pills.map((pill) => (
                      <span key={pill} className="cc-pill-soft">{pill}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">目前概況</p>
              <h2 className="cc-h2">先知道市場裡現在有什麼。</h2>
            </div>
            <div className="cc-grid-3" style={{ gap: 12 }}>
              <div className="cc-panel">
                <div className="cc-caption">市場服務數</div>
                <div className="cc-h2" style={{ marginTop: 8 }}>{marketCount}</div>
              </div>
              <div className="cc-panel">
                <div className="cc-caption">你上架中的服務</div>
                <div className="cc-h2" style={{ marginTop: 8 }}>{myActiveCount}</div>
              </div>
              <div className="cc-panel">
                <div className="cc-caption">待回覆預約</div>
                <div className="cc-h2" style={{ marginTop: 8 }}>{pendingCount}</div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">探索與篩選</p>
            <h2 className="cc-h2">先把選項縮小，再挑適合自己的人。</h2>
          </div>
          <div className="cc-field">
            <span className="cc-field-label">搜尋</span>
            <input
              className="cc-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋服務名稱、關鍵字，例如：陪跑、陪聊、電影搭子"
            />
          </div>
          <div className="cc-action-row" style={{ marginTop: 0 }}>
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={category === item.value ? "cc-btn-primary" : "cc-btn"}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="cc-grid-2">
            <label className="cc-field">
              <span className="cc-field-label">提供方式</span>
              <select className="cc-select" value={delivery} onChange={(e) => setDelivery(e.target.value as "all" | DeliveryMode)}>
                <option value="all">全部</option>
                <option value="remote">線上</option>
                <option value="in_person">線下</option>
                <option value="hybrid">混合</option>
              </select>
            </label>
            <label className="cc-field">
              <span className="cc-field-label">排序</span>
              <select className="cc-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="recommended">推薦</option>
                <option value="price_asc">價格低到高</option>
                <option value="price_desc">價格高到低</option>
                <option value="rating">評價最高</option>
                <option value="recent">最近更新</option>
                <option value="popular">最多完成</option>
              </select>
            </label>
          </div>
          <label className="cc-row" style={{ alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            <span className="cc-field-label">只看已標示專業搭子候選</span>
          </label>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">信任與規則</p>
            <h2 className="cc-h2">讓人敢按預約，比堆功能更重要。</h2>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>卡片會直接顯示分類、價格、提供方式與互動風格。</div>
            <div>是否接受新手、是否接受臨時單，也會直接標出來。</div>
            <div>客服、退款與公開規則都有固定入口，不用自己猜。</div>
          </div>
          <div className="cc-action-row">
            <Link href="/contact" className="cc-btn">客服</Link>
            <Link href="/refund-policy" className="cc-btn">退款政策</Link>
          </div>
        </article>
      </section>

      {tab === "market" ? (
        <section className="cc-section cc-stack-md">
          <div className="cc-page-header" style={{ marginBottom: 0 }}>
            <div>
              <p className="cc-card-kicker">找安感夥伴</p>
              <h2 className="cc-h2">先看服務卡，再決定要不要深入。</h2>
            </div>
            <span className="cc-pill-soft">{marketCount} services</span>
          </div>

          {loading ? (
            <div className="cc-card cc-empty-state">正在讀取安感夥伴服務…</div>
          ) : services.length === 0 ? (
            <div className="cc-grid-3" style={{ gap: 14 }}>
              {emptyExamples.map((item) => (
                <article key={item.title} className="cc-card cc-card-soft cc-stack-sm">
                  <div className="cc-card-row">
                    <div>
                      <div className="cc-h3">{item.title}</div>
                      <div className="cc-caption">{CATEGORY_LABEL[item.category as BuddyCategory]}</div>
                    </div>
                    <span className="cc-pill-soft">{item.note}</span>
                  </div>
                  <div className="cc-muted" style={{ lineHeight: 1.75 }}>{item.summary}</div>
                  <div className="cc-page-meta">
                    <span className="cc-pill-success">NT${item.price} / 小時</span>
                    <span className="cc-pill-soft">線上</span>
                  </div>
                  <button className="cc-btn" type="button" disabled>
                    查看詳情（示例）
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="cc-grid-3" style={{ gap: 14 }}>
              {services.map((service) => (
                <article
                  key={service.id}
                  className="cc-card cc-stack-sm"
                  style={{
                    background: `linear-gradient(180deg, rgba(255,255,255,0.34), ${service.buddy_category === "focus" ? "var(--cc-scene-focus)" : service.buddy_category === "life" ? "var(--cc-scene-life)" : service.buddy_category === "share" ? "var(--cc-scene-share)" : "rgba(255,255,255,0.08)"})`,
                  }}
                >
                  <div className="cc-card-row" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="cc-h3">{service.title}</div>
                      <div className="cc-caption">
                        {service.provider_profile?.display_name || "安感夥伴"}
                        {service.provider_profile?.handle ? ` · @${service.provider_profile.handle}` : ""}
                      </div>
                    </div>
                    {service.provider_profile?.is_professional_buddy ? <span className="cc-pill-accent">專業候選</span> : null}
                  </div>
                  <div className="cc-page-meta">
                    <span className="cc-pill-success">NT${service.price_per_hour_twd} / 小時</span>
                    <span className="cc-pill-soft">{CATEGORY_LABEL[service.buddy_category]}</span>
                    <span className="cc-pill-soft">{DELIVERY_LABEL[service.delivery_mode]}</span>
                    <span className="cc-pill-soft">{INTERACTION_LABEL[service.interaction_style]}</span>
                  </div>
                  <div className="cc-muted" style={{ lineHeight: 1.75 }}>{service.summary}</div>
                  <div className="cc-action-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
                    <span className="cc-pill-soft">{service.open_slots_count} 個可約時段</span>
                    <span className="cc-pill-soft">{service.completed_bookings} 次完成</span>
                    <span className="cc-pill-soft">{service.average_rating ? `${service.average_rating}★` : "尚無評價"}</span>
                    <span className="cc-pill-soft">{VISIBILITY_LABEL[service.visibility]}</span>
                  </div>
                  <div className="cc-caption">
                    {service.accepts_new_users ? "接受新手" : "較適合已熟悉彼此節奏的人"}
                    {service.accepts_last_minute ? " · 接受臨時單" : ""}
                  </div>
                  <div className="cc-action-row">
                    {service.provider_user_id === userId ? (
                      <button className="cc-btn-primary" type="button" onClick={() => startEdit(service)}>
                        編輯我的服務
                      </button>
                    ) : (
                      <button className="cc-btn" type="button" disabled>
                        預約詳情整理中
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "services" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
          <article className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">我的服務</p>
                <h2 className="cc-h2">把你想提供的陪伴方式說清楚，讓人一眼看懂。</h2>
              </div>
              {editingId ? <span className="cc-pill-accent">編輯中</span> : null}
            </div>
            <label className="cc-field">
              <span className="cc-field-label">服務標題</span>
              <input className="cc-input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="例如：陪你讀書 1 小時" />
            </label>
            <label className="cc-field">
              <span className="cc-field-label">一句話摘要</span>
              <input className="cc-input" value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder="例如：適合想先開始但不想一個人撐的人。" />
            </label>
            <label className="cc-field">
              <span className="cc-field-label">詳細說明</span>
              <textarea className="cc-textarea" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="用簡單文字說清楚你會怎麼互動、適合什麼人。" />
            </label>
            <div className="cc-grid-3" style={{ gap: 12 }}>
              <label className="cc-field">
                <span className="cc-field-label">分類</span>
                <select className="cc-select" value={form.buddy_category} onChange={(e) => setForm((prev) => ({ ...prev, buddy_category: e.target.value as BuddyCategory }))}>
                  {CATEGORY_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-field-label">提供方式</span>
                <select className="cc-select" value={form.delivery_mode} onChange={(e) => setForm((prev) => ({ ...prev, delivery_mode: e.target.value as DeliveryMode }))}>
                  <option value="remote">線上</option>
                  <option value="in_person">線下</option>
                  <option value="hybrid">混合</option>
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-field-label">互動風格</span>
                <select className="cc-select" value={form.interaction_style} onChange={(e) => setForm((prev) => ({ ...prev, interaction_style: e.target.value as InteractionStyle }))}>
                  <option value="silent">安靜同行</option>
                  <option value="light-chat">輕聊天</option>
                  <option value="guided">引導型</option>
                  <option value="open-share">開放分享</option>
                </select>
              </label>
            </div>
            <div className="cc-grid-3" style={{ gap: 12 }}>
              <label className="cc-field">
                <span className="cc-field-label">價格 / 小時</span>
                <input className="cc-input" type="number" min={100} max={20000} value={form.price_per_hour_twd} onChange={(e) => setForm((prev) => ({ ...prev, price_per_hour_twd: Number(e.target.value || 0) }))} />
              </label>
              <label className="cc-field">
                <span className="cc-field-label">可見性</span>
                <select className="cc-select" value={form.visibility} onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value as ServiceVisibility }))}>
                  <option value="public">公開</option>
                  <option value="members">會員限定</option>
                  <option value="friends">好友限定</option>
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-field-label">狀態</span>
                <select className="cc-select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ServiceStatus }))}>
                  <option value="draft">草稿</option>
                  <option value="active">上架中</option>
                  <option value="paused">暫停</option>
                  <option value="archived">封存</option>
                </select>
              </label>
            </div>
            <label className="cc-field">
              <span className="cc-field-label">標籤</span>
              <input className="cc-input" value={form.tag_list_input} onChange={(e) => setForm((prev) => ({ ...prev, tag_list_input: e.target.value }))} placeholder="例如：早起、學生、新手友善、低壓力" />
            </label>
            <label className="cc-field">
              <span className="cc-field-label">可預約時段說明</span>
              <input className="cc-input" value={form.availability_note} onChange={(e) => setForm((prev) => ({ ...prev, availability_note: e.target.value }))} placeholder="例如：平日 20:00 之後可約，週末可提早。" />
            </label>
            <div className="cc-action-row">
              <label className="cc-row" style={{ alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.accepts_new_users} onChange={(e) => setForm((prev) => ({ ...prev, accepts_new_users: e.target.checked }))} />
                <span className="cc-field-label">接受新手</span>
              </label>
              <label className="cc-row" style={{ alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.accepts_last_minute} onChange={(e) => setForm((prev) => ({ ...prev, accepts_last_minute: e.target.checked }))} />
                <span className="cc-field-label">接受臨時單</span>
              </label>
            </div>
            <div className="cc-action-row">
              <button className="cc-btn-primary" type="button" disabled={saving} onClick={saveService}>
                {saving ? "儲存中…" : editingId ? "更新服務" : "上架我的服務"}
              </button>
              {editingId ? (
                <button className="cc-btn" type="button" onClick={resetForm}>
                  取消編輯
                </button>
              ) : null}
            </div>
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">我的服務列表</p>
                <h2 className="cc-h2">上架之後，也要能回頭看自己正在提供什麼。</h2>
              </div>
              <span className="cc-pill-soft">{myServices.length} services</span>
            </div>
            {loading ? (
              <div className="cc-note">正在讀取你的服務…</div>
            ) : myServices.length === 0 ? (
              <div className="cc-note">目前還沒有你自己的服務。你可以先上架第一個服務，再慢慢修整細節。</div>
            ) : (
              <div className="cc-stack-sm">
                {myServices.map((service) => (
                  <article key={service.id} className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 16 }}>
                    <div className="cc-card-row">
                      <div>
                        <div className="cc-h3">{service.title}</div>
                        <div className="cc-caption">{CATEGORY_LABEL[service.buddy_category]} · {DELIVERY_LABEL[service.delivery_mode]}</div>
                      </div>
                      <span className="cc-pill-soft">{STATUS_LABEL[service.status]}</span>
                    </div>
                    <div className="cc-muted" style={{ lineHeight: 1.75 }}>{service.summary}</div>
                    <div className="cc-action-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
                      <span className="cc-pill-success">NT${service.price_per_hour_twd} / 小時</span>
                      <span className="cc-pill-soft">{service.open_slots_count} 個可約時段</span>
                      <span className="cc-pill-soft">{service.pending_bookings} 筆進行中</span>
                    </div>
                    <div className="cc-action-row">
                      <button className="cc-btn" type="button" onClick={() => startEdit(service)}>
                        編輯
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {tab === "bookings" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">收到的預約</p>
              <h2 className="cc-h2">如果有人預約你，這裡會清楚顯示。</h2>
            </div>
            {incomingBookings.length === 0 ? (
              <div className="cc-note">目前還沒有收到任何預約。</div>
            ) : (
              <div className="cc-stack-sm">
                {incomingBookings.map((booking) => (
                  <article key={booking.id} className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 16 }}>
                    <div className="cc-card-row">
                      <div>
                        <div className="cc-h3">{booking.service?.title || "服務預約"}</div>
                        <div className="cc-caption">來自：{booking.buyer_profile?.display_name || "使用者"}</div>
                      </div>
                      <span className="cc-pill-soft">{BOOKING_STATUS_LABEL[booking.booking_status] || booking.booking_status}</span>
                    </div>
                    <div className="cc-muted">{new Date(booking.scheduled_start_at).toLocaleString()} – {new Date(booking.scheduled_end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="cc-caption">NT${booking.total_amount_twd} · {booking.hours_booked} 小時</div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">我送出的預約</p>
              <h2 className="cc-h2">如果你已經約了別人，這裡能看到目前進度。</h2>
            </div>
            {outgoingBookings.length === 0 ? (
              <div className="cc-note">目前還沒有你送出的預約。</div>
            ) : (
              <div className="cc-stack-sm">
                {outgoingBookings.map((booking) => (
                  <article key={booking.id} className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 16 }}>
                    <div className="cc-card-row">
                      <div>
                        <div className="cc-h3">{booking.service?.title || "服務預約"}</div>
                        <div className="cc-caption">對方：{booking.provider_profile?.display_name || "安感夥伴"}</div>
                      </div>
                      <span className="cc-pill-soft">{BOOKING_STATUS_LABEL[booking.booking_status] || booking.booking_status}</span>
                    </div>
                    <div className="cc-muted">{new Date(booking.scheduled_start_at).toLocaleString()} – {new Date(booking.scheduled_end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="cc-caption">NT${booking.total_amount_twd} · {booking.hours_booked} 小時</div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
