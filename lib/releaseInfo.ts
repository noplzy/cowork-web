import {
  ACTIVE_PURCHASABLE_PLAN,
  AI_PRICING_POLICY,
  PRODUCT_CATALOG_BUILD_TAG,
  ROOM_DURATION_POLICY,
} from "@/lib/productCatalog";

export const RELEASE_BUILD_TAG =
  "calmco-p0-0-production-alignment-v127-2026-07-15";

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

  const targetEnvironment =
    readEnv("VERCEL_TARGET_ENV") ?? environment;

  const deploymentUrl = httpsUrl(readEnv("VERCEL_URL"));
  const productionUrl =
    httpsUrl(readEnv("VERCEL_PROJECT_PRODUCTION_URL")) ??
    "https://getcalmandco.com";

  const repositoryOwner =
    readEnv("VERCEL_GIT_REPO_OWNER") ?? "noplzy";
  const repositorySlug =
    readEnv("VERCEL_GIT_REPO_SLUG") ?? "cowork-web";
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
    product: {
      product_catalog_build_tag: PRODUCT_CATALOG_BUILD_TAG,
      room_policy: ROOM_DURATION_POLICY,
      pricing_policy: {
        active_paid_plan_code: ACTIVE_PURCHASABLE_PLAN.code,
        active_paid_plan_label: ACTIVE_PURCHASABLE_PLAN.priceLabel,
        pricing_v2_status: "next_spec_not_purchasable",
      },
      ai_policy: AI_PRICING_POLICY,
    },
    public_pages_checked_by_p0_0: ["/", "/rooms", "/pricing"],
  };
}
