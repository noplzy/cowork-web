import type { SharedHostAction } from "@/lib/ai/aiPromptPolicy";

const ALLOWED_HOST_ACTIONS: SharedHostAction[] = [
  "OPENING",
  "HELP_NEXT_STEP",
  "WRAP_UP",
  "EXTENSION_CHECK",
];

export function normalizeSharedHostAction(input?: string | null): SharedHostAction {
  const normalized = String(input || "").trim().toUpperCase();
  if (ALLOWED_HOST_ACTIONS.includes(normalized as SharedHostAction)) {
    return normalized as SharedHostAction;
  }

  return "HELP_NEXT_STEP";
}

export function hostActionLabel(action: SharedHostAction): string {
  if (action === "OPENING") return "開場引導";
  if (action === "WRAP_UP") return "收尾整理";
  if (action === "EXTENSION_CHECK") return "續場確認";
  return "下一步協助";
}

export function estimateHostCreditUsed(action: SharedHostAction): number {
  // Phase 1 only records usage. Real deduction should be introduced after pricing is finalized.
  if (action === "EXTENSION_CHECK") return 0;
  return 0.1;
}
