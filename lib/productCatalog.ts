export const PRODUCT_CATALOG_BUILD_TAG =
  "product-catalog-rooms-299-pilot-v130-2026-07-20";

const ROOMS_299_PUBLIC_PILOT_ENABLED = ["1", "true", "yes", "enabled"].includes(
  String(process.env.NEXT_PUBLIC_PRICING_V2_ROOMS_299_ENABLED || "")
    .trim()
    .toLowerCase(),
);

export type ProductStage =
  | "production_pilot"
  | "pricing_v2_final_spec"
  | "future_extension";

export type PurchaseStatus = "active" | "planned" | "blocked";
export type BillingMode = "free" | "one_time" | "subscription" | "add_on";
export type ProductModule = "rooms" | "buddies" | "host";

export type AudienceSegment =
  | "curious_free"
  | "rooms_regular"
  | "buddies_professional"
  | "whole_site_regular"
  | "host_operator"
  | "operator_manual";

export type PlanCode =
  | "free"
  | "vip_month"
  | "rooms_unlimited_299"
  | "buddies_pro_399"
  | "whole_site_599"
  | "host_999";

export type AddOnCode =
  | "extension_points_30"
  | "extension_points_60"
  | "extension_points_120"
  | "visual_minutes_future";

export type PresenceModeCode = "quiet" | "audio" | "mosaic" | "camera";
export type RoomCategoryCode = "focus" | "life" | "share" | "hobby";
export type RoomDurationKind = "general" | "activity";

export type RoomDurationPolicy = {
  generalDurations: number[];
  activityDuration: number;
  deprecatedDurations: number[];
  extensionMinutes: number;
  durationLabels: Record<number, string>;
  roomCategoryLabels: Record<RoomCategoryCode, string>;
  presenceModeLabels: Record<PresenceModeCode, string>;
};

export type ProductPlan = {
  code: PlanCode;
  stage: ProductStage;
  purchaseStatus: PurchaseStatus;
  billingMode: BillingMode;
  title: string;
  shortTitle: string;
  priceLabel: string;
  amountTwd: number | null;
  entitlementDays: number | null;
  autoRenew: boolean;
  checkoutPlanCode: string | null;
  purchaseEnabled: boolean;
  description: string;
  benefits: string[];
  amount: number | null;
  invoiceItemName: string;
  tradeDescription: string;
  audience: AudienceSegment;
  modules: ProductModule[];
  positioning: string;
  jobToBeDone: string;
  primaryValue: string;
  valueMetric: string;
  upgradeTrigger: string;
  antiCannibalizationFence: string;
  disabledReason?: string;
  userFriendlyNotice: string;
  allowedGeneralDurations: number[];
  allowedActivityDurations: number[];
  canCreateGeneralRooms: boolean;
  canCreateActivityRooms: boolean;
  presenceModes: PresenceModeCode[];
  roomVisibility: Array<"public" | "members" | "friends" | "invited">;
  personalRoomTimeUnlimited: boolean;
  quietAudioUnlimited: boolean;
  visualMinutesIncluded: number | null;
  extensionPointsIncluded: number;
  priorityWaitlistUses: number;
  trackedBuddies: number;
  maxBuddyServices: number;
  exposureCredits: number;
  buddyAnalyticsWindowDays: number | null;
  roomExtensionPolicy: string;
  highlights: string[];
  supportSummary: string;
};

export type ProductAddOn = {
  code: AddOnCode;
  stage: ProductStage;
  purchaseStatus: PurchaseStatus;
  title: string;
  priceLabel: string;
  amountTwd: number | null;
  invoiceItemName: string;
  positioning: string;
  extensionPoints?: number;
  disabledReason?: string;
};

export const AI_PRICING_POLICY = {
  status: "long_term_freeze",
  includedInPricing: false,
  includedInEntitlements: false,
  includedInAddOns: false,
  commercialReleaseEnabled: false,
  publicMessage:
    "AI 功能維持長期凍結，不納入 Free、Rooms、Buddies、全站同行、主理人或任何加購商品。",
} as const;

