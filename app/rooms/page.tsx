"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchAccountStatus, type AccountStatusResp } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  ACTIVE_ROOM_SCENE_OPTIONS,
  INSTANT_ROOM_DURATION_OPTIONS,
  INTERACTION_STYLE_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SCHEDULE_SEAT_LIMIT_OPTIONS,
  SCHEDULE_VISIBILITY_OPTIONS,
  formatDateTimeRange,
  formatDurationLabel,
  labelForInteractionStyle,
  labelForRoomScene,
  labelForVisibility,
  normalizeRoomCategoryForUi,
  toDatetimeLocalValue,
  type ActiveRoomScene,
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
  created_by: string;
  daily_room_url?: string | null;
  room_category?: RoomCategory | null;
  interaction_style?: InteractionStyle | null;
  visibility?: ScheduleVisibility | null;
  host_note?: string | null;
  invite_code?: string | null;
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
  invite_code?: string | null;
};

type ContentMode = "now" | "schedule";
type SceneFilter = "all" | ActiveRoomScene;

type InviteResult =
  | { kind: "room"; room: Room }
  | { kind: "schedule"; post: ScheduledRoomPostRow }
  | null;

type SceneTone = {
  active: CSSProperties;
  subtle: CSSProperties;
  line: string;
};

const SCENE_TONES: Record<ActiveRoomScene, SceneTone> = {
  focus: {
    active: { borderColor: "rgba(155, 186, 169, 0.44)", background: "rgba(135, 170, 151, 0.12)" },
    subtle: { borderColor: "rgba(155, 186, 169, 0.22)", background: "rgba(135, 170, 151, 0.10)" },
    line: "rgba(155, 186, 169, 0.96)",
  },
  life: {
    active: { borderColor: "rgba(245, 181, 150, 0.42)", background: "rgba(245, 181, 150, 0.12)" },
    subtle: { borderColor: "rgba(245, 181, 150, 0.22)", background: "rgba(245, 181, 150, 0.10)" },
    line: "rgba(245, 181, 150, 0.96)",
  },
  share: {
    active: { borderColor: "rgba(161, 179, 204, 0.42)", background: "rgba(161, 179, 204, 0.12)" },
    subtle: { borderColor: "rgba(161, 179, 204, 0.22)", background: "rgba(161, 179, 204, 0.10)" },
    line: "rgba(161, 179, 204, 0.96)",
  },
  hobby: {
    active: { borderColor: "rgba(196, 170, 196, 0.42)", background: "rgba(196, 170, 196, 0.12)" },
    subtle: { borderColor: "rgba(196, 170, 196, 0.22)", background: "rgba(196, 170, 196, 0.10)" },
    line: "rgba(196, 170, 196, 0.96)",
  },
};

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人同行" : "小組同行";
}

function costLabel(minutes: number) {
  return `${Math.ceil(minutes / 25)} 場`;
}

function buildSceneCounts<T>(rows: T[], getScene: (row: T) => ActiveRoomScene): Record<SceneFilter, number> {
  const base: Record<SceneFilter, number> = { all: rows.length, focus: 0, life: 0, share: 0, hobby: 0 };
  rows.forEach((row) => {
    base[getScene(row)] += 1;
  });
  return base;
}

function minDatetimeLocalValue() {
  return toDatetimeLocalValue(new Date().toISOString());
}

async function loadRooms(): Promise<Room[]> {
  const result = await supabase
    .from("rooms")
    .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url,room_category,interaction_style,visibility,host_note,invite_code")
    .order("created_at", { ascending: false });

  if (result.error) throw result.error;
  return (result.data ?? []) as Room[];
}

