import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { HOST_CREDIT_BUILD_TAG, getHostCreditSnapshot } from "@/lib/server/hostCredit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const snapshot = await getHostCreditSnapshot(userId);
    return NextResponse.json({ ...snapshot, build_tag: HOST_CREDIT_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看 Host Credit。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取 Host Credit 失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 500 });
  }
}
