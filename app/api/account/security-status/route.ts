import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function getUserBySupabaseJwt(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${userJwt}`,
    },
  });

  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

export async function GET(req: Request) {
  try {
    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "Missing Authorization Bearer <supabase_access_token>" }, { status: 401 });
    }

    const user = await getUserBySupabaseJwt(userJwt);
    const userId: string | undefined = user?.id;
    const email: string | undefined = user?.email;

    if (!userId) {
      return NextResponse.json({ error: "Invalid Supabase session token" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_blocks")
      .select("user_id,email,block_scope,reason,created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        blocked: false,
        user_id: userId,
        email: email ?? null,
        reason: null,
        created_at: null,
        block_scope: null,
        soft_error: error.message,
      });
    }

    return NextResponse.json({
      blocked: Boolean(data),
      user_id: userId,
      email: data?.email ?? email ?? null,
      reason: data?.reason ?? null,
      created_at: data?.created_at ?? null,
      block_scope: data?.block_scope ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        blocked: false,
        error: e?.message || "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
