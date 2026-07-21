import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCheckMacValue,
  formatTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
  getOneTimeCheckoutPaymentConfig,
  redactEcpayFields,
} from "@/lib/ecpay";
import {
  buildDefaultInvoicePreference,
  normalizeInvoicePreference,
} from "@/lib/invoicePreferences";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import {
  assertCommercialBookingAmount,
  assertPilotDeliveryMode,
  requireApprovedBuddyProvider,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { bookingId?: string; invoicePreference?: unknown };

function origin(req: Request) {
  const configured = String(
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
  )
    .trim()
    .replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

async function invoicePreferenceFor(
  input: unknown,
  userId: string,
  email: string,
) {
  if (input !== undefined && input !== null) {
    return normalizeInvoicePreference(input, email);
  }
  const saved = await supabaseAdmin
    .from("user_invoice_preferences")
    .select("preference")
    .eq("user_id", userId)
    .maybeSingle();
  if (saved.error) throw saved.error;
  if (saved.data?.preference) {
    return normalizeInvoicePreference(saved.data.preference, email);
  }
  return buildDefaultInvoicePreference(email);
}

export async function POST(req: Request) {
  try {
    const auth = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(auth.userId);
    const body = (await req.json().catch(() => ({}))) as Body;
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) {
      return NextResponse.json({ error: "缺少 bookingId。" }, { status: 400 });
    }

    const bookingResult = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingResult.error || !bookingResult.data) {
      return NextResponse.json(
        { error: bookingResult.error?.message || "找不到預約。" },
        { status: 404 },
      );
    }
    const booking = bookingResult.data as any;
    if (booking.buyer_user_id !== auth.userId) {
      return NextResponse.json(
        { error: "只有預約者可以付款。" },
        { status: 403 },
      );
    }
    if (booking.booking_status !== "pending") {
      return NextResponse.json(
        { error: "只有待回覆的預約可以付款。" },
        { status: 409 },
      );
    }
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { error: "這筆預約已完成付款。", code: "BUDDY_ALREADY_PAID" },
        { status: 409 },
      );
    }
    if (
      booking.payment_due_at &&
      new Date(booking.payment_due_at).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          error: "付款保留時間已結束，請重新選擇時段。",
          code: "BUDDY_PAYMENT_WINDOW_EXPIRED",
          build_tag: P3_BUILD_TAGS.checkout,
        },
        { status: 410 },
      );
    }

    const serviceResult = await supabaseAdmin
      .from("buddy_services")
      .select("id,title,delivery_mode,provider_user_id,status")
      .eq("id", booking.service_id)
      .maybeSingle();
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json(
        { error: serviceResult.error?.message || "找不到服務。" },
        { status: 404 },
      );
    }
    assertPilotDeliveryMode(serviceResult.data.delivery_mode);
    await requireApprovedBuddyProvider(serviceResult.data.provider_user_id);
    await assertCommercialBookingAmount(Number(booking.total_amount_twd || 0));

    const existingApplication = await supabaseAdmin
      .from("buddy_booking_payment_applications")
      .select("payment_order_id,status")
      .eq("booking_id", bookingId)
      .in("status", ["pending", "applied"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingApplication.error) throw existingApplication.error;
    if (existingApplication.data) {
      const order = await supabaseAdmin
        .from("payment_orders")
        .select("id,status,merchant_trade_no")
        .eq("id", existingApplication.data.payment_order_id)
        .maybeSingle();
      if (!order.error && order.data && ["pending", "paid"].includes(order.data.status)) {
        return NextResponse.json(
          {
            error: "這筆預約已有付款流程，請先查看付款狀態。",
            code: "BUDDY_PAYMENT_ALREADY_EXISTS",
            payment_order: order.data,
            build_tag: P3_BUILD_TAGS.checkout,
          },
          { status: 409 },
        );
      }
    }

    const invoicePreference = await invoicePreferenceFor(
      body.invoicePreference,
      auth.userId,
      auth.email || "",
    );
    const config = getEcpayConfig();
    const paymentConfig = getOneTimeCheckoutPaymentConfig();
    const merchantTradeNo = generateMerchantTradeNo("BDY");
    const amount = Math.round(Number(booking.total_amount_twd));

    const orderResult = await supabaseAdmin
      .from("payment_orders")
      .insert({
        user_id: auth.userId,
        provider: "ecpay",
        merchant_trade_no: merchantTradeNo,
        plan_code: "buddy_booking_payment",
        amount,
        currency: "TWD",
        status: "pending",
        item_name: `安感島 Buddies 預約｜${serviceResult.data.title}`.slice(0, 200),
        trade_desc: "ANGANDAO Buddy Booking",
        vip_days: 0,
        buddy_booking_id: bookingId,
        provider_payload: {
          source: "buddy_checkout_v131",
          booking_id: bookingId,
          service_id: booking.service_id,
          provider_user_id: booking.provider_user_id,
          invoice_preference: invoicePreference,
          build_tag: P3_BUILD_TAGS.checkout,
        },
        invoice_preference: invoicePreference,
      })
      .select("id")
      .single();
    if (orderResult.error || !orderResult.data) {
      throw orderResult.error || new Error("建立 Buddies 付款訂單失敗。");
    }

    const application = await supabaseAdmin
      .from("buddy_booking_payment_applications")
      .upsert(
        {
          booking_id: bookingId,
          payment_order_id: orderResult.data.id,
          buyer_user_id: auth.userId,
          provider_user_id: booking.provider_user_id,
          amount_twd: amount,
          status: "pending",
          applied_at: null,
          reversed_at: null,
          metadata: {
            checkout_retry_safe: true,
            build_tag: P3_BUILD_TAGS.checkout,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_id" },
      );
    if (application.error) {
      await supabaseAdmin
        .from("payment_orders")
        .update({ status: "failed", last_error: application.error.message })
        .eq("id", orderResult.data.id);
      throw application.error;
    }

    const baseUrl = origin(req);
    const fields: Record<string, string> = {
      MerchantID: config.merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(new Date()),
      PaymentType: "aio",
      TotalAmount: String(amount),
      TradeDesc: "ANGANDAO Buddy Booking",
      ItemName: `安感島 Buddies 預約｜${serviceResult.data.title}`.slice(0, 200),
      ReturnURL: `${baseUrl}/api/payments/ecpay/buddies/notify`,
      ChoosePayment: paymentConfig.choosePayment,
      EncryptType: "1",
      ClientBackURL: `${baseUrl}/account/buddies/bookings`,
      OrderResultURL: `${baseUrl}/api/payments/ecpay/order-result`,
      NeedExtraPaidInfo: paymentConfig.needExtraPaidInfo,
      CustomField1: "buddy_booking_payment",
      CustomField2: bookingId,
      CustomField3: orderResult.data.id,
      CustomField4: auth.userId,
      ItemURL: `${baseUrl}/account/buddies/bookings`,
      Remark: "BUDDY_BOOKING_V131",
    };
    if (paymentConfig.chooseSubPayment) {
      fields.ChooseSubPayment = paymentConfig.chooseSubPayment;
    }
    if (paymentConfig.ignorePayment) fields.IgnorePayment = paymentConfig.ignorePayment;
    if (paymentConfig.storeId) fields.StoreID = paymentConfig.storeId;
    fields.CheckMacValue = createCheckMacValue(
      fields,
      config.hashKey,
      config.hashIV,
    );

    await supabaseAdmin.from("payment_events").insert({
      merchant_trade_no: merchantTradeNo,
      provider: "ecpay",
      event_type: "buddy_checkout_created",
      raw_payload: {
        fields: redactEcpayFields(fields),
        booking_id: bookingId,
        payment_order_id: orderResult.data.id,
        build_tag: P3_BUILD_TAGS.checkout,
      },
    });

    return NextResponse.json({
      action: config.checkoutUrl,
      method: "POST",
      fields,
      merchantTradeNo,
      payment_order_id: orderResult.data.id,
      booking_id: bookingId,
      build_tag: P3_BUILD_TAGS.checkout,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, P3_BUILD_TAGS.checkout);
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error?.message || "建立 Buddies 付款流程失敗。",
        code: error?.code,
        build_tag: P3_BUILD_TAGS.checkout,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