export const PRICING_V2_POLICY = {
  status: ROOMS_299_PUBLIC_PILOT_ENABLED
    ? "rooms_299_controlled_pilot"
    : "final_spec_not_purchasable",
  commercialLaunchEnabled: ROOMS_299_PUBLIC_PILOT_ENABLED,
  rooms299ControlledPilotEnabled: ROOMS_299_PUBLIC_PILOT_ENABLED,
  sourceDocument: "CALMCO_PRICING_V2_FINAL_HANDOFF_2026-07-18",
  productionPaidPlanCode: "vip_month" as const,
  productionPaidPlanCodes: ROOMS_299_PUBLIC_PILOT_ENABLED
    ? (["vip_month", "rooms_unlimited_299"] as const)
    : (["vip_month"] as const),
  finalPlanCodes: [
    "rooms_unlimited_299",
    "buddies_pro_399",
    "whole_site_599",
    "host_999",
  ] as const,
  launchRule:
    "P2 僅允許 Rooms 299 受控試營運；Buddies 399、全站 599、主理人 999 必須等待 P3 payment／payout／settlement。",
} as const;

export const ROOM_DURATION_POLICY: RoomDurationPolicy = {
  generalDurations: [25, 50, 75],
  activityDuration: 90,
  deprecatedDurations: [100],
  extensionMinutes: 25,
  durationLabels: {
    25: "25 分鐘｜開始場 / 短場",
    50: "50 分鐘｜標準場 / 主力場",
    75: "75 分鐘｜長場 / 深度場",
    90: "90 分鐘｜活動房",
    100: "100 分鐘｜舊版，不再提供",
  },
  roomCategoryLabels: {
    focus: "專注任務",
    life: "生活陪伴",
    share: "主題分享",
    hobby: "興趣同好",
  },
  presenceModeLabels: {
    quiet: "安靜在場",
    audio: "音訊在場",
    mosaic: "柔焦在場",
    camera: "開鏡頭在場",
  },
};

export const ROOM_CATEGORIES = [
  {
    code: "focus",
    value: "focus",
    label: "專注任務",
    description: "共工、讀書、寫作、任務陪跑",
  },
  {
    code: "life",
    value: "life",
    label: "生活陪伴",
    description: "家務、煮菜、收納、日常陪伴",
  },
  {
    code: "share",
    value: "share",
    label: "主題分享",
    description: "主題交流、經驗交換、作品分享",
  },
  {
    code: "hobby",
    value: "hobby",
    label: "興趣同好",
    description: "手作、運動、畫圖、共同興趣",
  },
] as const;

export const ROOM_CATEGORY_OPTIONS = ROOM_CATEGORIES;
export const ROOM_CATEGORY_CODES = ROOM_CATEGORIES.map(
  (item) => item.code,
) as RoomCategoryCode[];

export const PRESENCE_MODES = [
  {
    code: "quiet",
    value: "quiet",
    label: "安靜在場",
    description: "鏡頭與麥克風都可關閉，仍保有 connected presence。",
  },
  {
    code: "audio",
    value: "audio",
    label: "音訊在場",
    description: "不送出視訊軌，保留低壓力聲音連結。",
  },
  {
    code: "mosaic",
    value: "mosaic",
    label: "柔焦在場",
    description: "以柔焦／馬賽克降低鏡頭壓力，屬視覺同行額度。",
  },
  {
    code: "camera",
    value: "camera",
    label: "開鏡頭在場",
    description: "一般視訊在場，屬視覺同行額度。",
  },
] as const;

export const PRESENCE_MODE_OPTIONS = PRESENCE_MODES;
export const GENERAL_ROOM_DURATIONS = ROOM_DURATION_POLICY.generalDurations;
export const ACTIVITY_ROOM_DURATION = ROOM_DURATION_POLICY.activityDuration;
export const DEPRECATED_ROOM_DURATIONS = ROOM_DURATION_POLICY.deprecatedDurations;
export const ROOM_DURATIONS = [
  ...GENERAL_ROOM_DURATIONS,
  ACTIVITY_ROOM_DURATION,
] as const;
export const GROUP_SIZE_OPTIONS = [2, 4, 6] as const;

