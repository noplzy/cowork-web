import { NextResponse } from "next/server";
import {
  BILLING_AUTOMATION_BUILD_TAG,
  getBillingReconciliationReport,
  processInvoiceTasks,
  processRefundTasks,
  processSubscriptionTasks,
} from "@/lib/server/billingAutomation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FORMAL_BILLING_CRON_BUILD_TAG = "billing-formal-cron-v124-2026-07-04";
const JOB_NAME = "billing_automation";
const LOCK_SECONDS = 14 * 60;

type TriggerInfo = {
  trigger_source: "vercel_cron" | "manual_http";
  schedule: string | null;
  user_agent: string;
};

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function uniqueSecrets() {
  return Array.from(
    new Set(
      [process.env.CRON_SECRET, process.env.BILLING_AUTOMATION_SECRET, process.env.ROOM_CLEANUP_SECRET]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function assertAuthorized(req: Request): TriggerInfo {
  const secrets = uniqueSecrets();
  if (secrets.length === 0) {
    throw Object.assign(new Error("Missing CRON_SECRET / BILLING_AUTOMATION_SECRET / ROOM_CLEANUP_SECRET"), { status: 500 });
  }

  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const url = new URL(req.url);
  const got = firstString(req.headers.get("x-cron-secret"), req.headers.get("x-internal-secret"), bearer, url.searchParams.get("secret"));

  if (!got || !secrets.includes(got)) {
    throw Object.assign(new Error("UNAUTHORIZED_BILLING_FORMAL_CRON"), { status: 401 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  const schedule = req.headers.get("x-vercel-cron-schedule");
  const triggerSource = userAgent.includes("vercel-cron") || !!schedule ? "vercel_cron" : "manual_http";
  return { trigger_source: triggerSource, schedule, user_agent: userAgent };
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  const result = await supabaseAdmin
    .from("billing_automation_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (result.error) throw result.error;
}

async function releaseLock(runId: string) {
  const released = await supabaseAdmin.rpc("billing_release_job_lock", {
    p_job_name: JOB_NAME,
    p_locked_by: runId,
  });
  if (released.error) {
    console.warn("[BILLING_FORMAL_CRON_LOCK_RELEASE_FAILED]", released.error.message);
  }
}

async function runFormalBillingAutomation(req: Request) {
  const startedAt = Date.now();
  const trigger = assertAuthorized(req);
  const runId = crypto.randomUUID();

  const insertedRun = await supabaseAdmin.from("billing_automation_runs").insert({
    id: runId,
    job_name: JOB_NAME,
    status: "running",
    trigger_source: trigger.trigger_source,
    schedule: trigger.schedule,
    user_agent: trigger.user_agent,
    build_tag: FORMAL_BILLING_CRON_BUILD_TAG,
    automation_build_tag: BILLING_AUTOMATION_BUILD_TAG,
    started_at: new Date(startedAt).toISOString(),
  });
  if (insertedRun.error) throw insertedRun.error;

  const lock = await supabaseAdmin.rpc("billing_try_acquire_job_lock", {
    p_job_name: JOB_NAME,
    p_lock_seconds: LOCK_SECONDS,
    p_locked_by: runId,
  });
  if (lock.error) throw lock.error;

  if (lock.data !== true) {
    const skipped = {
      ok: true,
      skipped: true,
      reason: "billing_automation_already_running",
      run_id: runId,
      build_tag: FORMAL_BILLING_CRON_BUILD_TAG,
      automation_build_tag: BILLING_AUTOMATION_BUILD_TAG,
    };
    await updateRun(runId, {
      status: "skipped_locked",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      result: skipped,
    });
    return skipped;
  }

  try {
    console.info("[BILLING_FORMAL_CRON_START]", {
      run_id: runId,
      trigger_source: trigger.trigger_source,
      schedule: trigger.schedule,
      build_tag: FORMAL_BILLING_CRON_BUILD_TAG,
      automation_build_tag: BILLING_AUTOMATION_BUILD_TAG,
    });

    const invoicesBeforeRefunds = await processInvoiceTasks(20);
    const refunds = await processRefundTasks(20);
    const invoicesAfterRefunds = await processInvoiceTasks(20);
    const subscriptions = await processSubscriptionTasks(20);
    const reconciliation = await getBillingReconciliationReport(100);

    const result = {
      ok: true,
      run_id: runId,
      invoices_before_refunds: invoicesBeforeRefunds,
      refunds,
      invoices_after_refunds: invoicesAfterRefunds,
      subscriptions,
      reconciliation_summary: reconciliation?.summary ?? null,
      build_tag: FORMAL_BILLING_CRON_BUILD_TAG,
      automation_build_tag: BILLING_AUTOMATION_BUILD_TAG,
    };

    await updateRun(runId, {
      status: "completed",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      result,
    });

    console.info("[BILLING_FORMAL_CRON_DONE]", {
      run_id: runId,
      duration_ms: Date.now() - startedAt,
      reconciliation_summary: reconciliation?.summary ?? null,
    });

    return result;
  } catch (error: any) {
    const message = error?.message || "billing_formal_cron_failed";
    await updateRun(runId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      error: message,
    });
    console.error("[BILLING_FORMAL_CRON_FAILED]", { run_id: runId, error: message });
    throw error;
  } finally {
    await releaseLock(runId);
  }
}

export async function GET(req: Request) {
  try {
    const result = await runFormalBillingAutomation(req);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error?.status || (/UNAUTHORIZED/.test(error?.message || "") ? 401 : 500);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "billing_formal_cron_failed",
        build_tag: FORMAL_BILLING_CRON_BUILD_TAG,
        automation_build_tag: BILLING_AUTOMATION_BUILD_TAG,
      },
      { status }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
