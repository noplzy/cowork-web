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
  descForRoomScene,
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
    active: {
      borderColor: "rgba(155, 186, 169, 0.44)",
      background: "rgba(135, 170, 151, 0.12)",
    },
    subtle: {
      borderColor: "rgba(155, 186, 169, 0.22)",
      background: "rgba(135, 170, 151, 0.10)",
    },
    line: "rgba(155, 186, 169, 0.96)",
  },
  life: {
    active: {
      borderColor: "rgba(245, 181, 150, 0.42)",
      background: "rgba(245, 181, 150, 0.12)",
    },
    subtle: {
      borderColor: "rgba(245, 181, 150, 0.22)",
      background: "rgba(245, 181, 150, 0.10)",
    },
    line: "rgba(245, 181, 150, 0.96)",
  },
  share: {
    active: {
      borderColor: "rgba(161, 179, 204, 0.42)",
      background: "rgba(161, 179, 204, 0.12)",
    },
    subtle: {
      borderColor: "rgba(161, 179, 204, 0.22)",
      background: "rgba(161, 179, 204, 0.10)",
    },
    line: "rgba(161, 179, 204, 0.96)",
  },
  hobby: {
    active: {
      borderColor: "rgba(196, 170, 196, 0.42)",
      background: "rgba(196, 170, 196, 0.12)",
    },
    subtle: {
      borderColor: "rgba(196, 170, 196, 0.22)",
      background: "rgba(196, 170, 196, 0.10)",
    },
    line: "rgba(196, 170, 196, 0.96)",
  },
};

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人同行" : "小組同行";
}

function subtleSceneCardStyle(scene: ActiveRoomScene): CSSProperties {
  return SCENE_TONES[scene].subtle;
}

function sceneButtonStyle(scene: ActiveRoomScene, active: boolean): CSSProperties {
  if (!active) return {};
  return SCENE_TONES[scene].active;
}

