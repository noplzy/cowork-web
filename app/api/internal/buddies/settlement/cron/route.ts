import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import { isInternalCronRequest } from "@/lib/server/roomInfra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  const expired = await supabaseAdmin.rpc("cowork_expire_unpaid_buddy_bookings_v3", {
    p_limit: 200,
  });
  if (expired.error) throw expired.error;
  const promoted = await supabaseAdmin.rpc("cowork_promote_buddy_settlements_v3", {
    p_limit: 200,
  });
  if (promoted.error) throw promoted.error;
  const counts = await supabaseAdmin
    .from("buddy_settlements")
    .select("status");
  if (counts.error) throw counts.error;
  const byStatus: Record<string, number> = (counts.data ?? []).reduce((acc: Record<string, number>, row: any) => {
    const key = String(row.status || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: true,
    expired_unpaid: expired.data,
    promoted_settlements: promoted.data,
    settlement_counts: byStatus,
    build_tag: P3_BUILD_TAGS.settlement,
  };
}

export async function GET(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", build_tag: P3_BUILD_TAGS.settlement },
      { status: 401 },
    );
  }
  try {
    return NextResponse.json(await run());
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "P3 settlement cron failed", build_tag: P3_BUILD_TAGS.settlement },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
