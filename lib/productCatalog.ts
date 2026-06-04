export const PRODUCT_CATALOG_BUILD_TAG = "product-catalog-pricing-v1083-2026-06-04";

export type ProductStage = "production_pilot" | "pricing_v2_next_spec" | "future_extension";
export type PurchaseStatus = "active" | "planned" | "blocked";
export type BillingMode = "free" | "one_time" | "subscription" | "add_on";
export type AudienceSegment =
  | "curious_free"
  | "low_pressure_regular"
  | "habit_builder"
  | "host_creator"
  | "operator_manual";

export type PlanCode =
  | "free"
  | "vip_month"
  | "companion_basic_299"
  | "companion_regular_599"
  | "host_islander_1299";

export type AddOnCode =
  | "host_credit_25"
  | "host_credit_50"
  | "host_credit_75"
  | "host_credit_90"
  | "whole_room_extension";

export type PresenceModeCode = "quiet" | "audio" | "mosaic" | "camera";
export type RoomCategoryCode = "focus" | "life" | "share" | "hobby";
export type RoomDurationKind = "general" | "activity";

export type RoomDurationPolicy = {
  generalDurations: number[];
  activityDuration: number;
  deprecatedDurations: number[];
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
  invoiceItemName: string;
  tradeDescription: string;
  audience: AudienceSegment;
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
  presenceModes: PresenceModeCode[];
  roomVisibility: Array<"public" | "members" | "friends" | "invited">;
  hostCreditsIncluded: number;
  personalAiIncluded: "none" | "light_rescue" | "limited_rescue";
  sharedHostIncluded: boolean;
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
  hostCredits?: number;
  durationMinutes?: number;
  activeCapSeconds?: number;
  disabledReason?: string;
};

