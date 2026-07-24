import { NextResponse } from "next/server";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import { getBuddyOperationalWorkspace } from "@/lib/server/buddyOperationalWorkspace";
import { P4B_BUILD_TAGS } from "@/lib/p4bStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const workspace = await getBuddyOperationalWorkspace(userId);
    return NextResponse.json(workspace, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, P4B_BUILD_TAGS.workspace);
    if (mapped) return mapped;
    const status = Number(error?.status || 500);
    return NextResponse.json(
      {
        error: error?.message || "讀取 Buddies 工作台失敗。",
        code: error?.code,
        build_tag: P4B_BUILD_TAGS.workspace,
      },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
