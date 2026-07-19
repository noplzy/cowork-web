export const TRUST_OPS_BUILD_TAG = "trust-operations-state-machine-v129-2026-07-18";

export type SupportTicketStatus =
  | "open"
  | "pending"
  | "admin_review"
  | "resolved"
  | "closed";

export type UserReportStatus =
  | "open"
  | "triaged"
  | "actioned"
  | "dismissed"
  | "closed";

export type ModerationCaseStatus =
  | "open"
  | "investigating"
  | "action_required"
  | "actioned"
  | "dismissed"
  | "closed";

export type AppealStatus =
  | "open"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "closed";

const SUPPORT_TRANSITIONS: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  open: ["pending", "admin_review", "resolved", "closed"],
  pending: ["open", "admin_review", "resolved", "closed"],
  admin_review: ["pending", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

const REPORT_TRANSITIONS: Record<UserReportStatus, readonly UserReportStatus[]> = {
  open: ["triaged", "actioned", "dismissed", "closed"],
  triaged: ["open", "actioned", "dismissed", "closed"],
  actioned: ["closed", "triaged"],
  dismissed: ["closed", "triaged"],
  closed: ["triaged"],
};

const MODERATION_TRANSITIONS: Record<ModerationCaseStatus, readonly ModerationCaseStatus[]> = {
  open: ["investigating", "action_required", "dismissed", "closed"],
  investigating: ["action_required", "actioned", "dismissed", "closed"],
  action_required: ["investigating", "actioned", "dismissed", "closed"],
  actioned: ["investigating", "closed"],
  dismissed: ["investigating", "closed"],
  closed: ["investigating"],
};

const APPEAL_TRANSITIONS: Record<AppealStatus, readonly AppealStatus[]> = {
  open: ["reviewing", "closed"],
  reviewing: ["accepted", "rejected", "closed"],
  accepted: ["closed", "reviewing"],
  rejected: ["closed", "reviewing"],
  closed: ["reviewing"],
};

export const MODERATION_ACTION_TYPES = [
  "warn",
  "room_remove",
  "content_hide",
  "restrict_room_create",
  "restrict_buddies",
  "suspend",
  "ban",
  "restore",
  "note",
] as const;

export const TRUST_SEVERITIES = ["low", "normal", "high", "critical"] as const;
export const APPEAL_REASON_CODES = [
  "mistaken_identity",
  "missing_context",
  "incorrect_facts",
  "disproportionate_action",
  "resolved_issue",
  "other",
] as const;

function assertKnown<T extends string>(value: string, allowed: readonly T[], label: string): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw Object.assign(new Error(`INVALID_${label.toUpperCase()}`), {
      status: 400,
      code: `INVALID_${label.toUpperCase()}`,
      value,
    });
  }
}

function assertTransition<T extends string>(
  current: string,
  next: string,
  table: Record<T, readonly T[]>,
  label: string,
): asserts next is T {
  const currentKey = current as T;
  const nextKey = next as T;
  if (!(currentKey in table) || !(nextKey in table)) {
    throw Object.assign(new Error(`INVALID_${label.toUpperCase()}_STATUS`), {
      status: 400,
      code: `INVALID_${label.toUpperCase()}_STATUS`,
      current,
      next,
    });
  }
  if (currentKey === nextKey) return;
  if (!table[currentKey].includes(nextKey)) {
    throw Object.assign(new Error(`INVALID_${label.toUpperCase()}_TRANSITION`), {
      status: 409,
      code: `INVALID_${label.toUpperCase()}_TRANSITION`,
      current,
      next,
    });
  }
}

export function assertSupportTransition(current: string, next: string) {
  assertTransition(current, next, SUPPORT_TRANSITIONS, "support");
}

export function assertReportTransition(current: string, next: string) {
  assertTransition(current, next, REPORT_TRANSITIONS, "report");
}

export function assertModerationTransition(current: string, next: string) {
  assertTransition(current, next, MODERATION_TRANSITIONS, "moderation");
}

export function assertAppealTransition(current: string, next: string) {
  assertTransition(current, next, APPEAL_TRANSITIONS, "appeal");
}

export function assertModerationActionType(value: string) {
  assertKnown(value, MODERATION_ACTION_TYPES, "moderation_action_type");
}

export function assertTrustSeverity(value: string) {
  assertKnown(value, TRUST_SEVERITIES, "trust_severity");
}

export function assertAppealReasonCode(value: string) {
  assertKnown(value, APPEAL_REASON_CODES, "appeal_reason_code");
}