export const ROOM_DURATION_POLICY: RoomDurationPolicy = {
  generalDurations: [25, 50, 75],
  activityDuration: 90,
  deprecatedDurations: [100],
  durationLabels: {
    25: "25 分鐘｜開始場 / 短場",
    50: "50 分鐘｜標準場 / 主力場",
    75: "75 分鐘｜長場 / 深度場",
    90: "90 分鐘｜活動場 / Studio",
    100: "100 分鐘｜舊版，不再主推",
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

/**
 * Backward-compatible exports.
 * Some existing pages/routes may already import these names from productCatalog.
 * Do not remove them while pricing/catalog migration is still in progress.
 */
export const ROOM_CATEGORIES = [
  { code: "focus", value: "focus", label: "專注任務", description: "共工、讀書、寫作、任務陪跑" },
  { code: "life", value: "life", label: "生活陪伴", description: "家務、煮菜、收納、日常陪伴" },
  { code: "share", value: "share", label: "主題分享", description: "主題交流、經驗交換、作品分享" },
  { code: "hobby", value: "hobby", label: "興趣同好", description: "手作、運動、畫圖、共同興趣" },
] as const;

export const ROOM_CATEGORY_OPTIONS = ROOM_CATEGORIES;

export const PRESENCE_MODES = [
  { code: "quiet", value: "quiet", label: "安靜在場", description: "不說話也能一起待著" },
  { code: "audio", value: "audio", label: "音訊在場", description: "用聲音保持輕連結" },
  { code: "mosaic", value: "mosaic", label: "柔焦在場", description: "保留在場感，但降低鏡頭壓力" },
  { code: "camera", value: "camera", label: "開鏡頭在場", description: "需要更明確在場時使用" },
] as const;

export const PRESENCE_MODE_OPTIONS = PRESENCE_MODES;

export const GENERAL_ROOM_DURATIONS = ROOM_DURATION_POLICY.generalDurations;
export const ACTIVITY_ROOM_DURATION = ROOM_DURATION_POLICY.activityDuration;
export const DEPRECATED_ROOM_DURATIONS = ROOM_DURATION_POLICY.deprecatedDurations;
export const ROOM_DURATIONS = [...GENERAL_ROOM_DURATIONS, ACTIVITY_ROOM_DURATION] as const;

export const VALUE_BASED_PRICING_PRINCIPLES = [
  "不靠限制基本陪伴製造焦慮，而是用使用深度、房主能力、AI 主持成本與活動房權限做分層。",
  "Free 讓使用者理解「有人一起」；NT$299 賣安全可控的常用權益；NT$599 賣習慣建立與 AI 主持有感；NT$1,299 賣房主、活動與帶朋友能力。",
  "高成本能力走 Host Credit / 房主贊助 / 活動包，不塞進低價月費無限使用。",
  "Personal AI 不是主賣點；Shared Host AI 才是與真人同行房結合的差異化。",
  "所有可收費能力都必須能被 billing_ledger、entitlement_events、invoice_events、refund_events 與 admin_audit_logs 追蹤。",
] as const;

export const PRODUCT_PLANS: ProductPlan[] = [
  {
    code: "free",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    billingMode: "free",
    title: "免費體驗",
    shortTitle: "Free",
    priceLabel: "NT$0",
    amountTwd: 0,
    entitlementDays: null,
    autoRenew: false,
    checkoutPlanCode: null,
    invoiceItemName: "安感島免費體驗",
    tradeDescription: "ANGANDAO Free Trial",
    audience: "curious_free",
    positioning: "先感受「有人一起開始」的氛圍。",
    jobToBeDone: "我還不確定會不會常用，但想低壓力試一次。",
    primaryValue: "基本進房與短場體驗。",
    valueMetric: "低成本體驗與公開房參與。",
    upgradeTrigger: "想建立好友房 / 邀請制房，或需要更穩定的同行節奏。",
    antiCannibalizationFence: "不給高成本活動房、完整邀請制與大量 AI Host Credit。",
    disabledReason: "免費體驗規則會在正式 Pricing v2 上線時公告。",
    userFriendlyNotice: "目前可先使用試營運 VIP 或一般同行空間；正式免費額度會另行公告。",
    allowedGeneralDurations: [25],
    allowedActivityDurations: [],
    presenceModes: ["quiet", "audio"],
    roomVisibility: ["public"],
    hostCreditsIncluded: 0,
    personalAiIncluded: "none",
    sharedHostIncluded: false,
    roomExtensionPolicy: "延長限制較嚴，避免免費額度長時間占用 RTC 成本。",
    highlights: ["公開房體驗", "短場入門", "基本 Presence Mode", "不承諾 AI 主持"],
    supportSummary: "免費體驗以低摩擦進站為主，付款與退款不適用。",
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
    invoiceItemName: "安感島 VIP 月方案（試營運）",
    tradeDescription: "ANGANDAO VIP Pilot Monthly",
    audience: "operator_manual",
    positioning: "先完成一次性付款、權益入帳、客服與退款可追蹤閉環。",
    jobToBeDone: "我想先支持或測試安感島的完整付款與 VIP 權益流程。",
    primaryValue: "30 天 VIP 權益與試營運客服保障。",
    valueMetric: "付款成功、權益入帳、帳務可稽核。",
    upgradeTrigger: "正式 Pricing v2 上線後，可依使用深度轉入 299 / 599 / 1299。",
    antiCannibalizationFence: "不承諾正式 Host Credit、AI 主持包、房主贊助或自動續扣。",
    userFriendlyNotice: "目前唯一正式開放付款的方案；一次性付款，不自動續扣。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [],
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: ["public", "members", "friends", "invited"],
    hostCreditsIncluded: 0,
    personalAiIncluded: "light_rescue",
    sharedHostIncluded: false,
    roomExtensionPolicy: "依目前 VIP 權益與 room lifecycle 規則處理；不宣稱正式房主贊助。",
    highlights: ["一次性信用卡付款", "付款成功後開通 30 天 VIP", "不自動續扣", "人工退款審核"],
    supportSummary: "若發生權益未生效、重複扣款或首次購買後未使用主要權益，可走人工退款審核。",
  },
  {
    code: "companion_basic_299",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "安心同行",
    shortTitle: "安心同行",
    priceLabel: "NT$299 / 月",
    amountTwd: 299,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    invoiceItemName: "安感島 安心同行月方案",
    tradeDescription: "ANGANDAO Companion Basic Monthly",
    audience: "low_pressure_regular",
    positioning: "入門 VIP，賣的是安全可控的低壓力陪伴，不是高成本 AI。",
    jobToBeDone: "我想比較自在地開好友房、邀請熟人、穩定有人一起開始。",
    primaryValue: "好友房 / 邀請制房與 25 / 50 / 75 一般房。",
    valueMetric: "可控房間可見性與日常同行權益。",
    upgradeTrigger: "開始規律每週使用，並希望 AI Shared Host、摘要和更高延長彈性有感。",
    antiCannibalizationFence: "不提供大量 Host Credit、不提供活動房 / 主持控制台，避免吃掉 599 / 1299。",
    disabledReason: "需等訂閱、取消、退款、發票與 entitlement events 完整對齊後開放。",
    userFriendlyNotice: "正式 Pricing v2 規劃方案；目前尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [],
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: ["public", "members", "friends", "invited"],
    hostCreditsIncluded: 0,
    personalAiIncluded: "light_rescue",
    sharedHostIncluded: false,
    roomExtensionPolicy: "2 人房可有較友善延長；4 / 6 人房需每人 VIP 或房主贊助。",
    highlights: ["好友房 / 邀請制房", "25 / 50 / 75 一般房", "基本 Presence 偏好", "少量 Personal AI 文字救援"],
    supportSummary: "這層主要處理入門會員權益、可見性、一般房使用與付款問題。",
  },
  {
    code: "companion_regular_599",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "常駐同行",
    shortTitle: "常駐同行",
    priceLabel: "NT$599 / 月",
    amountTwd: 599,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    invoiceItemName: "安感島 常駐同行月方案",
    tradeDescription: "ANGANDAO Companion Regular Monthly",
    audience: "habit_builder",
    positioning: "主推方案，賣的是規律陪伴與 Shared Host AI 有感，不是個人 AI 吃到飽。",
    jobToBeDone: "我每週都會用，希望有人陪我開始、卡住時被輕推、結束時有收尾。",
    primaryValue: "更多房間工具、Shared Host AI 入門、摘要 / 回顧與延長彈性。",
    valueMetric: "習慣建立、Host Credit、房間狀態工具與回顧價值。",
    upgradeTrigger: "想帶朋友、開活動、讓房主贊助 AI 主持或全房延長。",
    antiCannibalizationFence: "不給完整主持控制台、不給大量活動房 / 90 分鐘權限。",
    disabledReason: "需等 Host Credit ledger、AI cost cap、Shared Host MVP 與發票 / 退款閉環完成。",
    userFriendlyNotice: "正式 Pricing v2 主推方案；目前尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [],
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: ["public", "members", "friends", "invited"],
    hostCreditsIncluded: 8,
    personalAiIncluded: "limited_rescue",
    sharedHostIncluded: true,
    roomExtensionPolicy: "可有更高延長彈性，但 extension confirmation 與 presence gate 必須生效。",
    highlights: ["包含安心同行主要權益", "每月 8 Host Credit 規劃", "房後摘要 / 回顧規劃", "Shared Host AI 入門"],
    supportSummary: "這層會有最多日常使用與 AI 主持客服問題，必須接 usage ledger 和 provider cost log。",
  },
  {
    code: "host_islander_1299",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    billingMode: "subscription",
    title: "主持島民",
    shortTitle: "主持島民",
    priceLabel: "NT$1,299 / 月",
    amountTwd: 1299,
    entitlementDays: 30,
    autoRenew: true,
    checkoutPlanCode: null,
    invoiceItemName: "安感島 主持島民月方案",
    tradeDescription: "ANGANDAO Host Islander Monthly",
    audience: "host_creator",
    positioning: "給房主、活動、帶朋友的人；賣主持能力、贊助能力與活動房，不是單純更多分鐘。",
    jobToBeDone: "我要帶朋友、開活動、降低主持壓力，並讓整房更容易開始與收束。",
    primaryValue: "90 分鐘活動房、主持控制台、房主贊助、較多 Host Credit。",
    valueMetric: "房主能力、活動房、贊助通行證與多人房成本控制。",
    upgradeTrigger: "需要 Buddies 專業交易、商業活動、團隊 / 社群管理或 payout。",
    antiCannibalizationFence: "仍不可全房無限延長；所有贊助需 ledger、usage cap 與成本上限。",
    disabledReason: "需等房主贊助、Host Credit、extension pass、AI usage ledger、admin audit 完整落地。",
    userFriendlyNotice: "正式 Pricing v2 高階方案；目前尚未開放付款。",
    allowedGeneralDurations: [25, 50, 75],
    allowedActivityDurations: [90],
    presenceModes: ["quiet", "audio", "mosaic", "camera"],
    roomVisibility: ["public", "members", "friends", "invited"],
    hostCreditsIncluded: 32,
    personalAiIncluded: "limited_rescue",
    sharedHostIncluded: true,
    roomExtensionPolicy: "房主可贊助全房延長，但需依 2 / 4 / 6 人、延長長度與 connected presence 計費。",
    highlights: ["90 分鐘活動房規劃", "每月 32 Host Credit 規劃", "主持控制台規劃", "房主贊助 AI / 延長通行證"],
    supportSummary: "這層涉及活動房、房主贊助、多人權益與高成本 AI，必須有 admin audit 與風控。",
  },
];

export const PRODUCT_ADD_ONS: ProductAddOn[] = [
  {
    code: "host_credit_25",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    title: "25 分鐘 AI 主持通行證",
    priceLabel: "NT$19",
    amountTwd: 19,
    invoiceItemName: "安感島 25分鐘AI主持通行證",
    positioning: "房主幫整房開 Shared Host AI。",
    hostCredits: 1,
    durationMinutes: 25,
    activeCapSeconds: 120,
    disabledReason: "需等 Host Credit ledger 與 AI usage cost cap 完成。",
  },
  {
    code: "host_credit_50",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    title: "50 分鐘 AI 主持通行證",
    priceLabel: "NT$39",
    amountTwd: 39,
    invoiceItemName: "安感島 50分鐘AI主持通行證",
    positioning: "標準房 Shared Host AI 通行證。",
    hostCredits: 2,
    durationMinutes: 50,
    activeCapSeconds: 240,
    disabledReason: "需等 Host Credit ledger 與 AI usage cost cap 完成。",
  },
  {
    code: "host_credit_75",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    title: "75 分鐘 AI 主持通行證",
    priceLabel: "NT$59",
    amountTwd: 59,
    invoiceItemName: "安感島 75分鐘AI主持通行證",
    positioning: "深度房 Shared Host AI 通行證。",
    hostCredits: 3,
    durationMinutes: 75,
    activeCapSeconds: 360,
    disabledReason: "需等 Host Credit ledger 與 AI usage cost cap 完成。",
  },
  {
    code: "host_credit_90",
    stage: "pricing_v2_next_spec",
    purchaseStatus: "planned",
    title: "90 分鐘 AI 主持通行證",
    priceLabel: "NT$99",
    amountTwd: 99,
    invoiceItemName: "安感島 90分鐘AI主持通行證",
    positioning: "活動房 / Studio Shared Host AI 通行證。",
    hostCredits: 4,
    durationMinutes: 90,
    activeCapSeconds: 480,
    disabledReason: "需等活動房、房主贊助與 Host Credit ledger 完成。",
  },
  {
    code: "whole_room_extension",
    stage: "future_extension",
    purchaseStatus: "blocked",
    title: "全房延長通行證",
    priceLabel: "依人數與延長長度計算",
    amountTwd: null,
    invoiceItemName: "安感島 全房延長通行證",
    positioning: "房主幫整房延長，必須依 2 / 4 / 6 人和 presence 計費。",
    disabledReason: "不能硬寫死在前端；需 server 依 entitlement、connected participants、billing ledger 計算。",
  },
];

export const ACTIVE_PURCHASABLE_PLAN = PRODUCT_PLANS.find((plan) => plan.code === "vip_month")!;

export function getProductPlan(code: string | null | undefined) {
  return PRODUCT_PLANS.find((plan) => plan.code === code);
}

export function getPurchasablePlan(code: string | null | undefined) {
  const plan = getProductPlan(code) ?? ACTIVE_PURCHASABLE_PLAN;
  if (!plan || plan.purchaseStatus !== "active" || !plan.checkoutPlanCode || plan.amountTwd === null) {
    throw new Error("這個方案尚未開放付款。");
  }
  return plan;
}

export function isGeneralRoomDuration(duration: number) {
  return ROOM_DURATION_POLICY.generalDurations.includes(duration);
}

export function isActivityRoomDuration(duration: number) {
  return duration === ROOM_DURATION_POLICY.activityDuration;
}

export function hostCreditsForDuration(duration: number) {
  if (duration === 90) return 4;
  if (duration >= 75) return 3;
  if (duration >= 50) return 2;
  return 1;
}

export function aiActiveCapSecondsForDuration(duration: number) {
  return hostCreditsForDuration(duration) * 120;
}

export function publicProductCatalogPayload() {
  return {
    build_tag: PRODUCT_CATALOG_BUILD_TAG,
    production_fact: {
      active_paid_plan_code: ACTIVE_PURCHASABLE_PLAN.code,
      active_paid_plan_label: ACTIVE_PURCHASABLE_PLAN.priceLabel,
      warning:
        "目前 production 只開放 NT$199 / 30 天一次性 VIP 試營運；NT$299 / 599 / 1299 是 Pricing v2 next-spec。",
    },
    pricing_principles: VALUE_BASED_PRICING_PRINCIPLES,
    room_policy: ROOM_DURATION_POLICY,
    room_categories: ROOM_CATEGORIES,
    presence_modes: PRESENCE_MODES,
    plans: PRODUCT_PLANS,
    add_ons: PRODUCT_ADD_ONS,
  };
}