export default function RoomsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedulePosts, setSchedulePosts] = useState<ScheduledRoomPostRow[]>([]);
  const [hostProfiles, setHostProfiles] = useState<Record<string, PublicProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeScene, setActiveScene] = useState<SceneFilter>("all");
  const [contentMode, setContentMode] = useState<ContentMode>("now");
  const [instantTitle, setInstantTitle] = useState("晚間共工 50 分鐘｜安靜同行");
  const [instantCategory, setInstantCategory] = useState<RoomCategory>("focus");
  const [instantInteraction, setInstantInteraction] = useState<InteractionStyle>("silent");
  const [instantVisibility, setInstantVisibility] = useState<ScheduleVisibility>("public");
  const [instantMode, setInstantMode] = useState<"pair" | "group">("group");
  const [instantDuration, setInstantDuration] = useState<number>(50);
  const [instantSize, setInstantSize] = useState<number>(4);
  const [instantNote, setInstantNote] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("晚間共工 50 分鐘｜安靜同行");
  const [roomCategory, setRoomCategory] = useState<RoomCategory>("focus");
  const [interactionStyle, setInteractionStyle] = useState<InteractionStyle>("silent");
  const [scheduleVisibility, setScheduleVisibility] = useState<ScheduleVisibility>("public");
  const [startAtInput, setStartAtInput] = useState(minDatetimeLocalValue());
  const [durationMinutes, setDurationMinutes] = useState<number>(50);
  const [seatLimit, setSeatLimit] = useState<number>(4);
  const [scheduleNote, setScheduleNote] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [inviteResult, setInviteResult] = useState<InviteResult>(null);

  useEffect(() => {
    if (activeScene !== "all") {
      setInstantCategory(activeScene);
      setRoomCategory(activeScene);
    }
  }, [activeScene]);

  async function loadScheduleBoard() {
    const postsResult = await supabase
      .from("scheduled_room_posts")
      .select("*")
      .gt("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(20);

    if (postsResult.error) throw postsResult.error;
    const postRows = (postsResult.data ?? []) as ScheduledRoomPostRow[];
    setSchedulePosts(postRows);

    const hostIds = Array.from(new Set(postRows.map((item) => item.host_user_id)));
    if (hostIds.length === 0) {
      setHostProfiles({});
      return;
    }

    const profilesResult = await supabase.from("profiles").select("*").in("user_id", hostIds);
    if (profilesResult.error) throw profilesResult.error;
    const profileMap = Object.fromEntries(((profilesResult.data ?? []) as PublicProfileRow[]).map((item) => [item.user_id, item]));
    setHostProfiles(profileMap);
  }

  async function reloadAll(currentAccessToken?: string) {
    setLoading(true);
    try {
      const [statusResult, roomRows] = await Promise.all([
        currentAccessToken ? fetchAccountStatus(currentAccessToken).catch(() => null) : Promise.resolve(null),
        loadRooms(),
      ]);
      if (statusResult) setStatus(statusResult);
      setRooms(roomRows);
      await loadScheduleBoard();
    } catch (error: any) {
      setMsg(error?.message || "讀取同行空間失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!session) {
        router.replace("/auth/login");
        return;
      }
      if (cancelled) return;
      setEmail(session.email);
      setUserId(session.user.id);
      setAccessToken(session.accessToken ?? "");
      await reloadAll(session.accessToken ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const normalizedRooms = useMemo(
    () => rooms.map((room) => ({ ...room, ui_scene: normalizeRoomCategoryForUi(room.room_category) })),
    [rooms],
  );

  const normalizedSchedulePosts = useMemo(
    () => schedulePosts.map((post) => ({ ...post, ui_scene: normalizeRoomCategoryForUi(post.room_category) })),
    [schedulePosts],
  );

  const filteredRooms = useMemo(
    () => (activeScene === "all" ? normalizedRooms : normalizedRooms.filter((room) => room.ui_scene === activeScene)),
    [activeScene, normalizedRooms],
  );
  const filteredSchedulePosts = useMemo(
    () => (activeScene === "all" ? normalizedSchedulePosts : normalizedSchedulePosts.filter((post) => post.ui_scene === activeScene)),
    [activeScene, normalizedSchedulePosts],
  );

  const roomCounts = useMemo(() => buildSceneCounts(normalizedRooms, (room) => room.ui_scene), [normalizedRooms]);
  const scheduleCounts = useMemo(() => buildSceneCounts(normalizedSchedulePosts, (post) => post.ui_scene), [normalizedSchedulePosts]);
  const ownRoom = useMemo(() => normalizedRooms.find((room) => room.created_by === userId) ?? null, [normalizedRooms, userId]);
  const ownFutureScheduleCount = useMemo(
    () => normalizedSchedulePosts.filter((post) => post.host_user_id === userId).length,
    [normalizedSchedulePosts, userId],
  );

  async function createSchedulePost() {
    setBusy(true);
    setMsg("");
    const result = await supabase.from("scheduled_room_posts").insert({
      host_user_id: userId,
      title: scheduleTitle.trim().slice(0, 80),
      room_category: activeScene === "all" ? roomCategory : activeScene,
      interaction_style: interactionStyle,
      visibility: scheduleVisibility,
      start_at: new Date(startAtInput).toISOString(),
      end_at: new Date(new Date(startAtInput).getTime() + durationMinutes * 60000).toISOString(),
      duration_minutes: durationMinutes,
      seat_limit: seatLimit,
      note: scheduleNote.trim() || null,
    });

    setBusy(false);
    if (result.error) return setMsg(result.error.message);
    setMsg("已建立排程。若是邀請制，系統會自動產生邀請碼。");
    await reloadAll(accessToken);
  }

  async function deleteSchedulePost(postId: string) {
    setBusy(true);
    setMsg("");
    const result = await supabase.from("scheduled_room_posts").delete().eq("id", postId).eq("host_user_id", userId);
    setBusy(false);
    if (result.error) return setMsg(result.error.message);
    setMsg("已刪除排程。");
    await reloadAll(accessToken);
  }

  async function createInstantRoom() {
    setBusy(true);
    setMsg("");
    const resp = await fetch("/api/rooms/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: instantTitle.trim(),
        duration_minutes: instantDuration,
        mode: instantMode,
        max_size: instantMode === "pair" ? 2 : instantSize,
        room_category: activeScene === "all" ? instantCategory : activeScene,
        interaction_style: instantInteraction,
        visibility: instantVisibility,
        host_note: instantNote.trim() || null,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) return setMsg(json?.error || "建立同行空間失敗。");
    const nextRoomId = json?.room?.id as string | undefined;
    const inviteCode = json?.invite_code as string | null | undefined;
    setMsg(inviteCode ? `已建立同行空間。邀請碼：${inviteCode}` : "已建立同行空間。");
    await reloadAll(accessToken);
    if (nextRoomId) router.push(`/rooms/${nextRoomId}`);
  }

  async function resolveInviteCode() {
    setBusy(true);
    setMsg("");
    setInviteResult(null);
    const resp = await fetch("/api/rooms/invite/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ inviteCode: inviteCodeInput }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) return setMsg(json?.error || "查找邀請碼失敗。");
    if (json.kind === "room") setInviteResult({ kind: "room", room: json.room as Room });
    if (json.kind === "schedule") setInviteResult({ kind: "schedule", post: json.post as ScheduledRoomPostRow });
  }

  async function joinInvitedRoom(inviteCode: string) {
    setBusy(true);
    setMsg("");
    const resp = await fetch("/api/rooms/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ inviteCode }),
    });
    const json = await resp.json().catch(() => ({} as any));
    setBusy(false);
    if (!resp.ok) return setMsg(json?.error || "加入邀請房失敗。");
    if (json?.roomId) router.push(`/rooms/${json.roomId}`);
  }

  const sceneCountSource = contentMode === "now" ? roomCounts : scheduleCounts;
  const topCards = [
    { title: "現在進房", body: "直接看現在可加入的房，想開始就馬上開始。" },
    { title: "建立房間", body: "想自己開節奏，就立刻建立一間房。" },
    { title: "排程安排", body: "現在不方便，也可以先把下一次時間掛上去。" },
  ];

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Rooms</span>
          <p className="cc-eyebrow">先決定你現在要做什麼，再挑工具。</p>
          <h1 className="cc-h1" style={{ maxWidth: "9ch" }}>
            現在進房，或先把時間排好。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "40ch" }}>
            Rooms 是安感島目前最成熟的主線。想立刻開始，就看現在可進房；想先約好，就去排程專區。
          </p>
          <div className="cc-action-row">
            <button type="button" className={contentMode === "now" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("now")}>
              現在可進房 <span className="cc-pill-soft">{filteredRooms.length}</span>
            </button>
            <button type="button" className={contentMode === "schedule" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("schedule")}>
              排程專區 <span className="cc-pill-soft">{filteredSchedulePosts.length}</span>
            </button>
          </div>
          <div className="cc-action-row" style={{ marginTop: 0 }}>
            {ACTIVE_ROOM_SCENE_OPTIONS.map((scene) => (
              <button
                key={scene.value}
                type="button"
                className={activeScene === scene.value ? "cc-btn-primary" : "cc-btn"}
                style={activeScene === scene.value ? SCENE_TONES[scene.value].active : undefined}
                onClick={() => setActiveScene(scene.value)}
              >
                {scene.label} <span className="cc-pill-soft">{sceneCountSource[scene.value]}</span>
              </button>
            ))}
            <button type="button" className={activeScene === "all" ? "cc-btn-primary" : "cc-btn"} onClick={() => setActiveScene("all")}>
              全部 <span className="cc-pill-soft">{sceneCountSource.all}</span>
            </button>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">快速理解</p>
              <h2 className="cc-h2">先知道這裡能幹嘛，不先看一堆規則。</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {topCards.map((card) => (
                <article key={card.title} className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 16 }}>
                  <div className="cc-h3">{card.title}</div>
                  <div className="cc-muted" style={{ lineHeight: 1.7 }}>{card.body}</div>
                </article>
              ))}
            </div>
            <div className="cc-note cc-stack-sm">
              <div>你的目前狀態：<strong>{status?.is_vip ? "VIP" : "FREE"}</strong></div>
              <div>本月剩餘：<strong>{status?.is_vip ? "不限" : `${status?.credits_remaining ?? "?"} / ${status?.free_monthly_allowance ?? "?"}`}</strong></div>
            </div>
          </div>
        </aside>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
        <article className="cc-card cc-stack-md">
          <div className="cc-page-header" style={{ marginBottom: 0 }}>
            <div>
              <p className="cc-card-kicker">{contentMode === "now" ? "現在可進房" : "排程板"}</p>
              <h2 className="cc-h2">{contentMode === "now" ? "先看現在有哪些房，想開始就直接進去。" : "先看接下來的安排，想要就先掛時間。"}</h2>
            </div>
            <span className="cc-pill-soft">{contentMode === "now" ? filteredRooms.length : filteredSchedulePosts.length}</span>
          </div>

          {loading ? (
            <div className="cc-card cc-empty-state">正在整理目前可見的房間與排程…</div>
          ) : contentMode === "now" ? (
            filteredRooms.length === 0 ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">目前這個場景還沒有即時房。</div>
                <div className="cc-muted">現在不是資訊不足，而是剛好還沒人開。你可以成為第一個開房的人。</div>
              </div>
            ) : (
              <ul className="cc-list">
                {filteredRooms.map((room) => (
                  <li key={room.id}>
                    <Link className="cc-listlink" href={`/rooms/${room.id}`} style={{ borderLeft: `4px solid ${SCENE_TONES[room.ui_scene].line}` }}>
                      <div className="cc-stack-sm">
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{room.title}</span>
                          <span className="cc-pill-soft">{labelForRoomScene(room.ui_scene)}</span>
                          <span className="cc-pill-soft">{labelForInteractionStyle(room.interaction_style)}</span>
                          <span className="cc-pill-soft">{labelForVisibility(room.visibility)}</span>
                          <span className="cc-pill-soft">{modeLabel(room.mode)}</span>
                          <span className="cc-pill-soft">{formatDurationLabel(room.duration_minutes)}</span>
                        </div>
                        <div className="cc-muted">最多 {room.max_size} 人 · 建立於 {new Date(room.created_at).toLocaleDateString("zh-TW")}</div>
                        {room.host_note ? <div className="cc-caption">{room.host_note}</div> : null}
                      </div>
                      <span className="cc-btn-link">進房 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : filteredSchedulePosts.length === 0 ? (
            <div className="cc-note cc-stack-sm">
              <div className="cc-h3">目前還沒有這個場景的排程。</div>
              <div className="cc-muted">如果你知道自己想在什麼時間開始，先掛出你的時間會比等別人更快。</div>
            </div>
          ) : (
            <div className="cc-stack-sm">
              {filteredSchedulePosts.map((post) => {
                const host = hostProfiles[post.host_user_id];
                return (
                  <article key={post.id} className="cc-card cc-card-outline cc-stack-sm" style={{ borderLeft: `4px solid ${SCENE_TONES[post.ui_scene].line}` }}>
                    <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div className="cc-stack-sm" style={{ flex: 1, minWidth: 0 }}>
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{post.title}</span>
                          <span className="cc-pill-soft">{labelForRoomScene(post.ui_scene)}</span>
                          <span className="cc-pill-soft">{labelForInteractionStyle(post.interaction_style)}</span>
                        </div>
                        <div className="cc-muted">{formatDateTimeRange(post.start_at, post.end_at)}</div>
                        <div className="cc-caption">房主：{host?.display_name ?? "安感島使用者"} · {labelForVisibility(post.visibility)} · {post.seat_limit} 人</div>
                        {post.note ? <div className="cc-note">{post.note}</div> : null}
                      </div>
                      {post.host_user_id === userId ? (
                        <button className="cc-btn" type="button" disabled={busy} onClick={() => deleteSchedulePost(post.id)}>
                          刪除
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">建立與加入</p>
            <h2 className="cc-h2">工具放右邊，讓內容先被看見。</h2>
          </div>

          <div className="cc-note cc-stack-sm">
            <div><strong>你現在要做哪一種？</strong></div>
            <div>想立刻開始，就建立即時房。</div>
            <div>想先約好，就建立排程。</div>
            <div>別人給你邀請碼，就直接在這裡輸入。</div>
          </div>

          <div className="cc-action-row" style={{ marginTop: 0 }}>
            <button type="button" className={contentMode === "now" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("now")}>
              建立即時房
            </button>
            <button type="button" className={contentMode === "schedule" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("schedule")}>
              建立排程
            </button>
          </div>

          {contentMode === "now" ? (
            ownRoom ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">你目前已有一間同行空間</div>
                <div className="cc-muted">{ownRoom.title}</div>
                <div className="cc-action-row">
                  <Link href={`/rooms/${ownRoom.id}`} className="cc-btn-primary">進入我的房間</Link>
                  {ownRoom.visibility === "invited" && ownRoom.invite_code ? <span className="cc-pill-accent">邀請碼：{ownRoom.invite_code}</span> : null}
                </div>
              </div>
            ) : (
              <>
                <label className="cc-field">
                  <span className="cc-field-label">房間名稱</span>
                  <input className="cc-input" value={instantTitle} onChange={(e) => setInstantTitle(e.target.value)} placeholder="例如：晚間共工 50 分鐘｜安靜同行" />
                </label>
                <div className="cc-grid-2">
                  <label className="cc-field">
                    <span className="cc-field-label">場景</span>
                    <select className="cc-select" value={activeScene === "all" ? instantCategory : activeScene} onChange={(e) => setInstantCategory(e.target.value as RoomCategory)} disabled={activeScene !== "all"}>
                      {ACTIVE_ROOM_SCENE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="cc-field">
                    <span className="cc-field-label">互動形式</span>
                    <select className="cc-select" value={instantInteraction} onChange={(e) => setInstantInteraction(e.target.value as InteractionStyle)}>
                      {INTERACTION_STYLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="cc-grid-3" style={{ gap: 12 }}>
                  <label className="cc-field">
                    <span className="cc-field-label">房型</span>
                    <select className="cc-select" value={instantMode} onChange={(e) => {
                      const nextMode = e.target.value as "pair" | "group";
                      setInstantMode(nextMode);
                      if (nextMode === "pair") setInstantSize(2);
                    }}>
                      <option value="group">小組同行</option>
                      <option value="pair">雙人同行</option>
                    </select>
                  </label>
                  <label className="cc-field">
                    <span className="cc-field-label">時長</span>
                    <select className="cc-select" value={instantDuration} onChange={(e) => setInstantDuration(Number(e.target.value))}>
                      {INSTANT_ROOM_DURATION_OPTIONS.map((item) => <option key={item} value={item}>{formatDurationLabel(item)}（{costLabel(item)}）</option>)}
                    </select>
                  </label>
                  <label className="cc-field">
                    <span className="cc-field-label">可見性</span>
                    <select className="cc-select" value={instantVisibility} onChange={(e) => setInstantVisibility(e.target.value as ScheduleVisibility)}>
                      {SCHEDULE_VISIBILITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
                {instantMode === "group" ? (
                  <label className="cc-field">
                    <span className="cc-field-label">名額上限</span>
                    <select className="cc-select" value={instantSize} onChange={(e) => setInstantSize(Number(e.target.value))}>
                      {[4, 6].map((item) => <option key={item} value={item}>{item} 人</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="cc-field">
                  <span className="cc-field-label">補充說明</span>
                  <textarea className="cc-textarea" value={instantNote} onChange={(e) => setInstantNote(e.target.value)} placeholder="例如：這場以安靜整理報表為主，中間只會簡短打招呼。" />
                </label>
                <button type="button" className="cc-btn-primary" onClick={createInstantRoom} disabled={busy || !instantTitle.trim()}>
                  {busy ? "建立中…" : "建立同行空間"}
                </button>
              </>
            )
          ) : (
            <>
              <div className="cc-note">你目前已安排 {ownFutureScheduleCount} / 2 間未開始排程。</div>
              <label className="cc-field">
                <span className="cc-field-label">排程名稱</span>
                <input className="cc-input" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="例如：週二晚上整理房｜輕聊天" />
              </label>
              <div className="cc-grid-2">
                <label className="cc-field">
                  <span className="cc-field-label">場景</span>
                  <select className="cc-select" value={activeScene === "all" ? roomCategory : activeScene} onChange={(e) => setRoomCategory(e.target.value as RoomCategory)} disabled={activeScene !== "all"}>
                    {ACTIVE_ROOM_SCENE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="cc-field">
                  <span className="cc-field-label">互動形式</span>
                  <select className="cc-select" value={interactionStyle} onChange={(e) => setInteractionStyle(e.target.value as InteractionStyle)}>
                    {INTERACTION_STYLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="cc-grid-2">
                <label className="cc-field">
                  <span className="cc-field-label">開始時間</span>
                  <input className="cc-input" type="datetime-local" min={minDatetimeLocalValue()} value={startAtInput} onChange={(e) => setStartAtInput(e.target.value)} />
                </label>
                <label className="cc-field">
                  <span className="cc-field-label">可見性</span>
                  <select className="cc-select" value={scheduleVisibility} onChange={(e) => setScheduleVisibility(e.target.value as ScheduleVisibility)}>
                    {SCHEDULE_VISIBILITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="cc-grid-2">
                <label className="cc-field">
                  <span className="cc-field-label">時長</span>
                  <select className="cc-select" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                    {SCHEDULE_DURATION_OPTIONS.map((item) => <option key={item} value={item}>{formatDurationLabel(item)}（{costLabel(item)}）</option>)}
                  </select>
                </label>
                <label className="cc-field">
                  <span className="cc-field-label">名額上限</span>
                  <select className="cc-select" value={seatLimit} onChange={(e) => setSeatLimit(Number(e.target.value))}>
                    {SCHEDULE_SEAT_LIMIT_OPTIONS.map((item) => <option key={item} value={item}>{item} 人</option>)}
                  </select>
                </label>
              </div>
              <label className="cc-field">
                <span className="cc-field-label">補充說明</span>
                <textarea className="cc-textarea" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="例如：這場以安靜整理報表為主，中間只會簡短打招呼。" />
              </label>
              <button type="button" className="cc-btn-primary" onClick={createSchedulePost} disabled={busy || ownFutureScheduleCount >= 2 || !scheduleTitle.trim()}>
                {busy ? "建立中…" : "建立排程"}
              </button>
            </>
          )}

          <hr className="cc-soft-divider" />

          <div className="cc-stack-sm">
            <div>
              <p className="cc-card-kicker">邀請碼入口</p>
              <h2 className="cc-h2">對方給你邀請碼時，不用先懂很多規則。</h2>
            </div>
            <div className="cc-action-row" style={{ marginTop: 0, alignItems: "center" }}>
              <input className="cc-input" style={{ flex: 1, minWidth: 0 }} value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())} placeholder="例如：AB12CD34" />
              <button type="button" className="cc-btn" onClick={resolveInviteCode} disabled={busy || !inviteCodeInput.trim()}>
                查找
              </button>
            </div>
            {inviteResult?.kind === "room" ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">{inviteResult.room.title}</div>
                <div className="cc-muted">{labelForRoomScene(normalizeRoomCategoryForUi(inviteResult.room.room_category))} · {labelForInteractionStyle((inviteResult.room.interaction_style ?? "silent") as InteractionStyle)}</div>
                <button type="button" className="cc-btn-primary" disabled={busy} onClick={() => joinInvitedRoom(inviteResult.room.invite_code ?? inviteCodeInput)}>
                  使用邀請碼加入
                </button>
              </div>
            ) : null}
            {inviteResult?.kind === "schedule" ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">{inviteResult.post.title}</div>
                <div className="cc-muted">{formatDateTimeRange(inviteResult.post.start_at, inviteResult.post.end_at)}</div>
                <div className="cc-caption">{labelForRoomScene(inviteResult.post.room_category)} · {labelForInteractionStyle(inviteResult.post.interaction_style)}</div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
