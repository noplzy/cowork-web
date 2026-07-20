import {
  ACTIVE_PURCHASABLE_PLAN,
  ACTIVE_PURCHASABLE_PLANS,
  AI_PRICING_POLICY,
  PRICING_V2_POLICY,
  PRODUCT_CATALOG_BUILD_TAG,
  PRODUCT_PLANS,
  ROOM_DURATION_POLICY,
} from "@/lib/productCatalog";
import { P0_BUILD_TAGS, P0_IMPLEMENTATION_STATUS } from "@/lib/p0Status";
import { P1_BUILD_TAGS, P1_IMPLEMENTATION_STATUS } from "@/lib/p1Status";
import { P2_BUILD_TAGS, P2_IMPLEMENTATION_STATUS } from "@/lib/p2Status";

export const RELEASE_BUILD_TAG =
  "calmco-p2-rooms-299-commercial-v130-2026-07-20";

const SOURCE_REPOSITORY = "noplzy/cowork-web";
const EXPECTED_PRODUCTION_BRANCH = "main";

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function httpsUrl(host: string | null) {
  return host ? `https://${host.replace(/^https?:\/\//, "")}` : null;
}

export function getPublicReleaseInfo() {
  const gitCommitSha =
    readEnv("VERCEL_GIT_COMMIT_SHA", "GIT_COMMIT_SHA", "SOURCE_VERSION") ??
    "unknown";
  const gitBranch =
    readEnv("VERCEL_GIT_COMMIT_REF", "GIT_BRANCH") ?? "unknown";
  const environment =
    readEnv("VERCEL_ENV", "NODE_ENV") ?? "development";
  const targetEnvironment = readEnv("VERCEL_TARGET_ENV") ?? environment;
  const deploymentUrl = httpsUrl(readEnv("VERCEL_URL"));
  const productionUrl =
    httpsUrl(readEnv("VERCEL_PROJECT_PRODUCTION_URL")) ??
    "https://getcalmandco.com";
  const repositoryOwner = readEnv("VERCEL_GIT_REPO_OWNER") ?? "noplzy";
  const repositorySlug = readEnv("VERCEL_GIT_REPO_SLUG") ?? "cowork-web";
  const deployedRepository = `${repositoryOwner}/${repositorySlug}`;

  return {
    ok: true,
    build_tag: RELEASE_BUILD_TAG,
    generated_at: new Date().toISOString(),
    source_of_truth: {
      repository: SOURCE_REPOSITORY,
      expected_branch: EXPECTED_PRODUCTION_BRANCH,
      rule:
        "GitHub main 是程式 source of truth；公開 production 必須回報同一個 commit SHA。",
    },
    deployment: {
      environment,
      target_environment: targetEnvironment,
      branch: gitBranch,
      git_commit_sha: gitCommitSha,
      git_previous_sha: readEnv("VERCEL_GIT_PREVIOUS_SHA"),
      deployment_id: readEnv("VERCEL_DEPLOYMENT_ID"),
      project_id: readEnv("VERCEL_PROJECT_ID"),
      deployment_url: deploymentUrl,
      production_url: productionUrl,
      repository: deployedRepository,
    },
    alignment: {
      git_metadata_available: gitCommitSha !== "unknown",
      repository_matches:
        deployedRepository.toLowerCase() === SOURCE_REPOSITORY.toLowerCase(),
      branch_matches: gitBranch === EXPECTED_PRODUCTION_BRANCH,
      production_environment: environment === "production",
    },
    p0: {
      build_tags: P0_BUILD_TAGS,
      implementation_status: P0_IMPLEMENTATION_STATUS,
      required_tables: [
        "room_member_presence_state",
        "room_extension_confirmations",
        "room_session_summaries",
        "room_participant_summaries",
      ],
      required_runtime_routes: [
        "/api/daily/meeting-token",
        "/api/rooms/presence/event",
        "/api/rooms/presence/mode",
        "/api/rooms/presence/brb",
        "/api/rooms/presence/return",
        "/api/rooms/[roomId]/presence-state",
        "/api/internal/rooms/summarize-ended",
        "/api/account/rooms/history",
        "/api/admin/rooms/[roomId]/summary",
      ],
    },
    p1: {
      build_tags: P1_BUILD_TAGS,
      implementation_status: P1_IMPLEMENTATION_STATUS,
      required_tables: ["appeal_messages", "appeal_events"],
      required_rpcs: [
        "cowork_create_appeal",
        "cowork_append_appeal_message",
        "cowork_close_appeal",
        "cowork_transition_appeal",
      ],
      required_runtime_routes: [
        "/api/account/moderation/actions",
        "/api/appeals",
        "/api/appeals/[appealId]",
        "/api/appeals/[appealId]/messages",
        "/api/admin/appeals",
        "/api/admin/appeals/[appealId]",
      ],
      required_admin_permissions: [
        "support.manage",
        "safety.manage",
        "appeals.manage",
      ],
    },
    p2: {
      build_tags: P2_BUILD_TAGS,
      implementation_status: P2_IMPLEMENTATION_STATUS,
      required_tables: [
        "user_plan_entitlements",
        "user_usage_wallets",
        "user_usage_wallet_events",
        "subscription_payment_applications",
        "room_extension_grants",
      ],
      required_rpcs: [
        "cowork_consume_usage_wallet_v2",
        "cowork_apply_subscription_payment_v2",
        "cowork_finalize_room_extension_v2",
      ],
      required_runtime_routes: [
        "/api/account/entitlements",
        "/api/payments/ecpay/recurring/checkout",
        "/api/payments/ecpay/recurring/notify",
        "/api/rooms/[roomId]/commercial-extension",
      ],
      launch_scope: "rooms_unlimited_299_only",
      p3_plans_blocked: [
        "buddies_pro_399",
        "whole_site_599",
        "host_999",
      ],
    },
    product: {
      product_catalog_build_tag: PRODUCT_CATALOG_BUILD_TAG,
      room_policy: ROOM_DURATION_POLICY,
      pricing_policy: {
        active_paid_plan_code: ACTIVE_PURCHASABLE_PLAN.code,
        active_paid_plan_label: ACTIVE_PURCHASABLE_PLAN.priceLabel,
        active_paid_plan_codes: ACTIVE_PURCHASABLE_PLANS.map((plan) => plan.code),
        pricing_v2_status: PRICING_V2_POLICY.status,
        pricing_v2_commercial_launch_enabled:
          PRICING_V2_POLICY.commercialLaunchEnabled,
        pricing_v2_plan_codes: PRODUCT_PLANS.filter(
          (plan) => plan.stage === "pricing_v2_final_spec",
        ).map((plan) => plan.code),
      },
      ai_policy: AI_PRICING_POLICY,
    },
    public_pages_checked_by_p0: ["/", "/rooms", "/pricing"],
  };
}