export const VALUE_BASED_PRICING_PRINCIPLES = [
  "Rooms 與 Buddies 分開販售；NT$599 是 NT$299 Rooms＋NT$399 Buddies 的組合，不是單純堆高 Rooms 分鐘。",
  "Rooms 方案的『無限』只包含會員自己的總使用時間、安靜在場與純音訊；鏡頭、柔焦及螢幕分享使用獨立視覺額度。",
  "1 點同行延長點，只替 1 位沒有 Rooms 權益的使用者延長 25 分鐘；付費會員自己的延長不扣點。",
  "收藏、再次預約、標準候補、預約保障、真實評價、檢舉與退款入口是平台基礎功能，不拿來製造付費焦慮。",
  ROOMS_299_PUBLIC_PILOT_ENABLED
    ? "目前可付款商品為 NT$199 一次性 VIP 與受控 Rooms 299 訂閱；Buddies 399／全站 599／主理人 999 仍鎖住。"
    : "所有新方案目前都是 Pricing v2 最終規格，尚未開放付款；production 仍只允許 NT$199／30 天一次性 VIP 試營運。",
  AI_PRICING_POLICY.publicMessage,
] as const;

const commonRoomVisibility: ProductPlan["roomVisibility"] = [
  "public",
  "members",
  "friends",
  "invited",
];

