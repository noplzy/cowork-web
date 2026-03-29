"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchAccountStatus, type AccountStatusResp } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { ensureOwnProfile } from "@/lib/profileClient";
import {
  INTERACTION_STYLE_OPTIONS,
  ROOM_CATEGORY_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SCHEDULE_SEAT_LIMIT_OPTIONS,
  SCHEDULE_VISIBILITY_OPTIONS,
  formatDateTimeRange,
  formatDurationLabel,
  labelForInteractionStyle,
  labelForRoomCategory,
  labelForVisibility,
  toDatetimeLocalValue,
  type InteractionStyle,
  type PublicProfileRow,
  type RoomCategory,
  type ScheduleVisibility,
} from "@/lib/socialProfile";

type Room = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
};

type ScheduledRoomPostRow = {
  id: string;
  host_user_id: string;
  title: string;
  room_category: RoomCategory;
  interaction_style: InteractionStyle;
  visibility: ScheduleVisibility;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  seat_limit: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人同行" : "小組同行";
}

function costLabel(minutes: number) {
  return `${Math.ceil(minutes / 25)} 場`;
}

export default function RoomsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const [ownProfile, setOwnProfile] = useState<PublicProfileRow | null>(null);
  const [schedulePosts, setSchedulePosts] = useState<ScheduledRoomPostRow[]>([]);
  const [hostProfiles, setHostProfiles] = useState<Record<string, PublicProfileRow>>({});

  const [scheduleTitle, setScheduleTitle] = useState("晚間共工 50 分鐘｜安靜同行");
  const [roomCategory, setRoomCategory] = useState<RoomCategory>("focus");
  const [interactionStyle, setInteractionStyle] = useState<InteractionStyle>("silent");
  const [scheduleVisibility, setScheduleVisibility] = useState<ScheduleVisibility>("public");
  const [startAtInput, setStartAtInput] = useState(toDatetimeLocalValue());
  const [durationMinutes, setDurationMinutes] = useState<number>(50);
  const [seatLimit, setSeatLimit] = useState<number>(4);
  const [scheduleNote, setScheduleNote] = useState("");

  const endAtIso = useMemo(() => {
    const start = new Date(startAtInput);
    if (Number.isNaN(start.getTime())) return "";
    return new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString();
  }, [durationMinutes, startAtInput]);

  async function loadScheduleBoard(nextUserId: string) {
    setLoadingSchedule(true);

    const postsResult = await supabase
      .from("scheduled_room_posts")
      .select("*")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(30);

    if (postsResult.error) throw postsResult.error;

    const postRows = (postsResult.data ?? []) as ScheduledRoomPostRow[];
    setSchedulePosts(postRows);

    const hostIds = Array.from(new Set(postRows.map((item) => item.host_user_id)));
    if (hostIds.length === 0) {
      setHostProfiles({});
      setLoadingSchedule(false);
      return;
    }

    const profilesResult = await supabase.from("profiles").select("*").in("user_id", hostIds);
    if (profilesResult.error) throw profilesResult.error;

    const profileMap = Object.fromEntries(
      ((profilesResult.data ?? []) as PublicProfileRow[]).map((item) => [item.user_id, item]),
    );
    setHostProfiles(profileMap);
    setLoadingSchedule(false);
  }

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
      setUserId(session.user.id);

      const [statusResult, roomsResult, ownProfileResult] = await Promise.all([
        session.accessToken ? fetchAccountStatus(session.accessToken).catch(() => null) : Promise.resolve(null),
        supabase
          .from("rooms")
          .select("id,title,duration_minutes,mode,max_size,created_at")
          .order("created_at", { ascending: false }),
        ensureOwnProfile(session.user),
      ]);

      if (cancelled) return;
      if (statusResult) setStatus(statusResult);
      setOwnProfile(ownProfileResult);

      if (roomsResult.error) {
        setMsg(roomsResult.error.message);
      } else {
        setRooms((roomsResult.data as Room[]) ?? []);
      }

      try {
        await loadScheduleBoard(session.user.id);
      } catch (error) {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "讀取排程失敗");
          setLoadingSchedule(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function createSchedulePost() {
    if (!userId) return;
    if (!scheduleTitle.trim()) {
      setMsg("請先填寫排程名稱。");
      return;
    }

    const start = new Date(startAtInput);
    if (Number.isNaN(start.getTime())) {
      setMsg("請填寫正確的開始時間。");
      return;
    }

    if (!SCHEDULE_DURATION_OPTIONS.includes(durationMinutes as (typeof SCHEDULE_DURATION_OPTIONS)[number])) {
      setMsg("排程長度目前只支援 25 / 50 / 75 / 100 分鐘。");
      return;
    }

    if (!SCHEDULE_SEAT_LIMIT_OPTIONS.includes(seatLimit as (typeof SCHEDULE_SEAT_LIMIT_OPTIONS)[number])) {
      setMsg("名額上限目前只支援 2 / 4 / 6 人。");
      return;
    }

    setBusy(true);
    setMsg("");

    const result = await supabase.from("scheduled_room_posts").insert({
      host_user_id: userId,
      title: scheduleTitle.trim().slice(0, 80),
      room_category: roomCategory,
      interaction_style: interactionStyle,
      visibility: scheduleVisibility,
      start_at: start.toISOString(),
      end_at: endAtIso || new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString(),
      duration_minutes: durationMinutes,
      seat_limit: seatLimit,
      note: scheduleNote.trim() || null,
    });

    setBusy(false);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setMsg("已建立排程。排程只是預告，不會自動建立即時房。真正進房仍走上方的同行空間列表。");
    await loadScheduleBoard(userId);
  }

  async function deleteSchedulePost(postId: string) {
    setBusy(true);
    setMsg("");

    const result = await supabase
      .from("scheduled_room_posts")
      .delete()
      .eq("id", postId)
      .eq("host_user_id", userId);

    setBusy(false);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setMsg("已刪除排程。");
    await loadScheduleBoard(userId);
  }

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Shared Spaces</span>
          <p className="cc-eyebrow">同行空間｜即時加入與後續安排都放在同一條主線裡</p>
          <h1 className="cc-h1">現在就進房，或先安排下一段有人一起的時間。</h1>
          <p className="cc-lead">
            這裡不只處理立即開始的房間，也收斂了排程功能。
            但規則先維持清楚：長度只用 25 分鐘為單位，人數只開放 2 / 4 / 6，避免把空間做成又亂又卡。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-soft">25m = 1 場</span>
            <span className="cc-pill-soft">50m = 2 場</span>
            <span className="cc-pill-soft">75m = 3 場</span>
            <span className="cc-pill-soft">100m = 4 場</span>
          </div>
          <div className="cc-action-row">
            <a href="#space-now" className="cc-btn-primary">看現在可進的房</a>
            <a href="#space-schedule" className="cc-btn">安排之後的時間</a>
            {ownProfile?.handle ? <Link href={`/u/${ownProfile.handle}`} className="cc-btn-link">我的公開檔案 →</Link> : null}
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
            <p className="cc-card-kicker">這一版先定死的規則</p>
            <h3 className="cc-h3">先把清楚做對，再談自由度。</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              排程長度只支援 25 / 50 / 75 / 100 分鐘；
              名額只支援 2 / 4 / 6 人。這不是偷懶，是避免計費與品質一起亂掉。
            </p>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          {msg}
        </div>
      ) : null}

      <section id="space-now" className="cc-section cc-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="cc-page-header" style={{ padding: "20px 22px 0" }}>
          <div>
            <p className="cc-card-kicker">現在就加入</p>
            <h2 className="cc-h2">可進入的同行空間</h2>
            <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
              這裡處理已經建立好的即時房；準備好就直接進去。
            </p>
          </div>
          <span className="cc-pill-soft">{rooms.length} spaces</span>
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
                      <span className="cc-pill-soft">{costLabel(room.duration_minutes)}</span>
                    </div>
                    <div className="cc-row cc-muted" style={{ flexWrap: "wrap", fontSize: "0.92rem" }}>
                      <span>{room.duration_minutes} 分鐘</span>
                      <span>·</span>
                      <span>最多 {room.max_size} 人</span>
                      <span>·</span>
                      <span>建立於 {new Date(room.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="cc-btn-link">進入空間 →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cc-empty-state">
            <div className="cc-stack-sm">
              <div className="cc-h3">目前還沒有可立即加入的同行空間</div>
              <div className="cc-muted">可以先往下安排排程，之後再一起上來。</div>
            </div>
          </div>
        )}
      </section>

      <section id="space-schedule" className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">安排之後的時間</p>
            <h2 className="cc-h2">排程開房</h2>
          </div>

          <div className="cc-note">
            排程板是同行空間的附屬功能，不是獨立主產品。它只先處理：什麼時候、什麼場景、幾分鐘、幾個人。
          </div>

          <label className="cc-field">
            <span className="cc-field-label">名稱</span>
            <input
              className="cc-input"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              placeholder="例如：週二晚上整理房｜輕聊天"
            />
          </label>

          <div className="cc-grid-2">
            <label className="cc-field">
              <span className="cc-field-label">場景</span>
              <select className="cc-select" value={roomCategory} onChange={(e) => setRoomCategory(e.target.value as RoomCategory)}>
                {ROOM_CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="cc-field">
              <span className="cc-field-label">互動形式</span>
              <select className="cc-select" value={interactionStyle} onChange={(e) => setInteractionStyle(e.target.value as InteractionStyle)}>
                {INTERACTION_STYLE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="cc-grid-2">
            <label className="cc-field">
              <span className="cc-field-label">開始時間</span>
              <input
                className="cc-input"
                type="datetime-local"
                value={startAtInput}
                onChange={(e) => setStartAtInput(e.target.value)}
              />
            </label>

            <label className="cc-field">
              <span className="cc-field-label">可見性</span>
              <select className="cc-select" value={scheduleVisibility} onChange={(e) => setScheduleVisibility(e.target.value as ScheduleVisibility)}>
                {SCHEDULE_VISIBILITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="cc-grid-2">
            <label className="cc-field">
              <span className="cc-field-label">長度</span>
              <select className="cc-select" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                {SCHEDULE_DURATION_OPTIONS.map((item) => (
                  <option key={item} value={item}>{formatDurationLabel(item)}（{costLabel(item)}）</option>
                ))}
              </select>
            </label>

            <label className="cc-field">
              <span className="cc-field-label">名額上限</span>
              <select className="cc-select" value={seatLimit} onChange={(e) => setSeatLimit(Number(e.target.value))}>
                {SCHEDULE_SEAT_LIMIT_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item} 人</option>
                ))}
              </select>
            </label>
          </div>

          <label className="cc-field">
            <span className="cc-field-label">補充說明</span>
            <textarea
              className="cc-input"
              rows={4}
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
              placeholder="例如：這場以安靜整理報表為主，中間只會簡短打招呼。"
            />
          </label>

          <div className="cc-caption">
            規則固定：長度只支援 25 的倍數；名額只支援 2 / 4 / 6。這樣免費額度、畫面品質與產品承諾才不會一起失控。
          </div>

          <div className="cc-action-row">
            <button className="cc-btn-primary" type="button" onClick={createSchedulePost} disabled={busy}>
              {busy ? "建立中…" : "建立排程"}
            </button>
            <Link href="/friends" className="cc-btn">好友</Link>
            <Link href="/account" className="cc-btn">我的帳號</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">即將到來</p>
            <h2 className="cc-h2">排程板</h2>
          </div>

          {loadingSchedule ? (
            <div className="cc-note">正在讀取即將到來的同行安排…</div>
          ) : schedulePosts.length === 0 ? (
            <div className="cc-note">目前還沒有公開排程。你可以成為第一個先把時間掛出來的人。</div>
          ) : (
            <div className="cc-stack-sm">
              {schedulePosts.map((post) => {
                const host = hostProfiles[post.host_user_id];
                const isOwn = post.host_user_id === userId;
                return (
                  <article key={post.id} className="cc-card cc-card-outline cc-stack-sm">
                    <div className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div className="cc-stack-sm" style={{ flex: 1, minWidth: 0 }}>
                        <div className="cc-row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <span className="cc-h3">{post.title}</span>
                          <span className="cc-pill-soft">{labelForRoomCategory(post.room_category)}</span>
                          <span className="cc-pill-soft">{labelForInteractionStyle(post.interaction_style)}</span>
                        </div>
                        <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                          {formatDateTimeRange(post.start_at, post.end_at)}
                          <br />
                          名額 {post.seat_limit} 人 · {labelForVisibility(post.visibility)} · {formatDurationLabel(post.duration_minutes)}
                        </div>
                      </div>

                      <div className="cc-stack-sm" style={{ alignItems: "flex-end" }}>
                        <div className="cc-caption">房主：{host?.display_name ?? "安感島使用者"}</div>
                        {host?.handle ? <Link href={`/u/${host.handle}`} className="cc-btn-link">查看檔案 →</Link> : null}
                        {isOwn ? (
                          <button className="cc-btn" type="button" disabled={busy} onClick={() => deleteSchedulePost(post.id)}>
                            刪除
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {post.note ? <div className="cc-note">{post.note}</div> : null}
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
