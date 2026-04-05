import type { PublicProfileRow } from "@/lib/socialProfile";

export const BUDDIES_BUILD_TAG = "buddies-v2-2026-04-06";

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
};

export type BuddyBookingRow = {
  id: string;
  service_id: string;
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
  > | null;
  buyer_profile: PublicProfilePreview | null;
  provider_profile: PublicProfilePreview | null;
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
  status: BuddyServiceStatus;
};

export const BUDDY_CATEGORY_OPTIONS: Array<{
  value: BuddyCategory;
  label: string;
  desc: string;
  sampleTags: string[];
}> = [
  {
    value: "focus",
    label: "專注陪伴",
    desc: "讀書、寫作、備考、工作陪跑、報告衝刺。",
    sampleTags: ["讀書", "寫作", "備考", "工作陪跑", "報告衝刺"],
  },
  {
    value: "life",
    label: "生活陪伴",
    desc: "煮飯、家務、整理房間、逛街、陪診。",
    sampleTags: ["煮飯", "家務", "整理房間", "逛街", "陪診"],
  },
  {
    value: "sports",
    label: "運動健身",
    desc: "跑步、健身、瑜伽、打球、爬山。",
    sampleTags: ["跑步", "健身", "瑜伽", "打球", "爬山"],
  },
  {
    value: "hobby",
    label: "興趣同好",
    desc: "遊戲、電影、攝影、手作、閱讀、二次元。",
    sampleTags: ["遊戲", "電影", "攝影", "手作", "閱讀"],
  },
  {
    value: "share",
    label: "主題交流",
    desc: "育兒心得、工作分享、留學經驗、作品交流。",
    sampleTags: ["育兒", "工作分享", "留學", "作品交流", "語言練習"],
  },
  {
    value: "support",
    label: "情感支持",
    desc: "深夜傾訴、解壓聊天、情緒陪伴。",
    sampleTags: ["深夜聊天", "解壓", "情緒陪伴", "樹洞", "失眠陪伴"],
  },
  {
    value: "travel",
    label: "旅行出遊",
    desc: "短途旅行、拍照打卡、城市探索、行程規劃。",
    sampleTags: ["短途旅行", "拍照打卡", "城市探索", "行程規劃", "旅伴"],
  },
];

export const BUDDY_VISIBILITY_OPTIONS: Array<{ value: BuddyServiceVisibility; label: string }> = [
  { value: "public", label: "公開可見" },
  { value: "members", label: "VIP 會員可見" },
  { value: "friends", label: "好友可見" },
];

export const BUDDY_DELIVERY_MODE_OPTIONS: Array<{ value: BuddyDeliveryMode; label: string; desc: string }> = [
  { value: "remote", label: "線上", desc: "在安感島 Rooms 或站內排程完成" },
  { value: "in_person", label: "線下", desc: "保留給未來線下同行 / 出遊 / 陪診等服務" },
  { value: "hybrid", label: "線上＋線下", desc: "先線上溝通，再視需求安排線下" },
];

export const BUDDY_INTERACTION_OPTIONS: Array<{ value: BuddyInteractionStyle; label: string }> = [
  { value: "silent", label: "安靜同行" },
  { value: "light-chat", label: "輕聊天" },
  { value: "guided", label: "引導型" },
  { value: "open-share", label: "開放分享" },
];

export const BUDDY_SERVICE_STATUS_OPTIONS: Array<{ value: BuddyServiceStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "上架中" },
  { value: "paused", label: "暫停接單" },
  { value: "archived", label: "已封存" },
];

export const BUDDY_HOUR_OPTIONS = [1, 2, 3, 4] as const;

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

export function isBuddyBookingStatus(value: string): value is BuddyBookingStatus {
  return ["pending", "accepted", "declined", "cancelled", "completed"].includes(value);
}

export function isBuddyPaymentStatus(value: string): value is BuddyPaymentStatus {
  return value === "unpaid" || value === "paid" || value === "refunded";
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

export function bookingStatusLabel(value: BuddyBookingStatus) {
  switch (value) {
    case "pending":
      return "待回覆";
    case "accepted":
      return "已接受";
    case "declined":
      return "已婉拒";
    case "cancelled":
      return "已取消";
    case "completed":
      return "已完成";
    default:
      return value;
  }
}

export function paymentStatusLabel(value: BuddyPaymentStatus) {
  switch (value) {
    case "unpaid":
      return "未付款";
    case "paid":
      return "已付款";
    case "refunded":
      return "已退款";
    default:
      return value;
  }
}

export function buddyServiceStatusLabel(value: BuddyServiceStatus) {
  return BUDDY_SERVICE_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function formatTwd(value?: number | null) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatHoursLabel(hours: number) {
  return `${hours} 小時`;
}

export function nextHourLocalValue(offsetHours = 24) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function computeBookingEndAt(startAt: string, hoursBooked: number) {
  const start = new Date(startAt);
  return new Date(start.getTime() + hoursBooked * 60 * 60 * 1000).toISOString();
}

export function safeTrim(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

export function parseBuddyTagsInput(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 24)),
    ),
  ).slice(0, 10);
}

export function buddyTagsToInput(tags?: string[] | null) {
  return (tags ?? []).join(", ");
}
