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
import {
  P3_BUILD_TAGS,
  P3_IMPLEMENTATION_STATUS,
  p3AttestationFlags,
} from "@/lib/p3Status";
import {
  P4A_BUILD_TAGS,
  P4A_IMPLEMENTATION_STATUS,
} from "@/lib/p4aStatus";
import {
  P4B_BUILD_TAGS,
  P4B_IMPLEMENTATION_STATUS,
} from "@/lib/p4bStatus";

export const RELEASE_BUILD_TAG =
  "calmco-p4b-buddies-operational-workspaces-v141-2026-07-24";

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
  const gitBranch = readEnv("VERCEL_GIT_COMMIT_REF", "GIT_BRANCH") ?? "unknown";
  const environment = readEnv("VERCEL_ENV", "NODE_ENV") ?? "development";
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
      rule: "GitHub main 是程式 source of truth；公開 production 必須回報同一個 commit SHA。",
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
    },
    p1: {
      build_tags: P1_BUILD_TAGS,
      implementation_status: P1_IMPLEMENTATION_STATUS,
    },
    p2: {
      build_tags: P2_BUILD_TAGS,
      implementation_status: P2_IMPLEMENTATION_STATUS,
      launch_scope: "rooms_unlimited_299_only",
    },
    p3: {
      build_tags: P3_BUILD_TAGS,
      implementation_status: P3_IMPLEMENTATION_STATUS,
      launch_scope: "remote_buddies_invite_trial_manual_verified_payout",
      required_tables: [
        "buddy_booking_payment_applications",
        "buddy_settlements",
        "buddy_settlement_events",
        "buddy_payout_accounts",
        "buddy_payout_batches",
        "buddy_payout_items",
      ],
      required_rpcs: [
        "cowork_create_buddy_booking_v3",
        "cowork_apply_buddy_payment_v3",
        "cowork_transition_buddy_booking_v3",
        "cowork_confirm_buddy_completion_v3",
        "cowork_claim_buddy_room_provision_v3",
        "cowork_finish_buddy_room_provision_v3",
        "cowork_hold_buddy_settlement_v3",
        "cowork_release_buddy_settlement_v3",
        "cowork_reverse_buddy_payment_v3",
        "cowork_resolve_buddy_dispute_v3",
        "cowork_expire_unpaid_buddy_bookings_v3",
        "cowork_promote_buddy_settlements_v3",
        "cowork_create_buddy_payout_batch_v3",
        "cowork_transition_buddy_payout_batch_v3",
      ],
      required_runtime_routes: [
        "/api/payments/ecpay/buddies/checkout",
        "/api/payments/ecpay/buddies/notify",
        "/api/buddies/bookings/[bookingId]/room",
        "/api/buddies/bookings/[bookingId]/completion",
        "/api/buddies/bookings/[bookingId]/dispute",
        "/api/buddies/bookings/[bookingId]/settlement",
        "/api/account/buddies/payout-account",
        "/api/account/buddies/earnings",
        "/api/admin/buddies/settlements",
        "/api/admin/buddies/payout-batches",
        "/api/internal/buddies/settlement/cron",
        "/api/internal/launch/readiness",
      ],
      attestations: p3AttestationFlags(),
      safety_boundaries: {
        legal_escrow_claimed: false,
        raw_bank_account_in_application_db: false,
        in_person_commercial_trial: false,
        automated_bank_payout: false,
        ai_enabled: false,
      },
    },
    p4a: {
      build_tags: P4A_BUILD_TAGS,
      implementation_status: P4A_IMPLEMENTATION_STATUS,
      launch_scope: "rooms_operational_readability_social_safety_owner_controls",
      required_rpcs: [
        "cowork_room_friend_action_v4a",
        "cowork_room_owner_action_v4a",
      ],
      required_runtime_routes: [
        "/api/rooms/[roomId]/operations",
        "/api/rooms/[roomId]/relationships",
        "/api/rooms/[roomId]/moderation",
        "/api/rooms/[roomId]/owner",
      ],
      safety_boundaries: {
        daily_user_id_from_authenticated_user: true,
        browser_service_role_exposed: false,
        forced_camera_required: false,
        raw_media_stored: false,
        social_actions_room_scoped: true,
      },
    },
    p4b: {
      build_tags: P4B_BUILD_TAGS,
      implementation_status: P4B_IMPLEMENTATION_STATUS,
      launch_scope: "buddies_buyer_provider_payout_operational_workspaces",
      dependency: "p3_remote_buddies_commercial_foundation",
      required_runtime_routes: [
        "/api/account/buddies/workspace",
        "/api/buddies/bookings/[bookingId]",
        "/api/buddies/bookings/[bookingId]/room",
        "/api/buddies/bookings/[bookingId]/dispute",
        "/api/account/buddies/payout-account",
      ],
      required_pages: [
        "/account/buddies/workspace",
        "/account/buddies/bookings",
        "/account/buddies/earnings",
      ],
      safety_boundaries: {
        new_payment_command_path: false,
        new_refund_command_path: false,
        new_settlement_command_path: false,
        service_role_in_browser: false,
        automated_bank_payout: false,
        raw_bank_account_stored: false,
        in_person_commercial_trial: false,
        ai_enabled: false,
      },
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
    public_pages_checked_by_release: ["/", "/rooms", "/pricing", "/buddies"],
  };
}
