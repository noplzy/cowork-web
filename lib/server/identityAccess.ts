import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest, type AuthenticatedRequestUser } from "@/lib/serverRoomUtils";

export const IDENTITY_ACCESS_BUILD_TAG = "identity-access-v118-2026-06-26";

export type IdentityTrustState = {
  user_id: string;
  email: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  has_email: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  real_name_verified: boolean;
  latest_identity_request: any | null;
  public_profile: any | null;
};

export class IdentityAccessError extends Error {
  status: number;
  code: string;
  requirement: string;
  redirect_to: string;
  constructor(input: { code: string; message: string; requirement: string; redirect_to: string; status?: number }) {
    super(input.message);
    this.status = input.status ?? 403;
    this.code = input.code;
    this.requirement = input.requirement;
    this.redirect_to = input.redirect_to;
  }
}

function isoOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

async function maybeSingleSafe(builder: any) {
  const result = await builder.maybeSingle();
  if (result.error) return { data: null, error: result.error.message };
  return { data: result.data ?? null, error: null };
}

export async function readIdentityStateForAuthUser(authUser: any): Promise<IdentityTrustState> {
  const userId = String(authUser?.id || "");
  if (!userId) throw new Error("Missing auth user id.");

  const [profileResult, latestIdentityResult, approvedIdentityResult] = await Promise.all([
    maybeSingleSafe(
      supabaseAdmin
        .from("profiles")
        .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy,public_profile_enabled,profile_visibility,public_contact_note,updated_at")
        .eq("user_id", userId),
    ),
    maybeSingleSafe(
      supabaseAdmin
        .from("identity_verification_requests")
        .select("id,review_status,request_type,submitted_at,reviewed_at,updated_at,reviewer_note")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ),
    maybeSingleSafe(
      supabaseAdmin
        .from("identity_verification_requests")
        .select("id,review_status,reviewed_at")
        .eq("user_id", userId)
        .eq("review_status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(1),
    ),
  ]);

  const phone = isoOrNull(authUser?.phone) ? String(authUser.phone) : null;
  const phoneConfirmedAt = isoOrNull((authUser as any)?.phone_confirmed_at);
  const email = isoOrNull(authUser?.email);
  const emailConfirmedAt = isoOrNull((authUser as any)?.email_confirmed_at) || isoOrNull((authUser as any)?.confirmed_at);

  return {
    user_id: userId,
    email,
    email_confirmed_at: emailConfirmedAt,
    phone,
    phone_confirmed_at: phoneConfirmedAt,
    has_email: Boolean(email),
    email_verified: Boolean(email && emailConfirmedAt),
    phone_verified: Boolean(phone && phoneConfirmedAt),
    real_name_verified: Boolean(approvedIdentityResult.data?.id),
    latest_identity_request: latestIdentityResult.data,
    public_profile: profileResult.data,
  };
}

export async function readIdentityStateFromAccessToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
  }
  return readIdentityStateForAuthUser(data.user);
}

export async function getIdentityStateFromRequest(req: Request) {
  const auth = await getAuthUserFromRequest(req);
  const { data, error } = await supabaseAdmin.auth.getUser(auth.accessToken);
  if (error || !data.user?.id) {
    throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
  }
  return { auth, identity: await readIdentityStateForAuthUser(data.user) };
}

export function assertPhoneVerified(identity: Pick<IdentityTrustState, "phone_verified">) {
  if (!identity.phone_verified) {
    throw new IdentityAccessError({
      code: "PHONE_REQUIRED",
      requirement: "phone_verified",
      redirect_to: "/account/identity",
      message: "請先完成手機號碼綁定，才能使用平台功能。你仍可瀏覽公開頁面。",
    });
  }
}

export function assertBuddiesRealNameVerified(identity: Pick<IdentityTrustState, "phone_verified" | "real_name_verified">) {
  assertPhoneVerified(identity);
  if (!identity.real_name_verified) {
    throw new IdentityAccessError({
      code: "REAL_NAME_REQUIRED_FOR_BUDDIES",
      requirement: "real_name_verified",
      redirect_to: "/account/identity/bindings",
      message: "Buddies 涉及付費陪伴與服務邊界，請先完成實名審核後再使用。",
    });
  }
}

export async function requirePhoneVerifiedForRequest(req: Request): Promise<AuthenticatedRequestUser & { identity: IdentityTrustState }> {
  const { auth, identity } = await getIdentityStateFromRequest(req);
  assertPhoneVerified(identity);
  return { ...auth, identity };
}

export async function requireBuddiesRealNameVerifiedForRequest(req: Request): Promise<AuthenticatedRequestUser & { identity: IdentityTrustState }> {
  const { auth, identity } = await getIdentityStateFromRequest(req);
  assertBuddiesRealNameVerified(identity);
  return { ...auth, identity };
}

export async function requirePhoneVerifiedFromAccessToken(accessToken: string) {
  const identity = await readIdentityStateFromAccessToken(accessToken);
  assertPhoneVerified(identity);
  return identity;
}

export function identityAccessErrorResponse(error: any, buildTag = IDENTITY_ACCESS_BUILD_TAG) {
  if (error instanceof IdentityAccessError || error?.code === "PHONE_REQUIRED" || error?.code === "REAL_NAME_REQUIRED_FOR_BUDDIES") {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        requirement: error.requirement,
        redirect_to: error.redirect_to,
        build_tag: buildTag,
      },
      { status: error.status || 403 },
    );
  }
  if (error?.message === "UNAUTHORIZED" || error?.status === 401) {
    return NextResponse.json({ error: "請先登入。", code: "UNAUTHORIZED", build_tag: buildTag }, { status: 401 });
  }
  return null;
}
