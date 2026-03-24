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

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人專注" : "小組共工";
}

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

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Focus Rooms</span>
          <p className="cc-eyebrow">共工模式｜先把一段時間走完，不用一個人硬撐</p>
          <h1 className="cc-h1">選一個房間，讓節奏慢下來，但不要停下來。</h1>
          <p className="cc-lead">
            Rooms 是安感島目前最重要的主線。25m / 50m 的時間盒、免費額度、VIP 續場與進房成本都要清楚，
            因為真正能留住人的不是特效，而是可預期的安全感。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-soft">25m 扣 1 場</span>
            <span className="cc-pill-soft">50m 扣 2 場</span>
            <span className="cc-pill-success">group 不加倍</span>
          </div>
          <div className="cc-action-row">
            <Link className="cc-btn" href="/account">
              查看方案 / 額度
            </Link>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">目前狀態</p>
                <h2 className="cc-h2">你的本月使用權益</h2>
              </div>
              <span className={status?.is_vip ? "cc-pill-success" : "cc-pill-warning"}>
                {status?.is_vip ? "VIP" : "FREE"}
              </span>
            </div>

            {status ? (
              <div className="cc-grid-metrics">
                <div className="cc-metric">
                  <span className="cc-metric-label">本月剩餘</span>
                  <div className="cc-metric-value">{status.is_vip ? "∞" : (status.credits_remaining ?? "?")}</div>
                </div>
                <div className="cc-metric">
                  <span className="cc-metric-label">每月額度</span>
                  <div className="cc-metric-value">{status.is_vip ? "VIP" : status.free_monthly_allowance}</div>
                </div>
                <div className="cc-metric">
                  <span className="cc-metric-label">週期起點</span>
                  <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>{status.month_start}</div>
                </div>
              </div>
            ) : (
              <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
                正在讀取你的方案與額度資訊…
              </p>
            )}
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">設計原則</p>
            <h3 className="cc-h3">進房前就知道規則，不要在關鍵時刻才被教育。</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              這裡不追求花俏，而是讓你快速判斷：現在能不能進、進了會扣多少、如果想續場需要什麼條件。
            </p>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          <strong>讀取錯誤：</strong> {msg}
        </div>
      ) : null}

      <section className="cc-section cc-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="cc-page-header" style={{ padding: "20px 22px 0" }}>
          <div>
            <p className="cc-card-kicker">可加入的房間</p>
            <h2 className="cc-h2">Rooms 列表</h2>
            <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
              現在這些房間才是會真正影響使用體驗的地方。房間數量不重要，進房規則、音訊穩定與續場邏輯才重要。
            </p>
          </div>
          <span className="cc-pill-soft">{rooms.length} rooms</span>
        </div>

        {rooms.length > 0 ? (
          <ul className="cc-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link className="cc-listlink" href={`/rooms/${room.id}`}>
                  <div className="cc-stack-sm">
                    <div className="cc-row" style={{ flexWrap: "wrap" }}>
                      <span className="cc-h3">{room.title}</span>
                      <span className="cc-pill-soft">{modeLabel(room.mode)}</span>
                    </div>
                    <div className="cc-row cc-muted" style={{ flexWrap: "wrap", fontSize: "0.92rem" }}>
                      <span>{room.duration_minutes} 分鐘</span>
                      <span>·</span>
                      <span>最多 {room.max_size} 人</span>
                      <span>·</span>
                      <span>建立於 {new Date(room.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="cc-btn-link">進房 →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cc-empty-state">
            <div className="cc-stack-sm">
              <div className="cc-h3">目前還沒有可用的 Rooms</div>
              <div className="cc-muted">先在 Supabase Table Editor 建幾筆測試資料，這裡就會接上。</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
