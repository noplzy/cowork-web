import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  APPEALS_BUILD_TAG,
  createAppeal,
  listUserAppeals,
  publicAppealReasonOptions,
} from "@/lib/server/appeals";
import { cleanText, insertReliabilityEvent } from "@/lib/server/safety";

export const runtime = "nodejs";

type CreateBody = {
  moderation_case_id?: string | null;
  moderation_action_id?: string | null;
  reason_code?: string;
  message?: string;
  requested_outcome?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
};

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const status = cleanText(url.searchParams.get("status") || "", 40);
    const limit = Number(url.searchParams.get("limit") || 50);
    const appeals = await listUserAppeals(userId, status, limit);
    return NextResponse.json({
      appeals,
      reason_codes: publicAppealReasonOptions(),
      build_tag: APPEALS_BUILD_TAG,
    });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json(
      { error: status === 401 ? "請先登入後再查看申訴。" : error?.message || "讀取申訴失敗。", build_tag: APPEALS_BUILD_TAG },
      { status },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const result = await createAppeal({
      userId,
      moderationCaseId: body.moderation_case_id || null,
      moderationActionId: body.moderation_action_id || null,
      reasonCode: body.reason_code || "other",
      message: body.message || "",
      requestedOutcome: body.requested_outcome || null,
      idempotencyKey: body.idempotency_key || null,
      metadata: body.metadata ?? {},
    });

    const appeal = result?.appeal as any;
    await insertReliabilityEvent({
      userId,
      eventType: "appeal_submitted",
      severity: "info",
      source: "appeals_v129",
      metadata: {
        appeal_id: appeal?.id || null,
        moderation_case_id: body.moderation_case_id || null,
        moderation_action_id: body.moderation_action_id || null,
        created: result?.created !== false,
      },
    });

    return NextResponse.json({ ...result, build_tag: APPEALS_BUILD_TAG }, { status: result?.created === false ? 200 : 201 });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json(
      { error: status === 401 ? "請先登入後再提出申訴。" : error?.message || "建立申訴失敗。", code: error?.code, build_tag: APPEALS_BUILD_TAG },
      { status },
    );
  }
}
