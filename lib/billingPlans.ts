import { ACTIVE_PURCHASABLE_PLAN, PRODUCT_PLANS, getProductPlan, resolveCheckoutProductPlan } from "@/lib/productCatalog";

export type BillingPlanCode = "vip_month" | "companion_basic_299" | "companion_regular_599" | "host_islander_1299";
export type BillingPlanAvailability = "active" | "coming_soon";
export type BillingMode = "one_time" | "subscription";
export type BillingStage = "pilot" | "formal_launch";

export type BillingPlan = {
  code: BillingPlanCode; title: string; shortTitle: string; priceLabel: string; amount: number | null; entitlementDays: number | null;
  availability: BillingPlanAvailability; purchaseEnabled: boolean; billingMode: BillingMode; stage: BillingStage; autoRenew: boolean; checkoutPlanCode: string | null;
  description: string; highlights: string[]; supportSummary: string; disabledReason?: string; invoiceItemName: string; tradeDescription: string; valueMetric: string;
};

export const BILLING_SCOPE_LABEL = "Pricing v107｜正式商品目錄對齊";
export const BILLING_SCOPE_DESCRIPTION = "目前正式付款仍只開放 VIP 月方案（一次性付款 / 30 天 / 不自動續扣）。NT$299 / 599 / 1299 是 Pricing v2 next-spec，未開放付款。";

function toBillingPlan(code: BillingPlanCode): BillingPlan {
  const plan = getProductPlan(code);
  if (!plan) throw new Error(`Unknown billing plan: ${code}`);
  return {
    code: plan.code as BillingPlanCode,
    title: plan.title,
    shortTitle: plan.shortTitle,
    priceLabel: plan.priceLabel,
    amount: plan.amountTwd,
    entitlementDays: plan.entitlementDays,
    availability: plan.purchaseEnabled ? "active" : "coming_soon",
    purchaseEnabled: plan.purchaseEnabled,
    billingMode: plan.billingMode === "one_time" ? "one_time" : "subscription",
    stage: plan.stage === "production_pilot" ? "pilot" : "formal_launch",
    autoRenew: plan.autoRenew,
    checkoutPlanCode: plan.checkoutPlanCode,
    description: plan.description,
    highlights: plan.benefits,
    supportSummary: plan.valueMetric,
    disabledReason: plan.disabledReason,
    invoiceItemName: plan.invoiceItemName,
    tradeDescription: plan.tradeDescription,
    valueMetric: plan.valueMetric,
  };
}

export const BILLING_PLANS: BillingPlan[] = [toBillingPlan("vip_month"), toBillingPlan("companion_basic_299"), toBillingPlan("companion_regular_599"), toBillingPlan("host_islander_1299")];
export const ACTIVE_BILLING_PLAN = BILLING_PLANS.find((plan) => plan.code === ACTIVE_PURCHASABLE_PLAN.code) ?? BILLING_PLANS[0];
export const FUTURE_BILLING_PLANS = BILLING_PLANS.filter((plan) => plan.code !== ACTIVE_BILLING_PLAN.code);
export function getBillingPlan(code: string | null | undefined): BillingPlan | undefined { return BILLING_PLANS.find((plan) => plan.code === code); }
export function resolvePurchasableBillingPlan(code: string | null | undefined): BillingPlan { return toBillingPlan(resolveCheckoutProductPlan(code).code as BillingPlanCode); }
