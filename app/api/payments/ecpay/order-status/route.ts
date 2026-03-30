import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEcpayConfig, queryEcpayTradeInfo } from "@/lib/ecpay";

export const runtime = "nodejs";

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const matched = header.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${userJwt}`,
    },
  });

  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

function parsePaidAt(paymentDate?: string): string | null {
  if (!paymentDate) return null;
  const normalized = paymentDate.replace(/\//g, "-");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "缺少登入憑證。" }, { status: 401 });
    }

    const user = await getSupabaseUser(userJwt);
    const userId = user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "登入狀態已過期，請重新登入。" }, { status: 401 });
    }

    const merchantTradeNo = String(req.nextUrl.searchParams.get("merchantTradeNo") || "").trim();
    if (!merchantTradeNo) {
      return NextResponse.json({ error: "缺少訂單編號。" }, { status: 400 });
    }

    let { data: order, error: orderError } = await supabaseAdmin
      .from("payment_orders")
      .select("merchant_trade_no,plan_code,amount,status,paid_at,created_at,provider_trade_no,last_error,provider_payload")
      .eq("merchant_trade_no", merchantTradeNo)
      .eq("user_id", userId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "找不到這筆付款訂單。" }, { status: 404 });
    }

    if (order.status === "pending") {
      try {
        const config = getEcpayConfig();
        const queryResult = await queryEcpayTradeInfo(merchantTradeNo, config);
        const tradeStatus = String(queryResult.TradeStatus || "");
        const tradeAmt = Number(queryResult.TradeAmt || 0);

        if (tradeStatus === "1" && tradeAmt === Number(order.amount)) {
          const { error: rpcError } = await supabaseAdmin.rpc("ecpay_mark_order_paid", {
            p_merchant_trade_no: merchantTradeNo,
            p_provider_trade_no: String(queryResult.TradeNo || "") || null,
            p_paid_at: parsePaidAt(queryResult.PaymentDate),
            p_provider_payload: {
              order_status_poll: true,
              query_trade_info: queryResult,
            },
          });

          if (!rpcError) {
            const refreshed = await supabaseAdmin
              .from("payment_orders")
              .select("merchant_trade_no,plan_code,amount,status,paid_at,created_at,provider_trade_no,last_error,provider_payload")
              .eq("merchant_trade_no", merchantTradeNo)
              .eq("user_id", userId)
              .maybeSingle();

            if (refreshed.data) {
              order = refreshed.data;
            }
          }
        }
      } catch {
        // 查單失敗時，前端仍顯示處理中，不把結果頁打爆
      }
    }

    const { data: entitlement } = await supabaseAdmin
      .from("user_entitlements")
      .select("plan,vip_until")
      .eq("user_id", userId)
      .maybeSingle();

    const isVip =
      entitlement?.plan === "vip" &&
      (!entitlement?.vip_until || new Date(entitlement.vip_until).getTime() > Date.now());

    return NextResponse.json({
      merchantTradeNo: order.merchant_trade_no,
      status: order.status,
      planCode: order.plan_code,
      amount: order.amount,
      paidAt: order.paid_at,
      createdAt: order.created_at,
      providerTradeNo: order.provider_trade_no,
      lastError: order.last_error,
      entitlement: {
        plan: entitlement?.plan || "free",
        vip_until: entitlement?.vip_until || null,
        is_vip: Boolean(isVip),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "查詢付款狀態時發生未預期錯誤。" },
      { status: 500 },
    );
  }
}