export const PRODUCT_PLANS: ProductPlan[] = [
  {
    code: "free",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "planned",
    billingMode: "free",
    title: "免費體驗",
    shortTitle: "Free",
    priceLabel: "NT$0",
    amountTwd: 0,
    entitlementDays: null,
    autoRenew: false,
    checkoutPlanCode: null,
    purchaseEnabled: false,
    description: "先正常體驗 Rooms 與 Buddies 的基礎價值。",
    benefits: [
      "加入公開 25 分鐘房",
      "安靜／音訊在場",
      "標準 Buddies 搜尋、收藏、候補與評價",
      "安全、檢舉、封鎖、退款與爭議入口",
    ],
    amount: 0,
    invoiceItemName: "安感島免費體驗",
    tradeDescription: "ANGANDAO Free",
    audience: "curious_free",
    modules: ["rooms", "buddies"],
    positioning: "不把平台本來就該提供的信任與基礎功能鎖成付費權益。",
    jobToBeDone: "我想先確認這裡真的適合我，再決定是否固定使用。",
    primaryValue: "完成第一次正常 Rooms／Buddies 體驗。",
    valueMetric: "首次進房、首次收藏、首次完成預約。",
    upgradeTrigger: "需要私人房、更多房型、無限安靜／音訊或專業 Buddies 工具。",
    antiCannibalizationFence: "不含私人建房、活動房建立、專業曝光與經營數據。",
    disabledReason: "Free 的每月 Rooms 上限仍需依 P0 真實 participant-minute 資料封板。",
    userFriendlyNotice: "免費方案規格已定義，實際每月 Rooms 上限會在正式切換前公告。",
    allowedGeneralDurations: [25],
    allowedActivityDurations: [],
    canCreateGeneralRooms: false,
    canCreateActivityRooms: false,
    presenceModes: ["quiet", "audio"],
    roomVisibility: ["public"],
    personalRoomTimeUnlimited: false,
    quietAudioUnlimited: false,
    visualMinutesIncluded: null,
    extensionPointsIncluded: 0,
    priorityWaitlistUses: 0,
    trackedBuddies: 0,
    maxBuddyServices: 2,
    exposureCredits: 0,
    buddyAnalyticsWindowDays: null,
    roomExtensionPolicy: "可接受其他 Rooms 會員贊助，但 Free 本身不含延長點。",
    highlights: [
      "公開 25 分鐘房",
      "安靜／音訊在場",
      "Buddies 基礎服務",
      "信任與客服底線",
    ],
    supportSummary: "免費使用者仍有正常安全、退款、爭議與客服入口。",
  },
  {
    code: "vip_month",
    stage: "production_pilot",
    purchaseStatus: "active",
    billingMode: "one_time",
    title: "VIP 月方案（試營運）",
    shortTitle: "VIP 試營運",
    priceLabel: "NT$199 / 30 天",
    amountTwd: 199,
    entitlementDays: 30,
    autoRenew: false,
    checkoutPlanCode: "vip_month",
    purchaseEnabled: true,
    description: "目前唯一正式可付款商品；一次性付款，不自動續扣。",
    benefits: [
      "一次性信用卡付款",
      "付款成功後開通 30 天 VIP",
      "不自動續扣",
      "人工退款與帳務追蹤",
    ],
    amount: 199,
    invoiceItemName: "安感島 VIP 月方案（試營運）",
    tradeDescription: "ANGANDAO VIP Pilot Monthly",
    audience: "operator_manual",
    modules: ["rooms"],
    positioning: "維持既有付款閉環，直到 Pricing v2 全鏈路準備完成。",
    jobToBeDone: "我想先支持或測試目前已完成的 VIP 付款與權益流程。",
    primaryValue: "30 天既有 VIP 權益與人工客服保障。",
    valueMetric: "付款成功、權益入帳、發票／退款可追蹤。",
    upgradeTrigger: "Pricing v2 正式開放後再選擇 Rooms、Buddies 或組合方案。",
    antiCannibalizationFence: "不承諾 Pricing v2 的視覺額度、延長點、Buddies 專業或主理人工具。",
    userFriendlyNotice: "目前唯一可付款方案；Pricing v2 卡片僅供理解下一版方向。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [],
    canCreateGeneralRooms: true,
    canCreateActivityRooms: false,
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: commonRoomVisibility,
    personalRoomTimeUnlimited: false,
    quietAudioUnlimited: false,
    visualMinutesIncluded: null,
    extensionPointsIncluded: 0,
    priorityWaitlistUses: 0,
    trackedBuddies: 0,
    maxBuddyServices: 2,
    exposureCredits: 0,
    buddyAnalyticsWindowDays: null,
    roomExtensionPolicy: "沿用目前 VIP／room lifecycle 規則，不提前承諾 Pricing v2 延長點。",
    highlights: [
      "目前正式可付款",
      "30 天 VIP",
      "不自動續扣",
      "帳務與退款可追蹤",
    ],
    supportSummary: "權益未生效、重複扣款或退款問題由既有 Billing Center 與人工流程承接。",
  },
  {
    code: "rooms_unlimited_299",
    stage: "pricing_v2_final_spec",
    purchaseStatus: ROOMS_299_PUBLIC_PILOT_ENABLED ? "active" : "planned",
    billingMode: "subscription",
    title: "Rooms 無限同行",
    shortTitle: "Rooms 299",
    priceLabel: "NT$299 / 月",
    amountTwd: 299,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: ROOMS_299_PUBLIC_PILOT_ENABLED
      ? "rooms_unlimited_299"
      : null,
    purchaseEnabled: ROOMS_299_PUBLIC_PILOT_ENABLED,
    description: "會員自己的 Rooms 總時間、安靜在場與純音訊無限。",
    benefits: [
      "個人 Rooms 總時間無限",
      "安靜／純音訊無限",
      "每月 1,200 分鐘視覺同行",
      "每月 12 點同行延長點",
    ],
    amount: 299,
    invoiceItemName: "安感島 Rooms 無限同行月方案",
    tradeDescription: "ANGANDAO Rooms Unlimited Monthly",
    audience: "rooms_regular",
    modules: ["rooms"],
    positioning: "給固定讀書、工作、body doubling 與日常陪伴使用者。",
    jobToBeDone: "我想長時間待在 Rooms，不希望安靜或純音訊被月時數切斷。",
    primaryValue: "無限低成本 presence＋可控視覺額度。",
    valueMetric: "個人 Rooms 使用時間、視覺分鐘、成功完成場次。",
    upgradeTrigger: "同時需要 Buddies 專業，或需要建立活動房與房主經營工具。",
    antiCannibalizationFence: "不能建立 90 分鐘活動房，不含 Buddies 專業與全房無限贊助。",
    disabledReason: ROOMS_299_PUBLIC_PILOT_ENABLED
      ? undefined
      : "需完成 P2 migration、wallet、recurring callback 與 staging E2E，並同時開啟 public/server feature gate。",
    userFriendlyNotice: ROOMS_299_PUBLIC_PILOT_ENABLED
      ? "Rooms 299 受控試營運已開放；付款前請確認自動續扣、取消與額度規則。"
      : "Pricing v2 最終規格，尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [90],
    canCreateGeneralRooms: true,
    canCreateActivityRooms: false,
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: commonRoomVisibility,
    personalRoomTimeUnlimited: true,
    quietAudioUnlimited: true,
    visualMinutesIncluded: 1200,
    extensionPointsIncluded: 12,
    priorityWaitlistUses: 0,
    trackedBuddies: 0,
    maxBuddyServices: 2,
    exposureCredits: 0,
    buddyAnalyticsWindowDays: null,
    roomExtensionPolicy: "會員本人延長不扣點；每 1 點替 1 位非 Rooms 會員延長 25 分鐘。",
    highlights: [
      "個人時間無限",
      "安靜／音訊無限",
      "1,200 分鐘視覺額度",
      "12 點同行延長點",
    ],
    supportSummary: "需顯示視覺分鐘、延長點、房間歷史與異常扣用量的可回查紀錄。",
  },
  {
    code: "buddies_pro_399",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "Buddies 專業",
    shortTitle: "Buddies 399",
    priceLabel: "NT$399 / 月",
    amountTwd: 399,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    purchaseEnabled: false,
    description: "給重度預約者與在平台經營服務的 Buddy。",
    benefits: [
      "每月 5 次優先候補",
      "追蹤 3 位重點 Buddy",
      "最多上架 10 項服務",
      "90 天經營數據＋每月 1 枚曝光點數",
    ],
    amount: 399,
    invoiceItemName: "安感島 Buddies 專業月方案",
    tradeDescription: "ANGANDAO Buddies Pro Monthly",
    audience: "buddies_professional",
    modules: ["buddies"],
    positioning: "不要求服務提供者替不需要的 Rooms 權益付費。",
    jobToBeDone: "我想提高熱門時段預約成功率，或更有效率經營自己的服務。",
    primaryValue: "有限優先候補、服務上架、真實數據與透明推薦曝光。",
    valueMetric: "候補使用、服務轉換、回購、完成率與收入趨勢。",
    upgradeTrigger: "同時需要 Rooms 無限，或需要年度數據、活動房與主理人工具。",
    antiCannibalizationFence: "Rooms 僅維持 Free 等級；不含活動房、主持控制台或年度商業報表。",
    disabledReason: "需等 Buddies payment／payout／settlement、通知排序與曝光標示規則閉環。",
    userFriendlyNotice: "Pricing v2 最終規格，尚未開放付款。",
    allowedGeneralDurations: [25],
    allowedActivityDurations: [],
    canCreateGeneralRooms: false,
    canCreateActivityRooms: false,
    presenceModes: ["quiet", "audio"],
    roomVisibility: ["public"],
    personalRoomTimeUnlimited: false,
    quietAudioUnlimited: false,
    visualMinutesIncluded: null,
    extensionPointsIncluded: 0,
    priorityWaitlistUses: 5,
    trackedBuddies: 3,
    maxBuddyServices: 10,
    exposureCredits: 1,
    buddyAnalyticsWindowDays: 90,
    roomExtensionPolicy: "維持 Free Rooms 等級。",
    highlights: [
      "5 次優先候補",
      "追蹤 3 位 Buddy",
      "10 項服務",
      "90 天數據＋1 枚曝光",
    ],
    supportSummary: "優先候補不保證成交；曝光必須標示推薦／贊助，不能偽裝自然排序。",
  },
  {
    code: "whole_site_599",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "全站同行",
    shortTitle: "全站 599",
    priceLabel: "NT$599 / 月",
    amountTwd: 599,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    purchaseEnabled: false,
    description: "Rooms 299＋Buddies 399 的組合方案，每月比拆買省 NT$99。",
    benefits: [
      "Rooms 無限同行完整權益",
      "Buddies 專業完整權益",
      "每月 1,800 分鐘視覺同行",
      "24 點延長、6 次候補、追蹤 5 位 Buddy",
    ],
    amount: 599,
    invoiceItemName: "安感島 全站同行月方案",
    tradeDescription: "ANGANDAO Whole Site Monthly",
    audience: "whole_site_regular",
    modules: ["rooms", "buddies"],
    positioning: "組合優惠，不把只需要 Rooms 的人強迫推向高價方案。",
    jobToBeDone: "我同時固定使用 Rooms，也經常預約或經營 Buddies。",
    primaryValue: "兩條產品線完整組合＋較高額度。",
    valueMetric: "Rooms 留存＋Buddies 預約／經營轉換。",
    upgradeTrigger: "需要建立活動房、全房贊助、主持控制台與完整年度商業數據。",
    antiCannibalizationFence: "不能建立 90 分鐘活動房，不含房主控制台與大量贊助。",
    disabledReason: "需同時通過 Rooms P0、Buddies settlement、訂閱、發票、退款與 entitlement E2E。",
    userFriendlyNotice: "Pricing v2 最終規格，尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [90],
    canCreateGeneralRooms: true,
    canCreateActivityRooms: false,
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: commonRoomVisibility,
    personalRoomTimeUnlimited: true,
    quietAudioUnlimited: true,
    visualMinutesIncluded: 1800,
    extensionPointsIncluded: 24,
    priorityWaitlistUses: 6,
    trackedBuddies: 5,
    maxBuddyServices: 10,
    exposureCredits: 1,
    buddyAnalyticsWindowDays: 90,
    roomExtensionPolicy: "會員本人延長不扣點；每月 24 點可贊助非 Rooms 會員。",
    highlights: [
      "299＋399 完整組合",
      "每月省 NT$99",
      "1,800 分鐘視覺額度",
      "24 點延長＋6 次候補",
    ],
    supportSummary: "客服需同時能看 Rooms 用量、Buddies 權益、訂閱、發票與退款事件。",
  },
  {
    code: "host_999",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "主理人",
    shortTitle: "主理人 999",
    priceLabel: "NT$999 / 月",
    amountTwd: 999,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    purchaseEnabled: false,
    description: "販售帶人、辦活動與經營服務的能力，不只是堆高分鐘。",
    benefits: [
      "可建立 90 分鐘活動房",
      "每月 3,000 分鐘視覺同行＋120 點延長",
      "房主控制台與使用量紀錄",
      "25 項服務、年度數據、3 枚曝光點數",
    ],
    amount: 999,
    invoiceItemName: "安感島 主理人月方案",
    tradeDescription: "ANGANDAO Host Operator Monthly",
    audience: "host_operator",
    modules: ["rooms", "buddies", "host"],
    positioning: "給社群、讀書會、活動房主與重度 Buddies 經營者。",
    jobToBeDone: "我要固定帶人、辦活動，並能看懂房間與服務經營結果。",
    primaryValue: "活動房、全房贊助、主持控制台與完整商業資料。",
    valueMetric: "活動完成率、贊助成本、回購、客單與服務收入。",
    upgradeTrigger: "未來需要團隊成員、服務套票、團體銷售與進階 CRM。",
    antiCannibalizationFence: "仍不提供全房無限贊助；所有延長與視覺使用都必須有 server ledger。",
    disabledReason: "需等活動房、全房贊助 ledger、主持控制台、Buddies settlement 與風控完成。",
    userFriendlyNotice: "Pricing v2 最終規格，尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [90],
    canCreateGeneralRooms: true,
    canCreateActivityRooms: true,
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: commonRoomVisibility,
    personalRoomTimeUnlimited: true,
    quietAudioUnlimited: true,
    visualMinutesIncluded: 3000,
    extensionPointsIncluded: 120,
    priorityWaitlistUses: 10,
    trackedBuddies: 10,
    maxBuddyServices: 25,
    exposureCredits: 3,
    buddyAnalyticsWindowDays: 365,
    roomExtensionPolicy: "可贊助 2／4／6 人房，但每位非 Rooms 會員每 25 分鐘仍需 1 點。",
    highlights: [
      "建立 90 分鐘活動房",
      "3,000 分鐘視覺額度",
      "120 點同行延長",
      "房主＋Buddies 年度工具",
    ],
    supportSummary: "高風險多人與交易能力必須有 admin audit、成本上限、停權與人工修正。",
  },
];

