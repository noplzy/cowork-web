export const PRODUCT_CATALOG_BUILD_TAG = "product-catalog-pricing-v107-2026-06-03";

export type ProductStage = "production_pilot" | "pricing_v2_next_spec" | "future_extension";
export type BillingMode = "free" | "one_time" | "subscription" | "add_on";
export type PlanCode = "free" | "vip_month" | "companion_basic_299" | "companion_regular_599" | "host_islander_1299";
export type RoomCategory = "focus" | "life" | "share" | "hobby";
export type PresenceMode = "quiet" | "audio" | "mosaic" | "camera";

export type ProductPlan = {
  code: PlanCode;
  title: string;
  shortTitle: string;
  subtitle: string;
  priceLabel: string;
  amountTwd: number | null;
  billingMode: BillingMode;
  entitlementDays: number | null;
  stage: ProductStage;
  purchaseEnabled: boolean;
  checkoutPlanCode: string | null;
  autoRenew: boolean;
  invoiceItemName: string;
  tradeDescription: string;
  audience: string;
  jobToBeDone: string;
  valueMetric: string;
  upgradeTrigger: string;
  antiCannibalizationFence: string;
  description: string;
  benefits: string[];
  quotas: { monthlyRoomCredits: number | null; monthlyHostCredits: number | null; maxGeneralRoomMinutes: number; activityRoomMinutes: number | null; activityRoomMonthlyCount: number };
  disabledReason?: string;
};

export const ROOM_CATEGORIES: { code: RoomCategory; label: string; description: string }[] = [
  { code: "focus", label: "專注任務", description: "一起開始、一起維持，不需要一直說話。" },
  { code: "life", label: "生活陪伴", description: "家務、煮菜、收納、睡前收尾的低壓力陪伴。" },
  { code: "share", label: "主題分享", description: "有主題，但不需要表演或搶話。" },
  { code: "hobby", label: "興趣同好", description: "用興趣當入口，降低陌生互動壓力。" },
];

export const PRESENCE_MODES: { code: PresenceMode; label: string; description: string }[] = [
  { code: "quiet", label: "安靜在場", description: "不說話也可以在場。" },
  { code: "audio", label: "音訊在場", description: "用聲音確認彼此在。" },
  { code: "mosaic", label: "柔焦在場", description: "保留存在感，降低被觀看壓力。" },
  { code: "camera", label: "開鏡頭在場", description: "雙方自願時使用，不作為平台預設要求。" },
];

export const GENERAL_ROOM_DURATIONS = [25, 50, 75] as const;
export const ACTIVITY_ROOM_DURATION = 90 as const;
export const DEPRECATED_ROOM_DURATIONS = [100] as const;
export const ALLOWED_GROUP_SIZES = [2, 4, 6] as const;

export const VALUE_BASED_PRICING_PRINCIPLES = [
  "低價層賣舒服在場，中價層賣穩定習慣，高價層賣房主 / 活動 / 帶朋友能力。",
  "高成本能力用 Host Credit、房主贊助、活動包控成本，不塞進低價月費無限用。",
  "Personal AI 只做開始、卡住、收尾救援；差異化集中在真人同行房的 Shared Host AI。",
  "所有可收費能力都必須能被 billing_ledger、entitlement_events、invoice_events、refund_events 追蹤。",
] as const;

