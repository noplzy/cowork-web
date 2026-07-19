import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  APPEALS_BUILD_TAG,
  closeUserAppeal,
  getUserAppeal,
} from "@/lib/server/appeals";

export const runtime = "nodejs";
type Context = { params: Promise<{ appealId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { appealId } = await context.params;
    const payload = await getUserAppeal(userId, appealId);
    return NextResponse.json({ ...payload, build_tag: APPEALS_BUILD_TAG });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json({ error: error?.message || "讀取申訴失敗。", build_tag: APPEALS_BUILD_TAG }, { status });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { appealId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "close") {
      return NextResponse.json({ error: "只允許 close 動作。", build_tag: APPEALS_BUILD_TAG }, { status: 400 });
    }
    const result = await closeUserAppeal(appealId, userId);
    return NextResponse.json({ result, build_tag: APPEALS_BUILD_TAG });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json({ error: error?.message || "關閉申訴失敗。", build_tag: APPEALS_BUILD_TAG }, { status });
  }
}