export const PRODUCT_ADD_ONS: ProductAddOn[] = [
  {
    code: "extension_points_30",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "blocked",
    title: "30 點同行延長點",
    priceLabel: "NT$119",
    amountTwd: 119,
    invoiceItemName: "安感島 30 點同行延長點",
    positioning: "偶爾帶朋友或小房延長。",
    extensionPoints: 30,
    disabledReason: "需等 extension confirmation、wallet、ledger、refund 與 idempotency 完成。",
  },
  {
    code: "extension_points_60",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "blocked",
    title: "60 點同行延長點",
    priceLabel: "NT$219",
    amountTwd: 219,
    invoiceItemName: "安感島 60 點同行延長點",
    positioning: "規律替多人房延長。",
    extensionPoints: 60,
    disabledReason: "需等 extension confirmation、wallet、ledger、refund 與 idempotency 完成。",
  },
  {
    code: "extension_points_120",
    stage: "pricing_v2_final_spec",
    purchaseStatus: "blocked",
    title: "120 點同行延長點",
    priceLabel: "NT$429",
    amountTwd: 429,
    invoiceItemName: "安感島 120 點同行延長點",
    positioning: "活動或重度房主使用。",
    extensionPoints: 120,
    disabledReason: "需等 extension confirmation、wallet、ledger、refund 與 idempotency 完成。",
  },
  {
    code: "visual_minutes_future",
    stage: "future_extension",
    purchaseStatus: "blocked",
    title: "視覺同行額度",
    priceLabel: "尚未定價",
    amountTwd: null,
    invoiceItemName: "安感島 視覺同行額度",
    positioning: "額度用完後仍可無限使用安靜／純音訊；視覺加購待真實成本資料封板。",
    disabledReason: "分鐘數、售價、效期與退款規則尚未定案。",
  },
];