export const PRODUCT_PLANS: ProductPlan[] = [
  { code:"free", title:"免費體驗", shortTitle:"Free", subtitle:"先感受有人一起開始。", priceLabel:"NT$0", amountTwd:0, billingMode:"free", entitlementDays:null, stage:"pricing_v2_next_spec", purchaseEnabled:false, checkoutPlanCode:null, autoRenew:false, invoiceItemName:"安感島免費體驗", tradeDescription:"ANGANDAO Free Trial", audience:"curious_free", jobToBeDone:"我想低壓力試一次。", valueMetric:"低成本體驗與公開房參與。", upgradeTrigger:"想建立好友房 / 邀請制房。", antiCannibalizationFence:"不給高成本 AI、活動房、完整邀請制。", description:"拉新體驗，不是正式高成本方案。", benefits:["公開房體驗","短場入門","基本 Presence Mode"], quotas:{monthlyRoomCredits:0,monthlyHostCredits:0,maxGeneralRoomMinutes:25,activityRoomMinutes:null,activityRoomMonthlyCount:0}, disabledReason:"免費額度會在 Pricing v2 上線時公告" },
  { code:"vip_month", title:"VIP 月方案（試營運）", shortTitle:"VIP 試營運", subtitle:"目前唯一正式可付款方案。", priceLabel:"NT$199 / 30 天", amountTwd:199, billingMode:"one_time", entitlementDays:30, stage:"production_pilot", purchaseEnabled:true, checkoutPlanCode:"vip_month", autoRenew:false, invoiceItemName:"安感島 VIP 月方案（試營運）", tradeDescription:"ANGANDAO VIP Pilot Monthly", audience:"operator_manual", jobToBeDone:"我想先支持或測試完整付款與 VIP 權益流程。", valueMetric:"付款成功、權益入帳、帳務可稽核。", upgradeTrigger:"正式 Pricing v2 上線後依使用深度升級。", antiCannibalizationFence:"不承諾正式 Host Credit、房主贊助或自動續扣。", description:"先完成一次性付款、權益入帳、客服與退款可追蹤閉環。", benefits:["一次性信用卡付款","30 天 VIP","不自動續扣","人工退款審核"], quotas:{monthlyRoomCredits:null,monthlyHostCredits:0,maxGeneralRoomMinutes:75,activityRoomMinutes:null,activityRoomMonthlyCount:0} },
  { code:"companion_basic_299", title:"安心同行", shortTitle:"安心同行", subtitle:"入門 VIP，降低孤單開始的門檻。", priceLabel:"NT$299 / 月", amountTwd:299, billingMode:"subscription", entitlementDays:30, stage:"pricing_v2_next_spec", purchaseEnabled:false, checkoutPlanCode:null, autoRenew:true, invoiceItemName:"安感島 安心同行月方案", tradeDescription:"ANGANDAO Companion Basic Monthly", audience:"low_pressure_regular", jobToBeDone:"我想自在地開好友房、邀請熟人、穩定有人一起開始。", valueMetric:"可控房間可見性與日常同行權益。", upgradeTrigger:"開始規律每週使用，需要 AI Shared Host 與摘要。", antiCannibalizationFence:"不提供大量 Host Credit 或活動房。", description:"好友房 / 邀請制與 25 / 50 / 75 一般房。", benefits:["好友房 / 邀請制房","25 / 50 / 75 一般房","基本 Presence 偏好","少量 Personal AI 文字救援規劃"], quotas:{monthlyRoomCredits:null,monthlyHostCredits:0,maxGeneralRoomMinutes:75,activityRoomMinutes:null,activityRoomMonthlyCount:0}, disabledReason:"需等訂閱、取消、退款、發票與 entitlement events 對齊後開放" },
  { code:"companion_regular_599", title:"常駐同行", shortTitle:"常駐同行", subtitle:"主推方案，穩定陪伴與 AI 主持有感。", priceLabel:"NT$599 / 月", amountTwd:599, billingMode:"subscription", entitlementDays:30, stage:"pricing_v2_next_spec", purchaseEnabled:false, checkoutPlanCode:null, autoRenew:true, invoiceItemName:"安感島 常駐同行月方案", tradeDescription:"ANGANDAO Companion Regular Monthly", audience:"habit_builder", jobToBeDone:"我每週都會用，希望有人陪我開始、卡住時被輕推、結束時有收尾。", valueMetric:"習慣建立、Host Credit、房間狀態工具與回顧價值。", upgradeTrigger:"想帶朋友、開活動、讓房主贊助 AI 主持或延長。", antiCannibalizationFence:"不給完整主持控制台或大量活動房。", description:"更多房間工具、Shared Host AI 入門、摘要 / 回顧與延長彈性。", benefits:["包含安心同行主要權益","每月 8 Host Credit 規劃","房後摘要 / 回顧規劃","Shared Host AI 入門"], quotas:{monthlyRoomCredits:null,monthlyHostCredits:8,maxGeneralRoomMinutes:75,activityRoomMinutes:null,activityRoomMonthlyCount:0}, disabledReason:"需等 Host Credit ledger、AI cost cap、Shared Host MVP 完成" },
  { code:"host_islander_1299", title:"主持島民", shortTitle:"主持島民", subtitle:"給房主、活動、帶朋友的人。", priceLabel:"NT$1,299 / 月", amountTwd:1299, billingMode:"subscription", entitlementDays:30, stage:"pricing_v2_next_spec", purchaseEnabled:false, checkoutPlanCode:null, autoRenew:true, invoiceItemName:"安感島 主持島民月方案", tradeDescription:"ANGANDAO Host Islander Monthly", audience:"host_creator", jobToBeDone:"我要帶朋友、開活動、降低主持壓力，讓整房更容易開始與收束。", valueMetric:"房主能力、活動房、贊助通行證與多人房成本控制。", upgradeTrigger:"需要 Buddies 專業交易、團隊 / 社群管理或 payout。", antiCannibalizationFence:"仍不可全房無限延長；所有贊助需 ledger、usage cap 與成本上限。", description:"90 分鐘活動房、主持控制台、房主贊助與較多 Host Credit。", benefits:["90 分鐘活動房規劃","每月 32 Host Credit 規劃","主持控制台規劃","房主贊助 AI / 延長通行證"], quotas:{monthlyRoomCredits:null,monthlyHostCredits:32,maxGeneralRoomMinutes:75,activityRoomMinutes:90,activityRoomMonthlyCount:4}, disabledReason:"需等房主贊助、Host Credit、extension pass、AI usage ledger 完成" },
];

