import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  APPEALS_BUILD_TAG,
  appendAppealMessage,
  getUserAppeal,
} from "@/lib/server/appeals";

export const runtime = "nodejs";
type Context = { params: Promise<{ appealId: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { appealId } = await context.params;
    await getUserAppeal(userId, appealId);
    const body = (await req.json().catch(() => ({}))) as { body?: string };
    const result = await appendAppealMessage({
      appealId,
      actorUserId: userId,
      actorRole: "user",
      body: body.body || "",
    });
    return NextResponse.json({ result, build_tag: APPEALS_BUILD_TAG });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json({ error: error?.message || "新增訊息失敗。", build_tag: APPEALS_BUILD_TAG }, { status });
  }
}