export const ACTIVE_PURCHASABLE_PLANS = PRODUCT_PLANS.filter(
  (plan) =>
    plan.purchaseStatus === "active" &&
    plan.purchaseEnabled &&
    Boolean(plan.checkoutPlanCode) &&
    plan.amountTwd !== null,
);

export const ACTIVE_PURCHASABLE_PLAN = PRODUCT_PLANS.find(
  (plan) => plan.code === "vip_month",
)!;

export function getProductPlan(code: string | null | undefined) {
  return PRODUCT_PLANS.find((plan) => plan.code === code);
}

export function getPurchasablePlan(code: string | null | undefined) {
  const plan = getProductPlan(code);

  if (
    !plan ||
    plan.purchaseStatus !== "active" ||
    !plan.purchaseEnabled ||
    !plan.checkoutPlanCode ||
    plan.amountTwd === null
  ) {
    throw new Error("這個方案尚未開放付款。");
  }

  return plan;
}

export function resolveCheckoutProductPlan(
  code: string | null | undefined,
) {
  return getPurchasablePlan(code);
}

export function isGeneralRoomDuration(duration: number) {
  return ROOM_DURATION_POLICY.generalDurations.includes(duration);
}

export function isAllowedGeneralRoomDuration(duration: number) {
  return isGeneralRoomDuration(Number(duration));
}

