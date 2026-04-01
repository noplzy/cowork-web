export type BillingPlanCode =
  | "vip_month"
  | "vip_month_subscription"
  | "vip_year_subscription";

export type BillingPlanAvailability = "active" | "coming_soon";
export type BillingMode = "one_time" | "subscription";
export type BillingStage = "pilot" | "formal_launch";

export type BillingPlan = {
  code: BillingPlanCode;
  title: string;
  shortTitle: string;
  priceLabel: string;
  amount: number | null;
  entitlementDays: number | null;
  availability: BillingPlanAvailability;
  purchaseEnabled: boolean;
  billingMode: BillingMode;
  stage: BillingStage;
  autoRenew: boolean;
  checkoutPlanCode: string | null;
  description: string;
  highlights: string[];
  supportSummary: string;
  disabledReason?: string;
};

export const BILLING_SCOPE_LABEL = "試營運單一月方案";
export const BILLING_SCOPE_DESCRIPTION =
  "目前只開放 VIP 月方案（一次性付款 / 30 天 / 不自動續扣），退款改走人工審核。";

export const BILLING_PLANS: BillingPlan[] = [
  {
    code: "vip_month",
    title: "VIP 月方案",
    shortTitle: "VIP",
    priceLabel: "NT$199 / 30 天",
    amount: 199,
    entitlementDays: 30,
    availability: "active",
    purchaseEnabled: true,
    billingMode: "one_time",
    stage: "pilot",
    autoRenew: false,
    checkoutPlanCode: "vip_month",
    description:
      "試營運期間先做一次性付款閉環：付款成功、後端驗證、權益入帳、客服可追蹤。",
    highlights: [
      "一次性信用卡付款",
      "付款成功後開通 30 天 VIP",
      "目前不自動續扣",
      "退款改走人工審核",
    ],
    supportSummary:
      "若發生權益未生效、重複扣款或首次購買後未使用主要權益，可走人工退款審核。",
  },
  {
    code: "vip_month_subscription",
    title: "VIP 月訂閱",
    shortTitle: "月訂閱",
    priceLabel: "正式上線後公告",
    amount: null,
    entitlementDays: 30,
    availability: "coming_soon",
    purchaseEnabled: false,
    billingMode: "subscription",
    stage: "formal_launch",
    autoRenew: true,
    checkoutPlanCode: null,
    description:
      "保留給正式上線後的自動續扣版本。等特約商店、扣款、查單與取消流程都穩定後再開放。",
    highlights: [
      "正式上線後才開放",
      "預計支援每月自動續扣",
      "取消方式與扣款週期會另行公開",
    ],
    supportSummary:
      "目前不開放購買，也不應對外承諾自動續扣或固定扣款日。",
    disabledReason: "正式上線後開放",
  },
  {
    code: "vip_year_subscription",
    title: "VIP 年方案",
    shortTitle: "年方案",
    priceLabel: "正式上線後公告",
    amount: null,
    entitlementDays: 365,
    availability: "coming_soon",
    purchaseEnabled: false,
    billingMode: "subscription",
    stage: "formal_launch",
    autoRenew: true,
    checkoutPlanCode: null,
    description:
      "保留給正式上線後的年繳 / 年訂閱方案。等退款、續約、權益延長與帳務流程跑穩後再開。",
    highlights: [
      "正式上線後才開放",
      "價格與折扣仍保留調整空間",
      "會搭配完整續約 / 取消 / 退款規則",
    ],
    supportSummary:
      "目前不開放購買，避免前台承諾超過後台實際可處理範圍。",
    disabledReason: "正式上線後開放",
  },
];

export const ACTIVE_BILLING_PLAN =
  BILLING_PLANS.find((plan) => plan.code === "vip_month") ?? BILLING_PLANS[0];

export const FUTURE_BILLING_PLANS = BILLING_PLANS.filter(
  (plan) => plan.code !== ACTIVE_BILLING_PLAN.code,
);

export function getBillingPlan(
  code: string | null | undefined,
): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.code === code);
}

export function resolvePurchasableBillingPlan(code: string | null | undefined): BillingPlan {
  const plan =
    getBillingPlan(code) ??
    getBillingPlan(ACTIVE_BILLING_PLAN.code);

  if (!plan) {
    throw new Error("目前找不到對應方案。");
  }

  if (!plan.purchaseEnabled || !plan.checkoutPlanCode) {
    throw new Error("這個方案尚未開放付款。");
  }

  return plan;
}
