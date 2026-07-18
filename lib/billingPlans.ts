import {
  PRODUCT_PLANS,
  getProductPlan,
  getPurchasablePlan,
} from "@/lib/productCatalog";

export type BillingPlanCode =
  | "vip_month"
  | "rooms_unlimited_299"
  | "buddies_pro_399"
  | "whole_site_599"
  | "host_999";

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
  invoiceItemName: string;
  tradeDescription: string;
  valueMetric: string;
};

export const BILLING_SCOPE_LABEL =
  "Pricing v128｜Pricing v2 最終規格與 production 商品隔離";
export const BILLING_SCOPE_DESCRIPTION =
  "目前 production 只開放 VIP 月方案（一次性付款／30 天／不自動續扣）。Rooms 299、Buddies 399、全站 599、主理人 999 是 final next-spec，尚未開放付款。";

function toBillingPlan(code: BillingPlanCode): BillingPlan {
  const plan = getProductPlan(code);
  if (!plan) {
    throw new Error(`Unknown billing plan: ${code}`);
  }

  const purchaseEnabled =
    Boolean(plan.purchaseEnabled) &&
    plan.purchaseStatus === "active" &&
    Boolean(plan.checkoutPlanCode) &&
    plan.amountTwd !== null;

  return {
    code: plan.code as BillingPlanCode,
    title: plan.title,
    shortTitle: plan.shortTitle,
    priceLabel: plan.priceLabel,
    amount: plan.amountTwd,
    entitlementDays: plan.entitlementDays,
    availability: purchaseEnabled ? "active" : "coming_soon",
    purchaseEnabled,
    billingMode:
      plan.billingMode === "one_time" ? "one_time" : "subscription",
    stage: plan.stage === "production_pilot" ? "pilot" : "formal_launch",
    autoRenew: plan.autoRenew,
    checkoutPlanCode: plan.checkoutPlanCode,
    description: plan.positioning || plan.description,
    highlights: plan.highlights?.length ? plan.highlights : plan.benefits,
    supportSummary: plan.supportSummary,
    disabledReason: plan.disabledReason,
    invoiceItemName: plan.invoiceItemName,
    tradeDescription: plan.tradeDescription,
    valueMetric: plan.valueMetric,
  };
}

export const BILLING_PLANS: BillingPlan[] = [
  toBillingPlan("vip_month"),
  toBillingPlan("rooms_unlimited_299"),
  toBillingPlan("buddies_pro_399"),
  toBillingPlan("whole_site_599"),
  toBillingPlan("host_999"),
];

export const ACTIVE_BILLING_PLAN =
  BILLING_PLANS.find((plan) => plan.code === "vip_month") ??
  BILLING_PLANS[0];

export const FUTURE_BILLING_PLANS = BILLING_PLANS.filter(
  (plan) => plan.code !== ACTIVE_BILLING_PLAN.code,
);

export function getBillingPlan(
  code: string | null | undefined,
): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.code === code);
}

export function resolvePurchasableBillingPlan(
  code: string | null | undefined,
): BillingPlan {
  const productPlan = getPurchasablePlan(code);

  return {
    code: productPlan.code as BillingPlanCode,
    title: productPlan.title,
    shortTitle: productPlan.shortTitle,
    priceLabel: productPlan.priceLabel,
    amount: productPlan.amountTwd,
    entitlementDays: productPlan.entitlementDays,
    availability: "active",
    purchaseEnabled: true,
    billingMode:
      productPlan.billingMode === "one_time" ? "one_time" : "subscription",
    stage:
      productPlan.stage === "production_pilot" ? "pilot" : "formal_launch",
    autoRenew: productPlan.autoRenew,
    checkoutPlanCode: productPlan.checkoutPlanCode,
    description: productPlan.positioning || productPlan.description,
    highlights: productPlan.highlights?.length
      ? productPlan.highlights
      : productPlan.benefits,
    supportSummary: productPlan.supportSummary,
    disabledReason: productPlan.disabledReason,
    invoiceItemName: productPlan.invoiceItemName,
    tradeDescription: productPlan.tradeDescription,
    valueMetric: productPlan.valueMetric,
  };
}
