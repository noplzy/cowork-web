export type ProfileVisibility = "public" | "members" | "friends";
export type RoomCategory = "focus" | "life" | "share" | "hobby";
export type ActiveRoomScene = RoomCategory;
export type InteractionStyle = "silent" | "light-chat" | "guided" | "open-share";
export type ScheduleVisibility = "public" | "members" | "friends" | "invited";
export type RoomSceneTheme = ActiveRoomScene;

export type PublicProfileRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  tags: string[] | null;
  visibility: ProfileVisibility;
  accepting_friend_requests: boolean;
  accepting_schedule_invites: boolean;
  show_upcoming_schedule: boolean;
  is_professional_buddy: boolean;
  created_at: string;
  updated_at: string;
};

export type PrivateProfileSettingsRow = {
  user_id: string;
  notify_friend_requests: boolean;
  notify_schedule_updates: boolean;
  notify_room_reminders: boolean;
  payment_card_brand: string | null;
  payment_card_last4: string | null;
  created_at: string;
  updated_at: string;
};

export const PROFILE_VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string }> = [
  { value: "public", label: "公開可見" },
  { value: "members", label: "僅 VIP 會員可見" },
  { value: "friends", label: "僅自己與好友可見" },
];

export const ROOM_CATEGORY_OPTIONS: Array<{ value: RoomCategory; label: string; desc: string }> = [
  { value: "focus", label: "專注任務", desc: "共工、讀書、寫作、任務陪跑" },
  { value: "life", label: "生活陪伴", desc: "家務、煮菜、收納、帶小孩時的低壓力同行" },
  { value: "share", label: "主題分享", desc: "某個主題的交流、經驗交換、作品分享" },
  { value: "hobby", label: "興趣同好", desc: "手作、運動、畫圖、共同興趣" },
];

export const ACTIVE_ROOM_SCENE_OPTIONS: Array<{ value: ActiveRoomScene; label: string; desc: string }> =
  ROOM_CATEGORY_OPTIONS;

export const INTERACTION_STYLE_OPTIONS: Array<{ value: InteractionStyle; label: string }> = [
  { value: "silent", label: "安靜同行" },
  { value: "light-chat", label: "輕聊天" },
  { value: "guided", label: "房主引導" },
  { value: "open-share", label: "開放分享" },
];

export const SCHEDULE_VISIBILITY_OPTIONS: Array<{ value: ScheduleVisibility; label: string }> = [
  { value: "public", label: "公開" },
  { value: "members", label: "VIP 會員可見" },
  { value: "friends", label: "好友可見" },
  { value: "invited", label: "邀請制" },
];

export const INSTANT_ROOM_DURATION_OPTIONS = [25, 50, 75, 100] as const;
export const SCHEDULE_DURATION_OPTIONS = [25, 50, 75, 100] as const;
export const SCHEDULE_SEAT_LIMIT_OPTIONS = [2, 4, 6] as const;

export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);
}

export function deriveDisplayName(user: { email?: string | null; user_metadata?: Record<string, any> | null }) {
  const metadata = user.user_metadata ?? {};
  const fromMetadata =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    metadata.preferred_username;

  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata.trim().slice(0, 40);
  }

  const emailPrefix = (user.email ?? "").split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix.slice(0, 40);
  }

  return "安感島使用者";
}

export function buildDefaultHandle(userId: string, seed?: string | null) {
  const normalizedSeed = normalizeHandle(seed ?? "");
  if (normalizedSeed) {
    return `${normalizedSeed.slice(0, 20)}-${userId.slice(0, 6)}`;
  }
  return `islander-${userId.slice(0, 8)}`;
}

export function parseTagsInput(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 24)),
    ),
  ).slice(0, 8);
}

export function tagsToInput(tags?: string[] | null) {
  return (tags ?? []).join(", ");
}

export function formatPhoneForHumans(phone?: string | null) {
  if (!phone) return "尚未綁定";
  if (/^\+8869\d{8}$/.test(phone)) {
    return `0${phone.slice(4)}`;
  }
  return phone;
}

export function formatPaymentSummary(brand?: string | null, last4?: string | null) {
  if (!brand || !last4) return "尚未綁定付款方式";
  return `${brand.toUpperCase()} •••• ${last4}`;
}

export function isActiveRoomScene(value?: string | null): value is ActiveRoomScene {
  return value === "focus" || value === "life" || value === "share" || value === "hobby";
}

export function normalizeRoomCategoryForUi(value?: string | null): ActiveRoomScene {
  if (isActiveRoomScene(value)) return value;
  if (value === "support" || value === "life") return "life";
  if (value === "pro") return "share";
  return "focus";
}

export function roomSceneThemeForCategory(value?: string | null): RoomSceneTheme {
  return normalizeRoomCategoryForUi(value);
}

export function labelForRoomCategory(value?: string | null) {
  return ROOM_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? "未分類";
}

export function labelForRoomScene(value?: string | null) {
  return ACTIVE_ROOM_SCENE_OPTIONS.find((item) => item.value === normalizeRoomCategoryForUi(value))?.label ?? "專注任務";
}

export function descForRoomScene(value?: string | null) {
  return ACTIVE_ROOM_SCENE_OPTIONS.find((item) => item.value === normalizeRoomCategoryForUi(value))?.desc ?? "共工、讀書、寫作、任務陪跑";
}

export function labelForInteractionStyle(value?: string | null) {
  return INTERACTION_STYLE_OPTIONS.find((item) => item.value === value)?.label ?? "未指定";
}

export function labelForVisibility(value?: string | null) {
  return SCHEDULE_VISIBILITY_OPTIONS.find((item) => item.value === value)?.label ?? "未指定";
}

export function formatDateTimeRange(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return "時間待補";
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} ～ ${end.toLocaleString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatDurationLabel(minutes: number) {
  return `${minutes} 分鐘`;
}

export function sortFriendPair(userA: string, userB: string) {
  return userA < userB
    ? { user_low: userA, user_high: userB }
    : { user_low: userB, user_high: userA };
}

export function toDatetimeLocalValue(iso?: string | null) {
  const target = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(target.getTime() - target.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
