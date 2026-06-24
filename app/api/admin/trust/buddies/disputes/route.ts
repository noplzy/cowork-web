import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

const DEFAULT_STATUSES = ["open", "reviewing"];
const ALLOWED_STATUSES = new Set(["open", "reviewing", "resolved", "rejected", "cancelled"]);

function parseStatuses(url: URL) {
  const raw = url.searchParams.get("status");
  if (!raw) return DEFAULT_STATUSES;
  const statuses = raw.split(",").map((item) => item.trim()).filter((item) => ALLOWED_STATUSES.has(item));
  return statuses.length ? statuses : DEFAULT_STATUSES;
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "buddies.disputes" });
    const url = new URL(req.url);
    const statuses = parseStatuses(url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 120), 1), 240);

    const result = await supabaseAdmin
      .from("buddy_disputes")
      .select("*")
      .in("dispute_status", statuses)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (result.error) {
      return NextResponse.json({ error: result.error.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_disputes_listed",
      targetType: "buddy_disputes",
      metadata: { statuses, limit },
    });

    return NextResponse.json({ disputes: result.data ?? [], statuses, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
