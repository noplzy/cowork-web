import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  return (await res.text()).trim();
}

export async function GET() {
  try {
    const [ip, userAgent] = await Promise.all([
      fetchText("https://ifconfig.me/ip"),
      fetchText("https://ifconfig.me/ua"),
    ]);

    return NextResponse.json(
      {
        ok: true,
        egress_ip: ip,
        user_agent: userAgent,
        note: "This response is generated server-side from the Vercel function runtime.",
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