export function isActivityRoomDuration(duration: number) {
  return duration === ROOM_DURATION_POLICY.activityDuration;
}

export function normalizeGroupSize(
  value: unknown,
  mode?: "pair" | "group" | string | null,
) {
  if (mode === "pair") return 2;

  const numeric = Number(value);
  return GROUP_SIZE_OPTIONS.includes(numeric as 2 | 4 | 6) ? numeric : 4;
}

export function isRoomCategory(
  value: unknown,
): value is RoomCategoryCode {
  return ROOM_CATEGORY_CODES.includes(value as RoomCategoryCode);
}

export function normalizeRoomCategory(value: unknown): RoomCategoryCode {
  return isRoomCategory(value) ? value : "focus";
}

export function publicProductCatalogPayload() {
  return {
    build_tag: PRODUCT_CATALOG_BUILD_TAG,
    production_fact: {
      active_paid_plan_code: ACTIVE_PURCHASABLE_PLAN.code,
      active_paid_plan_label: ACTIVE_PURCHASABLE_PLAN.priceLabel,
      warning: ROOMS_299_PUBLIC_PILOT_ENABLED
        ? "目前開放 NT$199 一次性 VIP 與 Rooms 299 受控訂閱；399／599／999 與延長點加購仍未開放。"
        : "目前 production 只開放 NT$199／30 天一次性 VIP；NT$299／399／599／999 與延長點商品是 Pricing v2 最終規格，尚未開放付款。",
    },
    pricing_v2_policy: PRICING_V2_POLICY,
    ai_policy: AI_PRICING_POLICY,
    pricing_principles: VALUE_BASED_PRICING_PRINCIPLES,
    room_policy: ROOM_DURATION_POLICY,
    room_categories: ROOM_CATEGORIES,
    presence_modes: PRESENCE_MODES,
    plans: PRODUCT_PLANS,
    add_ons: PRODUCT_ADD_ONS,
  };
}

export function isRooms299PublicPilotEnabled() {
  return ROOMS_299_PUBLIC_PILOT_ENABLED;
}
