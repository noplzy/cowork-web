import { NextResponse } from "next/server";
import {
  PUBLIC_SUPPORT_GOOGLE_FORM_URL,
  SUPPORT_CHANNELS,
  SUPPORT_CHANNELS_BUILD_TAG,
} from "@/lib/supportChannels";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    build_tag: SUPPORT_CHANNELS_BUILD_TAG,
    google_form_url: PUBLIC_SUPPORT_GOOGLE_FORM_URL,
    channels: SUPPORT_CHANNELS,
    policy: {
      public_fallback: "google_form",
      authenticated_commercial_records: "first_party_ticket",
      note:
        "Google 表單可保留為公開客服入口；正式商業帳務、退款、安全與履約案件應逐步轉入站內客服單與可稽核資料表。",
    },
  });
}
