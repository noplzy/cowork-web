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
  daily_room_url?: string | null;
  room_category?: RoomCategory | null;
  interaction_style?: InteractionStyle | null;
  visibility?: ScheduleVisibility | null;
  host_note?: string | null;
};

type LegacyRoom = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
  daily_room_url?: string | null;
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

type ContentMode = "now" | "schedule";
type SceneFilter = "all" | ActiveRoomScene;

type SceneTone = {
  active: CSSProperties;
  subtle: CSSProperties;
  line: string;
};

const SCENE_TONES: Record<ActiveRoomScene, SceneTone> = {
  focus: {
    active: {
      borderColor: "rgba(126, 170, 150, 0.38)",
      background: "rgba(109, 139, 118, 0.16)",
      color: "var(--foreground)",
    },
    subtle: {
      borderColor: "rgba(126, 170, 150, 0.22)",
      background: "rgba(109, 139, 118, 0.10)",
    },
    line: "rgba(126, 170, 150, 0.95)",
  },
  life: {
    active: {
      borderColor: "rgba(234, 171, 141, 0.42)",
      background: "rgba(234, 171, 141, 0.14)",
      color: "var(--foreground)",
    },
    subtle: {
      borderColor: "rgba(234, 171, 141, 0.24)",
      background: "rgba(234, 171, 141, 0.10)",
    },
    line: "rgba(234, 171, 141, 0.95)",
  },
  share: {
    active: {
      borderColor: "rgba(140, 178, 214, 0.42)",
      background: "rgba(140, 178, 214, 0.14)",
      color: "var(--foreground)",
    },
    subtle: {
      borderColor: "rgba(140, 178, 214, 0.24)",
      background: "rgba(140, 178, 214, 0.10)",
    },
    line: "rgba(140, 178, 214, 0.95)",
  },
  hobby: {
    active: {
      borderColor: "rgba(193, 154, 199, 0.42)",
      background: "rgba(193, 154, 199, 0.14)",
      color: "var(--foreground)",
    },
    subtle: {
      borderColor: "rgba(193, 154, 199, 0.24)",
      background: "rgba(193, 154, 199, 0.10)",
    },
    line: "rgba(193, 154, 199, 0.95)",
  },
  pro: {
    active: {
      borderColor: "rgba(124, 148, 185, 0.42)",
      background: "rgba(124, 148, 185, 0.14)",
      color: "var(--foreground)",
    },
    subtle: {
      borderColor: "rgba(124, 148, 185, 0.24)",
      background: "rgba(124, 148, 185, 0.10)",
    },
    line: "rgba(124, 148, 185, 0.95)",
  },
};

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人同行" : "小組同行";
}

function costLabel(minutes: number) {
  return `${Math.ceil(minutes / 25)} 場`;
}

function inferLegacySceneFromTitle(title?: string | null): ActiveRoomScene {
  const value = (title ?? "").toLowerCase();
  if (["分享", "交流", "討論", "主題"].some((token) => value.includes(token))) return "share";
  if (["生活", "陪伴", "煮", "家務", "整理", "晚餐", "育兒"].some((token) => value.includes(token))) return "life";
  if (["興趣", "畫", "手作", "運動", "同好", "遊戲"].some((token) => value.includes(token))) return "hobby";
  if (["專業", "顧問", "教練", "陪跑", "服務"].some((token) => value.includes(token))) return "pro";
  return "focus";
}

function resolveRoomScene(room: Pick<Room, "room_category" | "title">): ActiveRoomScene {
  if (room.room_category) return normalizeRoomCategoryForUi(room.room_category);
  return inferLegacySceneFromTitle(room.title);
}

function sceneButtonStyle(scene: ActiveRoomScene, active: boolean): CSSProperties {
  if (!active) return {};
  return SCENE_TONES[scene].active;
}

function subtleSceneCardStyle(scene: ActiveRoomScene): CSSProperties {
  return SCENE_TONES[scene].subtle;
}

function buildSceneCounts<T>(rows: T[], getScene: (row: T) => ActiveRoomScene): Record<SceneFilter, number> {
  const base: Record<SceneFilter, number> = {
    all: rows.length,
    focus: 0,
    life: 0,
    share: 0,
    hobby: 0,
    pro: 0,
  };

  rows.forEach((row) => {
    const key = getScene(row);
    base[key] += 1;
  });

  return base;
}

