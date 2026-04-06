import type { PublicProfileRow } from "@/lib/socialProfile";

export const BUDDIES_BUILD_TAG = "buddies-v4-2026-04-06";

export type BuddyCategory =
  | "focus"
  | "life"
  | "sports"
  | "hobby"
  | "share"
  | "support"
  | "travel";

export type BuddyCategoryFilter = "all" | BuddyCategory;
export type BuddyInteractionStyle = "silent" | "light-chat" | "guided" | "open-share";
export type BuddyDeliveryMode = "remote" | "in_person" | "hybrid";
export type BuddyServiceVisibility = "public" | "members" | "friends";
export type BuddyServiceStatus = "draft" | "active" | "paused" | "archived";
export type BuddyBookingStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";
export type BuddyPaymentStatus = "unpaid" | "paid" | "refunded";
export type BuddySortKey = "recommended" | "price_asc" | "price_desc" | "rating" | "recent" | "popular";
export type BuddySlotStatus = "open" | "held" | "booked" | "cancelled";

export type PublicProfilePreview = Pick<
  PublicProfileRow,
  "user_id" | "handle" | "display_name" | "avatar_url" | "bio" | "tags" | "is_professional_buddy"
>;

export type BuddyServiceRow = {
  id: string;
  provider_user_id: string;
  title: string;
  summary: string;
  description: string | null;
  buddy_category: BuddyCategory;
  interaction_style: BuddyInteractionStyle;
  delivery_mode: BuddyDeliveryMode;
  visibility: BuddyServiceVisibility;
  tag_list: string[];
  price_per_hour_twd: number;
  accepts_new_users: boolean;
  accepts_last_minute: boolean;
  availability_note: string | null;
  status: BuddyServiceStatus;
  created_at: string;
  updated_at: string;
};

export type BuddyServiceListItem = BuddyServiceRow & {
  provider_profile: PublicProfilePreview | null;
  review_count: number;
  average_rating: number | null;
  completed_bookings: number;
  pending_bookings: number;
  open_slots_count: number;
};

export type BuddyServiceDetail = BuddyServiceListItem & {
  upcoming_slots: BuddyServiceSlotRow[];
  recent_reviews: BuddyReviewFeedItem[];
};

export type BuddyBookingRow = {
  id: string;
  service_id: string;
  slot_id: string | null;
  buyer_user_id: string;
  provider_user_id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  hours_booked: number;
  total_amount_twd: number;
  booking_status: BuddyBookingStatus;
  payment_status: BuddyPaymentStatus;
  buyer_note: string | null;
  provider_note: string | null;
  linked_room_id: string | null;
  linked_room_invite_code: string | null;
  created_at: string;
  updated_at: string;
};

export type BuddyBookingFeedItem = BuddyBookingRow & {
  service: Pick<
    BuddyServiceRow,
    | "id"
    | "title"
    | "summary"
    | "buddy_category"
    | "interaction_style"
    | "delivery_mode"
    | "price_per_hour_twd"
    | "tag_list"
    | "accepts_new_users"
    | "accepts_last_minute"
    | "availability_note"
  > | null;
  buyer_profile: PublicProfilePreview | null;
  provider_profile: PublicProfilePreview | null;
};

export type BuddyServiceSlotRow = {
  id: string;
  service_id: string;
  provider_user_id: string;
  starts_at: string;
  ends_at: string;
  slot_status: BuddySlotStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type BuddyReviewRow = {
  id: string;
  booking_id: string;
  service_id: string;
  reviewer_user_id: string;
  reviewee_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type BuddyReviewFeedItem = BuddyReviewRow & {
  reviewer_profile: PublicProfilePreview | null;
};

export type BuddyServiceInput = {
  id?: string;
  title: string;
  summary: string;
  description: string;
  buddy_category: BuddyCategory;
  interaction_style: BuddyInteractionStyle;
  delivery_mode: BuddyDeliveryMode;
  visibility: BuddyServiceVisibility;
  tag_list_input: string;
  price_per_hour_twd: number;
  accepts_new_users: boolean;
  accepts_last_minute: boolean;
  availability_note: string;
  status: BuddyServiceStatus;
};

export type BuddyServiceMetrics = {
  active_services: number;
  pending_requests: number;
  completed_bookings: number;
};

export const BUDDY_CATEGORY_OPTIONS: Array<{
  value: BuddyCategory;
  label: string;
  desc: string;
  sampleTags: string[];
}> = [
  { value: "focus", label: "專注陪伴", desc: "讀書、寫作、備考、工作陪跑、報告衝刺。", sampleTags: ["讀書", "寫作", "備考", "工作陪跑", "報告衝刺"] },
  { value: "life", label: "生活陪伴", desc: "煮飯、家務、整理房間、逛街、陪診。", sampleTags: ["煮飯", "家務", "整理房間", "逛街", "陪診"] },
  { value: "sports", label: "運動健身", desc: "跑步、健身、瑜伽、打球、爬山。", sampleTags: ["跑步", "健身", "瑜伽", "打球", "爬山"] },
  { value: "hobby", label: "興趣同好", desc: "遊戲、電影、攝影、手作、閱讀、二次元。", sampleTags: ["遊戲", "電影", "攝影", "手作", "閱讀"] },
  { value: "share", label: "主題交流", desc: "育兒心得、工作分享、留學經驗、作品交流。", sampleTags: ["育兒", "工作分享", "留學", "作品交流", "語言練習"] },
  { value: "support", label: "情感支持", desc: "深夜傾訴、解壓聊天、情緒陪伴。", sampleTags: ["深夜聊天", "解壓", "情緒陪伴", "樹洞", "失眠陪伴"] },
  { value: "travel", label: "旅行出遊", desc: "短途旅行、拍照打卡、城市探索、行程規劃。", sampleTags: ["短途旅行", "拍照打卡", "城市探索", "行程規劃", "旅伴"] },
];

export const BUDDY_VISIBILITY_OPTIONS = [
  { value: "public", label: "公開可見" },
  { value: "members", label: "VIP 會員可見" },
  { value: "friends", label: "好友可見" },
] as const;

export const BUDDY_DELIVERY_MODE_OPTIONS = [
  { value: "remote", label: "線上", desc: "在安感島 Rooms 或站內排程完成" },
  { value: "in_person", label: "線下", desc: "適合陪診、運動、出遊等現實場景" },
  { value: "hybrid", label: "線上＋線下", desc: "先線上確認，再視需求安排線下" },
] as const;

export const BUDDY_INTERACTION_OPTIONS = [
  { value: "silent", label: "安靜同行" },
  { value: "light-chat", label: "輕聊天" },
  { value: "guided", label: "引導型" },
  { value: "open-share", label: "開放分享" },
] as const;

export const BUDDY_SERVICE_STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "上架中" },
  { value: "paused", label: "暫停接單" },
  { value: "archived", label: "已封存" },
] as const;

