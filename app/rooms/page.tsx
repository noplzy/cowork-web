"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";
import { fetchAccountStatus, type AccountStatusResp, clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

type Room = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
};

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人專注" : "小組共工";
}

export default function RoomsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<AccountStatusResp | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot();
      if (!session) {
        router.replace("/auth/login");
        return;
      }

      if (cancelled) return;
      setEmail(session.email);

      const [statusResult, roomsResult] = await Promise.all([
        session.accessToken ? fetchAccountStatus(session.accessToken).catch(() => null) : Promise.resolve(null),
        supabase
          .from("rooms")
          .select("id,title,duration_minutes,mode,max_size,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      if (statusResult) setStatus(statusResult);

      if (roomsResult.error) {
        setMsg(roomsResult.error.message);
        return;
      }

      setRooms((roomsResult.data as Room[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/auth/login");
  }

  return (
    <main className="cc-container">
      <TopNav email={email} onSignOut={signOut} />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Focus Rooms</span>
          <p className="cc-eyebrow">共工模式｜先開始，再穩穩把這段時間走完</p>
          <h1 className="cc-h1">選一個房間，替自己留出一段安靜可用的時間。</h1>
          <p className="cc-lead">
            在進房前先看清本場長度、房間類型與你的可用額度。規則越清楚，使用起來就越安心。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-soft">25m 扣 1 場</span>
            <span className="cc-pill-soft">50m 扣 2 場</span>
            <span className="cc-pill-success">VIP 可無限續場</span>
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
                正在讀取你的方案資訊…
              </p>
            )}
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">進房前先看一眼</p>
            <h3 className="cc-h3">先看清規則，再開始會更順。</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              每個房間都會清楚顯示時長、房型與人數上限。先理解本場怎麼進、怎麼續，使用時就不容易被打斷。
            </p>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          <strong>讀取失敗：</strong> {msg}
        </div>
      ) : null}

      <section className="cc-section cc-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="cc-page-header" style={{ padding: "20px 22px 0" }}>
          <div>
            <p className="cc-card-kicker">可加入的房間</p>
            <h2 className="cc-h2">Rooms 列表</h2>
            <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
              選一個適合你現在節奏的房間，準備好就可以開始。
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
              <div className="cc-h3">目前還沒有可加入的 Rooms</div>
              <div className="cc-muted">晚點再回來看看，或先到其他頁面逛逛。</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