async function loadRoomsWithFallback(): Promise<Room[]> {
  const enhanced = await supabase
    .from("rooms")
    .select(
      "id,title,duration_minutes,mode,max_size,created_at,daily_room_url,room_category,interaction_style,visibility,host_note",
    )
    .order("created_at", { ascending: false });

  if (!enhanced.error) {
    return (enhanced.data as Room[]) ?? [];
  }

  const message = enhanced.error.message ?? "";
  const missingExtendedColumns =
    /room_category|interaction_style|visibility|host_note/i.test(message) ||
    /Could not find the .* column/i.test(message) ||
    /does not exist/i.test(message);

  if (!missingExtendedColumns) {
    throw enhanced.error;
  }

  const fallback = await supabase
    .from("rooms")
    .select("id,title,duration_minutes,mode,max_size,created_at,daily_room_url")
    .order("created_at", { ascending: false });

  if (fallback.error) throw fallback.error;

  return ((fallback.data as LegacyRoom[]) ?? []).map((room) => ({
    ...room,
    room_category: null,
    interaction_style: null,
    visibility: null,
    host_note: null,
  }));
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

  const [schedulePosts, setSchedulePosts] = useState<ScheduledRoomPostRow[]>([]);
  const [hostProfiles, setHostProfiles] = useState<Record<string, PublicProfileRow>>({});

  const [activeScene, setActiveScene] = useState<SceneFilter>("all");
  const [contentMode, setContentMode] = useState<ContentMode>("now");

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

  useEffect(() => {
    if (activeScene !== "all" && roomCategory !== activeScene) {
      setRoomCategory(activeScene);
    }
  }, [activeScene, roomCategory]);

  async function loadScheduleBoard() {
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

      const [statusResult, roomsResult] = await Promise.all([
        session.accessToken ? fetchAccountStatus(session.accessToken).catch(() => null) : Promise.resolve(null),
        loadRoomsWithFallback(),
      ]);

      if (cancelled) return;
      if (statusResult) setStatus(statusResult);
      setRooms(roomsResult);

      try {
        await loadScheduleBoard();
      } catch (error) {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "讀取排程失敗");
          setLoadingSchedule(false);
        }
      }
    })().catch((error) => {
      if (!cancelled) {
        setMsg(error instanceof Error ? error.message : "讀取同行空間失敗");
      }
    });

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

    const insertCategory = activeScene === "all" ? roomCategory : activeScene;

    const result = await supabase.from("scheduled_room_posts").insert({
      host_user_id: userId,
      title: scheduleTitle.trim().slice(0, 80),
      room_category: insertCategory,
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

    setMsg("已建立排程。現在這頁的場景篩選、排程板與表單都會維持同一套語意。\n真正進房仍走「現在可進房」。");
    await loadScheduleBoard();
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
    await loadScheduleBoard();
  }

  const normalizedRooms = useMemo(
    () => rooms.map((room) => ({ ...room, ui_scene: resolveRoomScene(room) })),
    [rooms],
  );

  const normalizedSchedulePosts = useMemo(
    () => schedulePosts.map((post) => ({ ...post, ui_scene: normalizeRoomCategoryForUi(post.room_category) })),
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

  const currentSceneLabel = activeScene === "all" ? "全部場景" : labelForRoomScene(activeScene);
  const currentSceneDesc = activeScene === "all" ? "先把所有即時房與排程看完整，再決定要不要縮小。" : descForRoomScene(activeScene);
  const currentTone = activeScene === "all" ? null : SCENE_TONES[activeScene];
  const currentNowCount = filteredRooms.length;
  const currentScheduleCount = filteredSchedulePosts.length;
  const currentFormScene = activeScene === "all" ? roomCategory : activeScene;

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
        <div className="cc-card cc-stack-md" style={{ padding: 28 }}>
          <span className="cc-kicker">Shared Spaces</span>
          <p className="cc-eyebrow">同行空間｜先縮小你現在要看的場景，再決定要立刻進房還是安排之後的時間</p>
          <h1 className="cc-h1" style={{ fontSize: "clamp(2.3rem, 4vw, 4.6rem)", maxWidth: "8.5ch" }}>
            先選場景，再決定要現在進房，還是先把時間排起來。
          </h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8, maxWidth: "56ch" }}>
            這一頁先把產品結構做對：場景先行，內容分流。你看到的即時房、排程板與排程表單會維持同一套場景語意，而不是每一塊各講各的話。
          </p>

          <div className="cc-stack-sm">
            <div className="cc-field-label">場景篩選</div>
            <div className="cc-action-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="cc-btn"
                onClick={() => setActiveScene("all")}
                style={activeScene === "all" ? { borderColor: "rgba(234, 171, 141, 0.36)", background: "rgba(234, 171, 141, 0.12)" } : undefined}
              >
                全部場景
                <span className="cc-pill-soft" style={{ marginLeft: 2 }}>{contentMode === "now" ? roomCounts.all : scheduleCounts.all}</span>
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
                  <span className="cc-pill-soft" style={{ marginLeft: 2 }}>{contentMode === "now" ? roomCounts[scene.value] : scheduleCounts[scene.value]}</span>
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
                現在可進房
                <span className="cc-pill-soft" style={{ marginLeft: 2 }}>{currentNowCount}</span>
              </button>
              <button
                type="button"
                className={contentMode === "schedule" ? "cc-btn-primary" : "cc-btn"}
                onClick={() => setContentMode("schedule")}
              >
                排程專區
                <span className="cc-pill-soft" style={{ marginLeft: 2 }}>{currentScheduleCount}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="cc-stack-sm">
          <div className="cc-card cc-stack-sm" style={{ padding: 24 }}>
            <div className="cc-card-row" style={{ alignItems: "center" }}>
              <div>
                <p className="cc-card-kicker">本月使用權益</p>
                <h2 className="cc-h2">規則先清楚，場景才放得開。</h2>
              </div>
              <span className={status?.is_vip ? "cc-pill-success" : "cc-pill-warning"}>{status?.is_vip ? "VIP" : "FREE"}</span>
            </div>

            {status ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <div className="cc-panel" style={{ padding: "14px 16px" }}>
                  <div className="cc-caption">本月剩餘</div>
                  <div className="cc-h2" style={{ marginTop: 4 }}>{status.is_vip ? "∞" : (status.credits_remaining ?? "?")}</div>
                </div>
                <div className="cc-panel" style={{ padding: "14px 16px" }}>
                  <div className="cc-caption">每月額度</div>
                  <div className="cc-h2" style={{ marginTop: 4 }}>{status.is_vip ? "VIP" : status.free_monthly_allowance}</div>
                </div>
                <div className="cc-panel" style={{ padding: "14px 16px" }}>
                  <div className="cc-caption">週期起點</div>
                  <div className="cc-h3" style={{ marginTop: 8 }}>{status.month_start}</div>
                </div>
              </div>
            ) : (
              <div className="cc-note">正在讀取你的方案資訊…</div>
            )}
          </div>

          <div className="cc-grid-2">
            <div className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 20, ...(currentTone ? subtleSceneCardStyle(activeScene as ActiveRoomScene) : {}) }}>
              <p className="cc-card-kicker">目前視角</p>
              <h3 className="cc-h3">{currentSceneLabel}</h3>
              <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                {contentMode === "now"
                  ? `現在可進房：${currentNowCount} 間`
                  : `排程板：${currentScheduleCount} 筆`}
              </div>
              <div className="cc-caption" style={{ lineHeight: 1.7 }}>{currentSceneDesc}</div>
            </div>

            <div className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 20 }}>
              <p className="cc-card-kicker">固定規則</p>
              <div className="cc-muted-strong" style={{ lineHeight: 1.8 }}>
                排程仍只支援 25 / 50 / 75 / 100 分鐘，名額只支援 2 / 4 / 6 人。這不是偷懶，是避免免費額度、畫面品質與產品承諾一起失控。
              </div>
            </div>
          </div>
        </div>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section" style={{ whiteSpace: "pre-line" }}>{msg}</div> : null}

      {contentMode === "now" ? (
        <section id="space-now" className="cc-section cc-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="cc-page-header" style={{ padding: "22px 24px 0" }}>
            <div>
              <p className="cc-card-kicker">現在可進房</p>
              <h2 className="cc-h2">{currentSceneLabel} 的即時同行空間</h2>
              <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                這裡只顯示現在就能加入的房間。你不需要先看排程，也不需要猜這間房的場景屬性。
              </p>
            </div>
            <span className="cc-pill-soft">{currentNowCount} spaces</span>
          </div>

          {filteredRooms.length > 0 ? (
            <ul className="cc-list">
              {filteredRooms.map((room) => {
                const scene = room.ui_scene;
                const sceneTone = SCENE_TONES[scene];
                const interaction = room.interaction_style ?? "silent";
                const visibility = room.visibility ?? "public";
                return (
                  <li key={room.id}>
                    <Link
                      className="cc-listlink"
                      href={`/rooms/${room.id}`}
                      style={{ borderLeft: `4px solid ${sceneTone.line}` }}
                    >
                      <div className="cc-stack-sm">
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{room.title}</span>
                          <span className="cc-pill-soft" style={subtleSceneCardStyle(scene)}>{labelForRoomScene(scene)}</span>
                          <span className="cc-pill-soft">{labelForInteractionStyle(interaction)}</span>
                          <span className="cc-pill-soft">{labelForVisibility(visibility)}</span>
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
                        {room.host_note ? <div className="cc-caption">{room.host_note}</div> : null}
                      </div>
                      <span className="cc-btn-link">進入空間 →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="cc-empty-state">
              <div className="cc-stack-sm">
                <div className="cc-h3">目前沒有符合這個場景的即時房</div>
                <div className="cc-muted">你可以切到排程專區先把時間掛出來，或切換到其他場景看看。</div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section id="space-schedule" className="cc-section cc-grid-2" style={{ alignItems: "start" }}>
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">排程專區</p>
              <h2 className="cc-h2">先把 {currentSceneLabel} 的時間掛出來</h2>
              <p className="cc-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                排程不是獨立產品，而是同行空間的附屬能力。這一塊只處理時間、場景、互動形式與名額，不把複雜度一次塞爆。
              </p>
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
                  value={currentFormScene}
                  onChange={(e) => setRoomCategory(e.target.value as RoomCategory)}
                  disabled={activeScene !== "all"}
                >
                  {ACTIVE_ROOM_SCENE_OPTIONS.map((item) => (
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

            <div className="cc-action-row">
              <button className="cc-btn-primary" type="button" onClick={createSchedulePost} disabled={busy}>
                {busy ? "建立中…" : "建立排程"}
              </button>
              <Link href="/friends" className="cc-btn">好友</Link>
              <Link href="/account" className="cc-btn">我的帳號</Link>
            </div>
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
              <div className="cc-note">正在讀取即將到來的同行安排…</div>
            ) : filteredSchedulePosts.length === 0 ? (
              <div className="cc-note">目前還沒有符合這個場景的公開排程。你可以成為第一個先把時間掛出來的人。</div>
            ) : (
              <div className="cc-stack-sm">
                {filteredSchedulePosts.map((post) => {
                  const host = hostProfiles[post.host_user_id];
                  const isOwn = post.host_user_id === userId;
                  const tone = SCENE_TONES[post.ui_scene];
                  return (
                    <article
                      key={post.id}
                      className="cc-card cc-card-outline cc-stack-sm"
                      style={{ borderLeft: `4px solid ${tone.line}` }}
                    >
                      <div className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div className="cc-stack-sm" style={{ flex: 1, minWidth: 0 }}>
                          <div className="cc-row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <span className="cc-h3">{post.title}</span>
                            <span className="cc-pill-soft" style={subtleSceneCardStyle(post.ui_scene)}>{labelForRoomScene(post.ui_scene)}</span>
                            <span className="cc-pill-soft">{labelForInteractionStyle(post.interaction_style)}</span>
                            <span className="cc-pill-soft">{labelForVisibility(post.visibility)}</span>
                          </div>
                          <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                            {formatDateTimeRange(post.start_at, post.end_at)}
                            <br />
                            名額 {post.seat_limit} 人 · {formatDurationLabel(post.duration_minutes)}
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
      )}

      <SiteFooter />
    </main>
  );
}