export const BUDDY_SORT_OPTIONS = [
  { value: "recommended", label: "推薦" },
  { value: "price_asc", label: "價格低到高" },
  { value: "price_desc", label: "價格高到低" },
  { value: "rating", label: "評價最高" },
  { value: "recent", label: "最近上架" },
  { value: "popular", label: "最多完成" },
] as const;

export function emptyBuddyServiceInput(): BuddyServiceInput {
  return {
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
}

export function isBuddyCategory(value: string): value is BuddyCategory {
  return ["focus", "life", "sports", "hobby", "share", "support", "travel"].includes(value);
}
export function isBuddyDeliveryMode(value: string): value is BuddyDeliveryMode {
  return value === "remote" || value === "in_person" || value === "hybrid";
}
export function isBuddyInteractionStyle(value: string): value is BuddyInteractionStyle {
  return ["silent", "light-chat", "guided", "open-share"].includes(value);
}
export function isBuddyServiceVisibility(value: string): value is BuddyServiceVisibility {
  return value === "public" || value === "members" || value === "friends";
}
export function isBuddyServiceStatus(value: string): value is BuddyServiceStatus {
  return value === "draft" || value === "active" || value === "paused" || value === "archived";
}
export function isBuddySortKey(value: string): value is BuddySortKey {
  return ["recommended", "price_asc", "price_desc", "rating", "recent", "popular"].includes(value);
}
export function isBuddySlotStatus(value: string): value is BuddySlotStatus {
  return ["open", "held", "booked", "cancelled"].includes(value);
}

export function labelForBuddyCategory(value?: string | null) {
  return BUDDY_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? "未分類";
}
export function descForBuddyCategory(value?: string | null) {
  return BUDDY_CATEGORY_OPTIONS.find((item) => item.value === value)?.desc ?? "尚未設定分類說明";
}
export function labelForBuddyDeliveryMode(value?: string | null) {
  return BUDDY_DELIVERY_MODE_OPTIONS.find((item) => item.value === value)?.label ?? "未指定";
}
export function labelForBuddyInteractionStyle(value?: string | null) {
  return BUDDY_INTERACTION_OPTIONS.find((item) => item.value === value)?.label ?? "未指定";
}
export function buddyServiceStatusLabel(value?: string | null) {
  return BUDDY_SERVICE_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? "未指定";
}
export function bookingStatusLabel(value?: string | null) {
  if (value === "pending") return "待回覆";
  if (value === "accepted") return "已接受";
  if (value === "declined") return "已婉拒";
  if (value === "cancelled") return "已取消";
  if (value === "completed") return "已完成";
  return "未指定";
}
export function paymentStatusLabel(value?: string | null) {
  if (value === "unpaid") return "未付款";
  if (value === "paid") return "已付款";
  if (value === "refunded") return "已退款";
  return "未指定";
}
export function slotStatusLabel(value?: string | null) {
  if (value === "open") return "可預約";
  if (value === "held") return "保留中";
  if (value === "booked") return "已被預約";
  if (value === "cancelled") return "已取消";
  return "未指定";
}

export function formatTwd(value?: number | null) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function formatHoursLabel(value: number) {
  return `${value} 小時`;
}

export function nextHourLocalValue() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
}

export function computeBookingEndAt(startAtIso: string, hoursBooked: number) {
  const start = new Date(startAtIso);
  return new Date(start.getTime() + hoursBooked * 60 * 60 * 1000).toISOString();
}

export function parseBuddyTagsInput(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,\n、，]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function buddyTagsToInput(tags: string[] | null | undefined) {
  return (tags ?? []).join("、");
}

export function recommendScore(service: BuddyServiceListItem) {
  return (
    (service.provider_profile?.is_professional_buddy ? 40 : 0) +
    (service.average_rating ?? 0) * 8 +
    service.completed_bookings * 2 +
    service.review_count +
    service.open_slots_count
  );
}

export function bookingCanBeReviewed(item: BuddyBookingFeedItem, userId: string) {
  return item.booking_status === "completed" && (item.buyer_user_id === userId || item.provider_user_id === userId);
}

export function mapBuddyCategoryToRoomCategory(category: BuddyCategory): "focus" | "life" | "share" | "hobby" {
  if (category === "focus") return "focus";
  if (category === "share") return "share";
  if (category === "hobby") return "hobby";
  return "life";
}
