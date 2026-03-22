// app/rooms/page.tsx
// ✅ Milestone 3: Rooms list + 顯示本月額度/方案

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";

type Room = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
};

type StatusResp = {
  plan: string;
  is_vip: boolean;
  free_monthly_allowance: number;
  credits_used: number;
  credits_remaining: number | null;
  month_start: string;
};

export default function RoomsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<StatusResp | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setEmail(user.email ?? "");

      const { data: sessionData } = await supabase.auth.getSession();
      const access = sessionData.session?.access_token;
      if (access) {
        const r = await fetch("/api/account/status", {
          headers: { Authorization: `Bearer ${access}` },
        });
        const j = await r.json().catch(() => null);
        if (r.ok && j) setStatus(j as StatusResp);
      }

      const { data: roomsData, error } = await supabase
        .from("rooms")
        .select("id,title,duration_minutes,mode,max_size,created_at")
        .order("created_at", { ascending: false });

      if (error) setMsg(error.message);
      setRooms((roomsData as Room[]) ?? []);
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <main className="cc-container">
      <TopNav email={email} onSignOut={signOut} />

      <div className="cc-spread" style={{ alignItems: "flex-end" }}>
        <div>
          <h1 className="cc-h1">共工 Rooms</h1>
          <div className="cc-muted" style={{ lineHeight: 1.7, maxWidth: 820 }}>
            25m / 50m 時間盒。每月免費 4 場；50m 會消耗 2 場。pair / group 同規則（group 不加倍）。
          </div>
        </div>

        <Link className="cc-btn" href="/account" style={{ textDecoration: "none" }}>
          查看方案/額度
        </Link>
      </div>

      {status && (
        <div className="cc-alert" style={{ marginTop: 14 }}>
          <div className="cc-row" style={{ flexWrap: "wrap" }}>
            <span className="cc-pill">
              {status.is_vip ? "VIP" : "FREE"}
            </span>
            <span className="cc-muted" style={{ fontSize: 13 }}>
              {status.is_vip
                ? "續場 ∞（不扣場）"
                : `本月剩餘 ${status.credits_remaining ?? "?"}/${status.free_monthly_allowance} 場（週期起點：${status.month_start}）`}
            </span>
          </div>
        </div>
      )}

      {msg && (
        <div className="cc-alert cc-alert-error" style={{ marginTop: 12 }}>
          <b>錯誤：</b> {msg}
        </div>
      )}

      <div className="cc-card" style={{ marginTop: 16, padding: 0 }}>
        <div
          className="cc-spread"
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--cc-border)",
          }}
        >
          <div style={{ fontWeight: 600 }}>Rooms 列表</div>
          <div className="cc-muted" style={{ fontSize: 12 }}>
            {rooms.length} rooms
          </div>
        </div>

        <ul className="cc-list">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link
                className="cc-listlink"
                href={`/rooms/${r.id}`}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div className="cc-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {r.mode} · {r.duration_minutes}m · max {r.max_size}
                  </div>
                </div>
                <span className="cc-muted" style={{ fontSize: 12 }}>進房 →</span>
              </Link>
            </li>
          ))}
        </ul>

        {rooms.length === 0 && (
          <div className="cc-muted" style={{ padding: "12px 14px" }}>
            目前沒有 rooms（先在 Supabase Table Editor 建幾筆測試）。
          </div>
        )}
      </div>
    </main>
  );
}