export const HOST_CREDIT_ADDONS = [
  { code:"host_credit_25", title:"25 分鐘 AI 主持通行證", priceLabel:"NT$19", amountTwd:19, hostCredits:1, durationMinutes:25, activeCapSeconds:120 },
  { code:"host_credit_50", title:"50 分鐘 AI 主持通行證", priceLabel:"NT$39", amountTwd:39, hostCredits:2, durationMinutes:50, activeCapSeconds:240 },
  { code:"host_credit_75", title:"75 分鐘 AI 主持通行證", priceLabel:"NT$59", amountTwd:59, hostCredits:3, durationMinutes:75, activeCapSeconds:360 },
  { code:"host_credit_90", title:"90 分鐘 AI 主持通行證", priceLabel:"NT$99", amountTwd:99, hostCredits:4, durationMinutes:90, activeCapSeconds:480 },
] as const;

export const ACTIVE_PURCHASABLE_PLAN = PRODUCT_PLANS.find((plan) => plan.code === "vip_month")!;
export function getProductPlan(code: string | null | undefined) { return PRODUCT_PLANS.find((plan) => plan.code === code); }
export function resolveCheckoutProductPlan(code: string | null | undefined) { const plan = getProductPlan(code) ?? ACTIVE_PURCHASABLE_PLAN; if (!plan.purchaseEnabled || !plan.checkoutPlanCode) throw new Error("這個方案尚未開放付款。請選擇目前可付款的方案，或聯絡客服。"); return plan; }
export function isAllowedGeneralRoomDuration(value: number) { return (GENERAL_ROOM_DURATIONS as readonly number[]).includes(value); }
export function normalizeGroupSize(value: unknown, mode: "pair" | "group") { if (mode === "pair") return 2; const parsed = Number(value); return (ALLOWED_GROUP_SIZES as readonly number[]).includes(parsed) ? parsed : 4; }
export function publicProductCatalogPayload() { return { build_tag: PRODUCT_CATALOG_BUILD_TAG, production_fact:{ active_paid_plan_code:"vip_month", warning:"目前 production 只開放 NT$199 / 30 天一次性 VIP 試營運；NT$299 / 599 / 1299 是 Pricing v2 next-spec。" }, pricing_principles: VALUE_BASED_PRICING_PRINCIPLES, room_policy:{ general_durations:GENERAL_ROOM_DURATIONS, activity_duration:ACTIVITY_ROOM_DURATION, deprecated_durations:DEPRECATED_ROOM_DURATIONS }, plans:PRODUCT_PLANS, host_credit_addons:HOST_CREDIT_ADDONS, room_categories:ROOM_CATEGORIES, presence_modes:PRESENCE_MODES }; }
