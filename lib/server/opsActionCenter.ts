import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const OPS_ACTION_CENTER_BUILD_TAG = "ops-action-center-v116-2026-06-25";

type DetectedAction = {
  key: string;
  source_type: string;
  source_id: string | null;
  title: string;
  description: string;
  category: string;
  severity: "low" | "normal" | "high" | "urgent" | "critical";
  status: "open";
  href?: string | null;
  created_at?: string | null;
};

async function tryRows(table: string, build: (q: any) => any) {
  try {
    const result = await build(supabaseAdmin.from(table).select("*"));
    if (result.error) return { data: [], error: `${table}: ${result.error.message}` };
    return { data: result.data ?? [], error: null };
  } catch (error: any) {
    return { data: [], error: `${table}: ${error?.message || "query_failed"}` };
  }
}

function item(input: Omit<DetectedAction, "status">): DetectedAction {
  return { ...input, status: "open" };
}

export async function buildOpsActionCenter() {
  const nowIso = new Date().toISOString();
  const [
    support,
    refunds,
    reports,
    moderation,
    invoiceTasks,
    refundTasks,
    subscriptionTasks,
    notifications,
    identityRequests,
    buddyApplications,
    buddyDisputes,
    ghostRooms,
    manualItems,
  ] = await Promise.all([
    tryRows("support_tickets", (q) => q.in("status", ["open", "pending", "admin_review"]).order("updated_at", { ascending: true }).limit(60)),
    tryRows("refund_requests", (q) => q.in("status", ["requested", "reviewing", "approved", "processing"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("user_reports", (q) => q.in("status", ["open", "pending", "triaged"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("moderation_cases", (q) => q.in("status", ["open", "investigating", "action_required"]).order("updated_at", { ascending: true }).limit(60)),
    tryRows("ecpay_invoice_tasks", (q) => q.in("status", ["queued", "processing", "manual_required", "failed"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("ecpay_refund_tasks", (q) => q.in("status", ["queued", "processing", "manual_required", "failed"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("ecpay_subscription_tasks", (q) => q.in("status", ["queued", "processing", "manual_required", "failed"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("notification_outbox", (q) => q.in("status", ["manual_required", "failed"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("identity_verification_requests", (q) => q.in("review_status", ["pending", "needs_more_info"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("buddy_provider_applications", (q) => q.in("application_status", ["submitted", "needs_more_info"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("buddy_disputes", (q) => q.in("dispute_status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(60)),
    tryRows("rooms", (q) => q.eq("status", "active").lt("scheduled_end_at", nowIso).is("ended_at", null).order("scheduled_end_at", { ascending: true }).limit(60)),
    tryRows("ops_action_items", (q) => q.in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: true }).limit(80)),
  ]);

  const detected: DetectedAction[] = [
    ...support.data.map((row: any) => item({ key: `support:${row.id}`, source_type: "support_ticket", source_id: row.id, title: `客服單待處理：${row.subject || row.id}`, description: `${row.category || "support"}｜${row.status}｜${row.priority || "normal"}`, category: "support", severity: row.priority === "urgent" ? "urgent" : row.priority === "high" ? "high" : "normal", href: `/admin/support/${row.id}`, created_at: row.updated_at || row.created_at })),
    ...refunds.data.map((row: any) => item({ key: `refund:${row.id}`, source_type: "refund_request", source_id: row.id, title: `退款待處理：${row.status}`, description: `${row.reason_category || "refund"}｜NT$${row.amount_twd ?? "—"}`, category: "refund", severity: ["approved", "processing"].includes(row.status) ? "high" : "normal", href: "/admin/refunds", created_at: row.created_at })),
    ...reports.data.map((row: any) => item({ key: `report:${row.id}`, source_type: "user_report", source_id: row.id, title: `安全檢舉待處理：${row.category || "report"}`, description: `${row.target_type || "target"}｜${row.status}`, category: "safety", severity: row.severity === "critical" ? "critical" : row.severity === "high" ? "high" : "normal", href: "/admin/safety", created_at: row.created_at })),
    ...moderation.data.map((row: any) => item({ key: `moderation:${row.id}`, source_type: "moderation_case", source_id: row.id, title: `治理案件待處理：${row.target_type || "case"}`, description: `${row.status}｜${row.severity || "normal"}`, category: "moderation", severity: row.severity === "critical" ? "critical" : row.severity === "high" ? "high" : "normal", href: `/admin/moderation/${row.id}`, created_at: row.updated_at || row.created_at })),
    ...invoiceTasks.data.map((row: any) => item({ key: `invoice_task:${row.id}`, source_type: "ecpay_invoice_task", source_id: row.id, title: `發票任務：${row.status}`, description: row.last_error || "invoice task needs processing", category: "billing", severity: row.status === "failed" ? "high" : "normal", href: "/admin/billing/automation", created_at: row.created_at })),
    ...refundTasks.data.map((row: any) => item({ key: `refund_task:${row.id}`, source_type: "ecpay_refund_task", source_id: row.id, title: `退款任務：${row.status}`, description: row.last_error || "refund task needs processing", category: "billing", severity: row.status === "failed" ? "high" : "normal", href: "/admin/billing/automation", created_at: row.created_at })),
    ...subscriptionTasks.data.map((row: any) => item({ key: `subscription_task:${row.id}`, source_type: "ecpay_subscription_task", source_id: row.id, title: `訂閱任務：${row.action_type || "task"} / ${row.status}`, description: row.last_error || "subscription task needs processing", category: "subscription", severity: row.status === "failed" ? "high" : "normal", href: "/admin/billing/automation", created_at: row.created_at })),
    ...notifications.data.map((row: any) => item({ key: `notification:${row.id}`, source_type: "notification_outbox", source_id: row.id, title: `通知待處理：${row.channel} / ${row.status}`, description: row.last_error || row.subject || row.template_key, category: "notification", severity: row.priority === "urgent" ? "urgent" : row.status === "failed" ? "high" : "normal", href: "/admin/notifications", created_at: row.created_at })),
    ...identityRequests.data.map((row: any) => item({ key: `identity_review:${row.id}`, source_type: "identity_verification_request", source_id: row.id, title: `身分審核待處理：${row.review_status}`, description: `${row.legal_name || row.user_id}｜${row.document_type || "document"}`, category: "trust", severity: row.review_status === "needs_more_info" ? "low" : "normal", href: "/admin/trust", created_at: row.created_at })),
    ...buddyApplications.data.map((row: any) => item({ key: `buddy_application:${row.id}`, source_type: "buddy_provider_application", source_id: row.id, title: `安感夥伴申請：${row.application_status}`, description: `${row.display_title || row.user_id}`, category: "buddies", severity: "normal", href: "/admin/trust", created_at: row.created_at })),
    ...buddyDisputes.data.map((row: any) => item({ key: `buddy_dispute:${row.id}`, source_type: "buddy_dispute", source_id: row.id, title: `Buddies 爭議：${row.dispute_status}`, description: `${row.reason_category || "other"}｜booking ${row.booking_id || "—"}`, category: "buddies", severity: row.dispute_status === "open" ? "high" : "normal", href: "/admin/trust", created_at: row.created_at })),
    ...ghostRooms.data.map((row: any) => item({ key: `ghost_room:${row.id}`, source_type: "room", source_id: row.id, title: `可能逾期未清理房間：${row.title || row.id}`, description: `scheduled_end_at ${row.scheduled_end_at || "—"}`, category: "rooms", severity: "high", href: `/admin/rooms/${row.id}`, created_at: row.scheduled_end_at || row.created_at })),
  ];

  const errors = [support, refunds, reports, moderation, invoiceTasks, refundTasks, subscriptionTasks, notifications, identityRequests, buddyApplications, buddyDisputes, ghostRooms, manualItems]
    .map((x) => x.error)
    .filter(Boolean);

  const manual = manualItems.data ?? [];
  const all = [...detected, ...manual.map((row: any) => ({ ...row, key: `manual:${row.id}`, href: row.metadata?.href || null }))];

  const summary = all.reduce((acc: Record<string, number>, row: any) => {
    const category = row.category || "general";
    acc.total = (acc.total || 0) + 1;
    acc[category] = (acc[category] || 0) + 1;
    acc[`severity_${row.severity || "normal"}`] = (acc[`severity_${row.severity || "normal"}`] || 0) + 1;
    return acc;
  }, {});

  return { detected, manual, all, summary, errors, build_tag: OPS_ACTION_CENTER_BUILD_TAG };
}