function buildSceneCounts<T>(rows: T[], getScene: (row: T) => ActiveRoomScene): Record<SceneFilter, number> {
  const base: Record<SceneFilter, number> = {
    all: rows.length,
    focus: 0,
    life: 0,
    share: 0,
    hobby: 0,
  };
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
  const [loadingSchedule, setLoadingSchedule] = useState(true);
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
    setLoadingSchedule(true);
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
      setLoadingSchedule(false);
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
    () =>
      rooms.map((room) => ({
        ...room,
        ui_scene: normalizeRoomCategoryForUi(room.room_category),
      })),
    [rooms],
  );

  const normalizedSchedulePosts = useMemo(
    () =>
      schedulePosts.map((post) => ({
        ...post,
        ui_scene: normalizeRoomCategoryForUi(post.room_category),
      })),
    [schedulePosts],
  );

  const filteredRooms = useMemo(() => {
    if (activeScene === "all") return normalizedRooms;
    return normalizedRooms.filter((room) => room.ui_scene === activeScene);
  }, [activeScene, normalizedRooms]);

  const filteredSchedulePosts = useMemo(() => {
    if (activeScene === "all") return normalizedSchedulePosts;
    return normalizedSchedulePosts.filter((post) => post.ui_scene === activeScene);
  }, [activeScene, normalizedSchedulePosts]);

  const roomCounts = useMemo(() => buildSceneCounts(normalizedRooms, (room) => room.ui_scene), [normalizedRooms]);
  const scheduleCounts = useMemo(
    () => buildSceneCounts(normalizedSchedulePosts, (post) => post.ui_scene),
    [normalizedSchedulePosts],
  );

  const ownRoom = useMemo(() => normalizedRooms.find((room) => room.created_by === userId) ?? null, [normalizedRooms, userId]);
  const ownFutureScheduleCount = useMemo(
    () => normalizedSchedulePosts.filter((post) => post.host_user_id === userId).length,
    [normalizedSchedulePosts, userId],
  );

  const currentSceneLabel = activeScene === "all" ? "全部場景" : labelForRoomScene(activeScene);
  const currentSceneDesc =
    activeScene === "all"
      ? "先把現在可進房與排程專區都看一輪，再決定要不要縮小範圍。"
      : descForRoomScene(activeScene);
  const currentNowCount = filteredRooms.length;
  const currentScheduleCount = filteredSchedulePosts.length;
  const currentTone = activeScene === "all" ? null : SCENE_TONES[activeScene];

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
    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setMsg("已建立排程。若是邀請制，系統會自動產生邀請碼。");
    await reloadAll(accessToken);
  }

  async function deleteSchedulePost(postId: string) {
    setBusy(true);
    setMsg("");
    const result = await supabase.from("scheduled_room_posts").delete().eq("id", postId).eq("host_user_id", userId);
    setBusy(false);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

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

    if (!resp.ok) {
      setMsg(json?.error || "建立同行空間失敗。");
      return;
    }

    const nextRoomId = json?.room?.id as string | undefined;
    const inviteCode = json?.invite_code as string | null | undefined;
    setMsg(inviteCode ? `已建立同行空間。邀請碼：${inviteCode}` : "已建立同行空間。");
    await reloadAll(accessToken);
    if (nextRoomId) {
      router.push(`/rooms/${nextRoomId}`);
    }
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

    if (!resp.ok) {
      setMsg(json?.error || "查找邀請碼失敗。");
      return;
    }

    if (json.kind === "room") {
      setInviteResult({ kind: "room", room: json.room as Room });
      return;
    }

    if (json.kind === "schedule") {
      setInviteResult({ kind: "schedule", post: json.post as ScheduledRoomPostRow });
      return;
    }
  }

  function openInvitedRoom(inviteCode: string, roomId: string) {
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!normalizedCode || !roomId) return;
    router.push(`/rooms/${roomId}?invite=${encodeURIComponent(normalizedCode)}`);
  }

  const summaryItems = [
    { label: "本月剩餘", value: status?.is_vip ? "∞" : status?.credits_remaining ?? "?" },
    { label: "每月額度", value: status?.is_vip ? "VIP" : status?.free_monthly_allowance ?? "?" },
    { label: "週期起點", value: status?.month_start ?? "讀取中…" },
  ];

  const sceneCountSource = contentMode === "now" ? roomCounts : scheduleCounts;

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Shared Spaces</span>
          <p className="cc-eyebrow">同行空間｜先決定場景，再選擇現在進房或排程安排</p>
          <h1 className="cc-h1" style={{ maxWidth: "9.5ch" }}>
            先選場景，再決定現在進房，還是先排時間。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "48ch", marginTop: 0 }}>
            Rooms 只承接低壓力的同行空間：專注任務、生活陪伴、主題分享與興趣同好。
            付費型專業服務不放在這裡，之後由安感夥伴承接。
          </p>

          <div className="cc-stack-sm">
            <div className="cc-field-label">場景篩選</div>
            <div className="cc-action-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="cc-btn"
                onClick={() => setActiveScene("all")}
                style={
                  activeScene === "all"
                    ? { borderColor: "rgba(255, 171, 141, 0.28)", background: "rgba(255, 171, 141, 0.12)" }
                    : undefined
                }
              >
                全部場景 <span className="cc-pill-soft">{sceneCountSource.all}</span>
              </button>
              {ACTIVE_ROOM_SCENE_OPTIONS.map((scene) => (
                <button
                  key={scene.value}
                  type="button"
                  className="cc-btn"
                  onClick={() => setActiveScene(scene.value)}
                  style={sceneButtonStyle(scene.value, activeScene === scene.value)}
                >
                  {scene.label}
                  <span className="cc-pill-soft">{sceneCountSource[scene.value]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cc-stack-sm">
            <div className="cc-field-label">內容區</div>
            <div className="cc-action-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className={contentMode === "now" ? "cc-btn-primary" : "cc-btn"}
                onClick={() => setContentMode("now")}
              >
                現在可進房 <span className="cc-pill-soft">{currentNowCount}</span>
              </button>
              <button
                type="button"
                className={contentMode === "schedule" ? "cc-btn-primary" : "cc-btn"}
                onClick={() => setContentMode("schedule")}
              >
                排程專區 <span className="cc-pill-soft">{currentScheduleCount}</span>
              </button>
            </div>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">本月使用權益</p>
                <h2 className="cc-h2">規則先清楚，場景才放得開。</h2>
              </div>
              <span className={status?.is_vip ? "cc-pill-success" : "cc-pill-warning"}>
                {status?.is_vip ? "VIP" : "FREE"}
              </span>
            </div>

            <div className="cc-grid-3" style={{ gap: 12 }}>
              {summaryItems.map((item) => (
                <div key={item.label} className="cc-panel">
                  <div className="cc-caption">{item.label}</div>
                  <div className="cc-h2" style={{ marginTop: 8, fontSize: item.label === "週期起點" ? "1.15rem" : "2rem" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="cc-card cc-card-soft cc-stack-sm"
              style={{ ...(currentTone ? subtleSceneCardStyle(activeScene as ActiveRoomScene) : {}), padding: 18 }}
            >
              <p className="cc-card-kicker">目前視角</p>
              <div className="cc-h3">{currentSceneLabel}</div>
              <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                立即加入：{currentNowCount} 間 · 排程板：{currentScheduleCount} 筆
              </div>
              <div className="cc-caption" style={{ lineHeight: 1.7 }}>
                {currentSceneDesc}
              </div>
            </div>
          </div>

          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">邀請碼入口</p>
              <h2 className="cc-h2">輸入邀請碼，查看邀請房或邀請排程</h2>
            </div>
            <div className="cc-action-row" style={{ marginTop: 0, alignItems: "center" }}>
              <input
                className="cc-input"
                style={{ flex: 1, minWidth: 0 }}
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="例如：AB12CD34"
              />
              <button type="button" className="cc-btn" onClick={resolveInviteCode} disabled={busy || !inviteCodeInput.trim()}>
                查找
              </button>
            </div>

            {inviteResult?.kind === "room" ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">{inviteResult.room.title}</div>
                <div className="cc-muted">
                  {labelForRoomScene(inviteResult.room.room_category)} · {labelForInteractionStyle(inviteResult.room.interaction_style)}
                </div>
                <button
                  type="button"
                  className="cc-btn-primary"
                  disabled={busy}
                  onClick={() => openInvitedRoom(inviteResult.room.invite_code ?? inviteCodeInput, inviteResult.room.id)}
                >
                  前往邀請房
                </button>
              </div>
            ) : null}

            {inviteResult?.kind === "schedule" ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">{inviteResult.post.title}</div>
                <div className="cc-muted">{formatDateTimeRange(inviteResult.post.start_at, inviteResult.post.end_at)}</div>
                <div className="cc-caption">
                  {labelForRoomScene(inviteResult.post.room_category)} · {labelForInteractionStyle(inviteResult.post.interaction_style)}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section" style={{ whiteSpace: "pre-line" }}>
          {msg}
        </div>
      ) : null}

      {loading ? (
        <section className="cc-section cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在讀取同行空間…</div>
            <div className="cc-muted">請稍等，系統正在整理目前可見的房間與排程。</div>
          </div>
        </section>
      ) : null}

      {!loading && contentMode === "now" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">建立同行空間</p>
              <h2 className="cc-h2">每位使用者同時只能維持 1 間即時同行空間</h2>
              <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                建立後會直接幫你生成可加入的房間。若是邀請制，系統會自動給你邀請碼。
              </p>
            </div>

            {ownRoom ? (
              <div className="cc-note cc-stack-sm">
                <div className="cc-h3">你目前已有一間同行空間</div>
                <div className="cc-muted">{ownRoom.title}</div>
                <div className="cc-action-row" style={{ marginTop: 0 }}>
                  <Link href={`/rooms/${ownRoom.id}`} className="cc-btn-primary">
                    進入我的房間
                  </Link>
                  {ownRoom.visibility === "invited" && ownRoom.invite_code ? (
                    <span className="cc-pill-accent">邀請碼：{ownRoom.invite_code}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <label className="cc-field">
                  <span className="cc-field-label">名稱</span>
                  <input
                    className="cc-input"
                    value={instantTitle}
                    onChange={(e) => setInstantTitle(e.target.value)}
                    placeholder="例如：晚間共工 50 分鐘｜安靜同行"
                  />
                </label>

                <div className="cc-grid-2">
                  <label className="cc-field">
                    <span className="cc-field-label">場景</span>
                    <select
                      className="cc-select"
                      value={activeScene === "all" ? instantCategory : activeScene}
                      onChange={(e) => setInstantCategory(e.target.value as RoomCategory)}
                      disabled={activeScene !== "all"}
                    >
                      {ACTIVE_ROOM_SCENE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="cc-field">
                    <span className="cc-field-label">互動形式</span>
                    <select className="cc-select" value={instantInteraction} onChange={(e) => setInstantInteraction(e.target.value as InteractionStyle)}>
                      {INTERACTION_STYLE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cc-grid-3" style={{ gap: 12 }}>
                  <label className="cc-field">
                    <span className="cc-field-label">房型</span>
                    <select
                      className="cc-select"
                      value={instantMode}
                      onChange={(e) => {
                        const nextMode = e.target.value as "pair" | "group";
                        setInstantMode(nextMode);
                        if (nextMode === "pair") setInstantSize(2);
                        if (nextMode === "group" && ![2, 4, 6].includes(instantSize)) {
                          setInstantSize(2);
                        }
                      }}
                    >
                      <option value="group">小組同行</option>
                      <option value="pair">雙人同行</option>
                    </select>
                  </label>

                  <label className="cc-field">
                    <span className="cc-field-label">長度</span>
                    <select className="cc-select" value={instantDuration} onChange={(e) => setInstantDuration(Number(e.target.value))}>
                      {INSTANT_ROOM_DURATION_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {formatDurationLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="cc-field">
                    <span className="cc-field-label">可見性</span>
                    <select className="cc-select" value={instantVisibility} onChange={(e) => setInstantVisibility(e.target.value as ScheduleVisibility)}>
                      {SCHEDULE_VISIBILITY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {instantMode === "group" ? (
                  <label className="cc-field">
                    <span className="cc-field-label">名額上限</span>
                    <select className="cc-select" value={instantSize} onChange={(e) => setInstantSize(Number(e.target.value))}>
                      {[2, 4, 6].map((item) => (
                        <option key={item} value={item}>
                          {item} 人
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="cc-field">
                  <span className="cc-field-label">補充說明</span>
                  <textarea
                    className="cc-textarea"
                    value={instantNote}
                    onChange={(e) => setInstantNote(e.target.value)}
                    placeholder="例如：這場以安靜整理報表為主，中間只會簡短打招呼。"
                  />
                </label>

                <button type="button" className="cc-btn-primary" onClick={createInstantRoom} disabled={busy || !instantTitle.trim()}>
                  {busy ? "建立中…" : "建立同行空間"}
                </button>
              </>
            )}
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">現在可進房</p>
                <h2 className="cc-h2">{currentSceneLabel} 的即時同行空間</h2>
              </div>
              <span className="cc-pill-soft">{currentNowCount} spaces</span>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="cc-note">目前沒有符合這個場景的即時房。你可以先建立一間，或切去排程專區把時間掛出來。</div>
            ) : (
              <ul className="cc-list">
                {filteredRooms.map((room) => {
                  const sceneTone = SCENE_TONES[room.ui_scene];
                  return (
                    <li key={room.id}>
                      <Link className="cc-listlink" href={`/rooms/${room.id}`} style={{ borderLeft: `4px solid ${sceneTone.line}` }}>
                        <div className="cc-stack-sm">
                          <div className="cc-row" style={{ flexWrap: "wrap" }}>
                            <span className="cc-h3">{room.title}</span>
                            <span className="cc-pill-soft" style={subtleSceneCardStyle(room.ui_scene)}>
                              {labelForRoomScene(room.ui_scene)}
                            </span>
                            <span className="cc-pill-soft">{labelForInteractionStyle(room.interaction_style)}</span>
                            <span className="cc-pill-soft">{labelForVisibility(room.visibility)}</span>
                            <span className="cc-pill-soft">{modeLabel(room.mode)}</span>
                            <span className="cc-pill-soft">{formatDurationLabel(room.duration_minutes)}</span>
                          </div>
                          <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                            最多 {room.max_size} 人 · 建立於 {new Date(room.created_at).toLocaleDateString("zh-TW")}
                          </div>
                          {room.host_note ? <div className="cc-caption">{room.host_note}</div> : null}
                          {room.created_by === userId && room.visibility === "invited" && room.invite_code ? (
                            <div className="cc-pill-accent">邀請碼：{room.invite_code}</div>
                          ) : null}
                        </div>
                        <span className="cc-btn-link">查看房間 →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </section>
      ) : null}

      {!loading && contentMode === "schedule" ? (
        <section className="cc-section cc-grid-2" style={{ alignItems: "start", gap: 18 }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">排程專區</p>
              <h2 className="cc-h2">每位使用者最多只能安排 2 間未開始的排程房</h2>
              <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                一旦超過開始時間，系統會自動清除過期排程，避免過期資料一直堆在排程板上。
              </p>
            </div>

            <div className="cc-note">
              你目前已安排 {ownFutureScheduleCount} / 2 間未開始排程。
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
                <select
                  className="cc-select"
                  value={activeScene === "all" ? roomCategory : activeScene}
                  onChange={(e) => setRoomCategory(e.target.value as RoomCategory)}
                  disabled={activeScene !== "all"}
                >
                  {ACTIVE_ROOM_SCENE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-field">
                <span className="cc-field-label">互動形式</span>
                <select className="cc-select" value={interactionStyle} onChange={(e) => setInteractionStyle(e.target.value as InteractionStyle)}>
                  {INTERACTION_STYLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
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
                  min={minDatetimeLocalValue()}
                  value={startAtInput}
                  onChange={(e) => setStartAtInput(e.target.value)}
                />
              </label>

              <label className="cc-field">
                <span className="cc-field-label">可見性</span>
                <select className="cc-select" value={scheduleVisibility} onChange={(e) => setScheduleVisibility(e.target.value as ScheduleVisibility)}>
                  {SCHEDULE_VISIBILITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cc-grid-2">
              <label className="cc-field">
                <span className="cc-field-label">長度</span>
                <select className="cc-select" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                  {SCHEDULE_DURATION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {formatDurationLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-field">
                <span className="cc-field-label">名額上限</span>
                <select className="cc-select" value={seatLimit} onChange={(e) => setSeatLimit(Number(e.target.value))}>
                  {SCHEDULE_SEAT_LIMIT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item} 人
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="cc-field">
              <span className="cc-field-label">補充說明</span>
              <textarea
                className="cc-textarea"
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
                placeholder="例如：這場以安靜整理報表為主，中間只會簡短打招呼。"
              />
            </label>

            <button
              type="button"
              className="cc-btn-primary"
              onClick={createSchedulePost}
              disabled={busy || ownFutureScheduleCount >= 2 || !scheduleTitle.trim()}
            >
              {busy ? "建立中…" : "建立排程"}
            </button>
          </article>

          <article className="cc-card cc-stack-md">
            <div className="cc-page-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="cc-card-kicker">排程板</p>
                <h2 className="cc-h2">{currentSceneLabel} 的即將到來安排</h2>
              </div>
              <span className="cc-pill-soft">{currentScheduleCount} posts</span>
            </div>

            {loadingSchedule ? (
              <div className="cc-note">正在讀取排程板…</div>
            ) : filteredSchedulePosts.length === 0 ? (
              <div className="cc-note">目前沒有符合這個場景的排程。你可以先把你的時間掛上去。</div>
            ) : (
              <div className="cc-stack-sm">
                {filteredSchedulePosts.map((post) => {
                  const host = hostProfiles[post.host_user_id];
                  const isOwn = post.host_user_id === userId;
                  const tone = SCENE_TONES[post.ui_scene];
                  return (
                    <article key={post.id} className="cc-card cc-card-outline cc-stack-sm" style={{ borderLeft: `4px solid ${tone.line}` }}>
                      <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div className="cc-stack-sm" style={{ flex: 1, minWidth: 0 }}>
                          <div className="cc-row" style={{ flexWrap: "wrap" }}>
                            <span className="cc-h3">{post.title}</span>
                            <span className="cc-pill-soft" style={subtleSceneCardStyle(post.ui_scene)}>{labelForRoomScene(post.ui_scene)}</span>
                            <span className="cc-pill-soft">{labelForInteractionStyle(post.interaction_style)}</span>
                          </div>
                          <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                            {formatDateTimeRange(post.start_at, post.end_at)}
                            <br />
                            名額 {post.seat_limit} 人 · {labelForVisibility(post.visibility)} · {formatDurationLabel(post.duration_minutes)}
                          </div>
                          {post.note ? <div className="cc-note">{post.note}</div> : null}
                          {isOwn && post.visibility === "invited" && post.invite_code ? (
                            <div className="cc-pill-accent">邀請碼：{post.invite_code}</div>
                          ) : null}
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
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
