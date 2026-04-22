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
  invite_code?: string | null;
};

type ContentMode = "now" | "schedule";
type SceneFilter = "all" | ActiveRoomScene;
type MobileComposerMode = "instant" | "schedule" | "invite";

const EMPTY_ROOM_ASSET = "/site-assets/rooms/empty-room.png";

const SCENE_COPY = {
  focus: {
    title: "專注任務",
    body: "讀書、工作、寫作、整理資料。重點不是聊天，而是有人一起開始。",
    pills: ["安靜同行", "25 / 50 分鐘"],
    image: "/site-assets/rooms/focus.png",
    alt: "專注任務場景圖",
    imagePosition: "20% 72%",
    imageScale: 1.02,
  },
  life: {
    title: "生活陪伴",
    body: "整理房間、煮飯、做家務。普通日常也可以有人一起撐完。",
    pills: ["低壓力", "輕聊天"],
    image: "/site-assets/rooms/life.png",
    alt: "生活陪伴場景圖",
    imagePosition: "50% 60%",
    imageScale: 1.02,
  },
  share: {
    title: "主題分享",
    body: "有一個明確主題，把一場對話好好聊完，比散亂聊天室更輕鬆。",
    pills: ["主題房", "開放分享"],
    image: "/site-assets/rooms/share.png",
    alt: "主題分享場景圖",
    imagePosition: "50% 56%",
    imageScale: 1.01,
  },
  hobby: {
    title: "興趣同好",
    body: "閱讀、手作、畫圖、音樂、伸展。做喜歡的事，也可以有同伴。",
    pills: ["同好房", "有呼吸感"],
    image: "/site-assets/rooms/hobby.png",
    alt: "興趣同好場景圖",
    imagePosition: "84% 56%",
    imageScale: 1,
  },
} as const;

const SCENE_LINE: Record<ActiveRoomScene, string> = {
  focus: "rgba(155, 186, 169, 0.96)",
  life: "rgba(245, 181, 150, 0.96)",
  share: "rgba(161, 179, 204, 0.96)",
  hobby: "rgba(196, 170, 196, 0.96)",
};

function SceneArt({
  image,
  alt,
  position,
  scale,
}: {
  image: string;
  alt: string;
  position: string;
  scale: number;
}) {
  return (
    <div
      aria-label={alt}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 10",
        borderRadius: 16,
        border: "1px solid rgba(89,88,82,0.10)",
        overflow: "hidden",
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <img
        src={image}
        alt={alt}
        loading="lazy"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: position,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

function modeLabel(mode: Room["mode"]) {
  return mode === "pair" ? "雙人同行" : "小組同行";
}

function costLabel(minutes: number) {
  return `${Math.ceil(minutes / 25)} 場`;
}

function minDatetimeLocalValue() {
  return toDatetimeLocalValue(new Date().toISOString());
}

function readRoomsRouteState(): { scene: SceneFilter; mode: ContentMode } {
  if (typeof window === "undefined") return { scene: "all", mode: "now" };
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene");
  const modeParam = params.get("mode");
  const scene: SceneFilter =
    sceneParam === "focus" || sceneParam === "life" || sceneParam === "share" || sceneParam === "hobby"
      ? sceneParam
      : "all";
  const mode: ContentMode = modeParam === "schedule" ? "schedule" : "now";
  return { scene, mode };
}

type RoomsBoardSnapshot = {
  rooms: Room[];
  schedulePosts: ScheduledRoomPostRow[];
  hostProfiles: Record<string, PublicProfileRow>;
  generatedAt: string;
  cacheState: "cached" | "fresh";
  buildTag: string;
};

async function loadPublicRoomsBoardSnapshot(options?: { fresh?: boolean }) {
  const url = new URL("/api/public/rooms-board", window.location.origin);
  if (options?.fresh) {
    url.searchParams.set("fresh", "1");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: options?.fresh ? "no-store" : "default",
    headers: options?.fresh ? { "Cache-Control": "no-cache" } : undefined,
  });

  const json = (await response.json().catch(() => null)) as
    | RoomsBoardSnapshot
    | { error?: string }
    | null;

  if (!response.ok || !json || !("rooms" in json)) {
    throw new Error(
      !response.ok && json && "error" in json && json.error
        ? json.error
        : "讀取同行空間快取失敗。"
    );
  }

  return json;
}

async function loadOwnRoom(currentUserId: string) {
  if (!currentUserId) return null;
  const result = await supabase
    .from("rooms")
    .select(
      "id,title,duration_minutes,mode,max_size,created_at,created_by,room_category,interaction_style,visibility,host_note,invite_code"
    )
    .eq("created_by", currentUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data ?? null) as Room | null;
}

async function loadOwnFutureScheduleCount(currentUserId: string) {
  if (!currentUserId) return 0;

  const result = await supabase
    .from("scheduled_room_posts")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", currentUserId)
    .gt("start_at", new Date().toISOString());

  if (result.error) throw result.error;
  return result.count ?? 0;
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
  const [ownRoom, setOwnRoom] = useState<Room | null>(null);
  const [ownFutureScheduleCount, setOwnFutureScheduleCount] = useState(0);
  const [boardGeneratedAt, setBoardGeneratedAt] = useState("");
  const [boardCacheState, setBoardCacheState] = useState<"cached" | "fresh" | null>(null);
  const [boardBuildTag, setBoardBuildTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeScene, setActiveScene] = useState<SceneFilter>("all");
  const [contentMode, setContentMode] = useState<ContentMode>("now");
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const [mobileComposerMode, setMobileComposerMode] = useState<MobileComposerMode>("instant");

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
  const [inviteLookup, setInviteLookup] = useState<Room | ScheduledRoomPostRow | null>(null);
  const [inviteLookupKind, setInviteLookupKind] = useState<"room" | "schedule" | null>(null);

  function syncRoomsQuery(nextMode: ContentMode, nextScene: SceneFilter) {
    const params = new URLSearchParams();
    params.set("mode", nextMode);
    if (nextScene !== "all") params.set("scene", nextScene);
    router.replace(`/rooms?${params.toString()}#rooms-board`, { scroll: false });
  }

  function handleModeChange(nextMode: ContentMode) {
    setContentMode(nextMode);
    syncRoomsQuery(nextMode, activeScene);
  }

  function handleSceneChange(nextScene: SceneFilter) {
    setActiveScene(nextScene);
    syncRoomsQuery(contentMode, nextScene);
  }

  useEffect(() => {
    const applyRouteState = () => {
      const next = readRoomsRouteState();
      setActiveScene(next.scene);
      setContentMode(next.mode);
    };
    applyRouteState();
    window.addEventListener("popstate", applyRouteState);
    return () => window.removeEventListener("popstate", applyRouteState);
  }, []);

  useEffect(() => {
    if (activeScene !== "all") {
      setInstantCategory(activeScene);
      setRoomCategory(activeScene);
    }
  }, [activeScene]);

  async function reloadAll(params?: {
    currentAccessToken?: string;
    currentUserId?: string;
    fresh?: boolean;
  }) {
    setLoading(true);
    setMsg("");

    try {
      const [statusResult, boardSnapshot, nextOwnRoom, nextOwnScheduleCount] = await Promise.all([
        params?.currentAccessToken
          ? fetchAccountStatus(params.currentAccessToken).catch(() => null)
          : Promise.resolve(null),
        loadPublicRoomsBoardSnapshot({ fresh: params?.fresh }),
        params?.currentUserId ? loadOwnRoom(params.currentUserId) : Promise.resolve(null),
        params?.currentUserId ? loadOwnFutureScheduleCount(params.currentUserId) : Promise.resolve(0),
      ]);

      if (statusResult) setStatus(statusResult);
      setRooms(boardSnapshot.rooms);
      setSchedulePosts(boardSnapshot.schedulePosts);
      setHostProfiles(boardSnapshot.hostProfiles);
      setBoardGeneratedAt(boardSnapshot.generatedAt);
      setBoardCacheState(boardSnapshot.cacheState);
      setBoardBuildTag(boardSnapshot.buildTag);
      setOwnRoom(nextOwnRoom);
      setOwnFutureScheduleCount(nextOwnScheduleCount);
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
      await reloadAll({
        currentAccessToken: session.accessToken ?? "",
        currentUserId: session.user.id,
      });
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
    () =>
      activeScene === "all"
        ? normalizedSchedulePosts
        : normalizedSchedulePosts.filter((post) => post.ui_scene === activeScene),
    [activeScene, normalizedSchedulePosts],
  );

  const sceneGalleryCards = ACTIVE_ROOM_SCENE_OPTIONS.map((item) => ({ ...item, ...SCENE_COPY[item.value] }));
  const emptyVisualStyle: CSSProperties = {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 18,
    border: "1px solid rgba(89,88,82,0.10)",
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), url(${EMPTY_ROOM_ASSET})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

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
    setMsg(json?.invite_code ? `已建立同行空間。邀請碼：${json.invite_code}` : "已建立同行空間。");
    setMobileComposerOpen(false);
    await reloadAll({
      currentAccessToken: accessToken,
      currentUserId: userId,
      fresh: true,
    });
    if (json?.room?.id) router.push(`/rooms/${json.room.id}`);
  }

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
    setMobileComposerOpen(false);
    await reloadAll({
      currentAccessToken: accessToken,
      currentUserId: userId,
      fresh: true,
    });
  }

  async function deleteSchedulePost(postId: string) {
    setBusy(true);
    setMsg("");
    const result = await supabase.from("scheduled_room_posts").delete().eq("id", postId).eq("host_user_id", userId);
    setBusy(false);
    if (result.error) return setMsg(result.error.message);
    setMsg("已刪除排程。");
    await reloadAll({
      currentAccessToken: accessToken,
      currentUserId: userId,
      fresh: true,
    });
  }

  async function resolveInviteCode() {
    setBusy(true);
    setMsg("");
    setInviteLookup(null);
    setInviteLookupKind(null);
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
    if (json.kind === "room") {
      setInviteLookupKind("room");
      setInviteLookup(json.room as Room);
    }
    if (json.kind === "schedule") {
      setInviteLookupKind("schedule");
      setInviteLookup(json.post as ScheduledRoomPostRow);
    }
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
    setMobileComposerOpen(false);
    await reloadAll({
      currentAccessToken: accessToken,
      currentUserId: userId,
      fresh: true,
    });
    if (json?.roomId) router.push(`/rooms/${json.roomId}`);
  }

  function renderInstantComposer() {
    if (ownRoom) {
      return (
        <div className="cc-note cc-stack-sm">
          <div className="cc-h3">你目前已有一間同行空間</div>
          <div className="cc-muted">{ownRoom.title}</div>
          <div className="cc-action-row">
            <Link href={`/rooms/${ownRoom.id}`} className="cc-btn-primary">進入我的房間</Link>
            {ownRoom.visibility === "invited" && ownRoom.invite_code ? (
              <span className="cc-pill-accent">邀請碼：{ownRoom.invite_code}</span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <>
        <label className="cc-field">
          <span className="cc-field-label">房間名稱</span>
          <input className="cc-input" value={instantTitle} onChange={(e) => setInstantTitle(e.target.value)} />
        </label>
        <div className="cc-grid-2 cc-mobile-stack-grid">
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
        <div className="cc-grid-3 cc-mobile-stack-grid" style={{ gap: 12 }}>
          <label className="cc-field">
            <span className="cc-field-label">房型</span>
            <select className="cc-select" value={instantMode} onChange={(e) => setInstantMode(e.target.value as "pair" | "group")}>
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
        <label className="cc-field">
          <span className="cc-field-label">補充說明</span>
          <textarea className="cc-textarea" value={instantNote} onChange={(e) => setInstantNote(e.target.value)} />
        </label>
        <button type="button" className="cc-btn-primary" onClick={createInstantRoom} disabled={busy || !instantTitle.trim()}>
          {busy ? "建立中…" : "建立同行空間"}
        </button>
      </>
    );
  }

  function renderScheduleComposer() {
    return (
      <>
        <div className="cc-note">你目前已安排 {ownFutureScheduleCount} / 2 間未開始排程。</div>
        <label className="cc-field">
          <span className="cc-field-label">排程名稱</span>
          <input className="cc-input" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} />
        </label>
        <div className="cc-grid-2 cc-mobile-stack-grid">
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
        <div className="cc-grid-2 cc-mobile-stack-grid">
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
        <div className="cc-grid-2 cc-mobile-stack-grid">
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
          <textarea className="cc-textarea" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} />
        </label>
        <button type="button" className="cc-btn-primary" onClick={createSchedulePost} disabled={busy || ownFutureScheduleCount >= 2 || !scheduleTitle.trim()}>
          {busy ? "建立中…" : "建立排程"}
        </button>
      </>
    );
  }

  function renderInviteLookup() {
    return (
      <div className="cc-stack-sm">
        <div>
          <p className="cc-card-kicker">邀請碼入口</p>
          <h2 className="cc-h2">有邀請碼時，直接輸入就能找到對方的房間或排程。</h2>
        </div>
        <div className="cc-action-row" style={{ marginTop: 0, alignItems: "center" }}>
          <input className="cc-input" style={{ flex: 1, minWidth: 0 }} value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())} placeholder="例如：AB12CD34" />
          <button type="button" className="cc-btn" onClick={resolveInviteCode} disabled={busy || !inviteCodeInput.trim()}>
            查找
          </button>
        </div>
        {inviteLookupKind === "room" && inviteLookup ? (
          <div className="cc-note cc-stack-sm">
            <div className="cc-h3">{(inviteLookup as Room).title}</div>
            <button type="button" className="cc-btn-primary" disabled={busy} onClick={() => joinInvitedRoom((inviteLookup as Room).invite_code ?? inviteCodeInput)}>
              使用邀請碼加入
            </button>
          </div>
        ) : null}
        {inviteLookupKind === "schedule" && inviteLookup ? (
          <div className="cc-note cc-stack-sm">
            <div className="cc-h3">{(inviteLookup as ScheduledRoomPostRow).title}</div>
            <div className="cc-muted">{formatDateTimeRange((inviteLookup as ScheduledRoomPostRow).start_at, (inviteLookup as ScheduledRoomPostRow).end_at)}</div>
          </div>
        ) : null}
      </div>
    );
  }

  const mobileSheetContent =
    mobileComposerMode === "instant"
      ? renderInstantComposer()
      : mobileComposerMode === "schedule"
      ? renderScheduleComposer()
      : renderInviteLookup();

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Rooms</span>
          <p className="cc-eyebrow">想立刻開始，或先把時間排好，都可以從這裡開始。</p>
          <h1 className="cc-h1" style={{ maxWidth: "8ch" }}>
            先看現在能去哪裡，再決定要不要自己開房。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "42ch" }}>
            先選模式，再選場景。看看目前有哪些房間與排程，再決定要不要自己開一間。
          </p>

          <div className="cc-mobile-only cc-stack-sm">
            <button
              type="button"
              className="cc-btn-primary"
              style={{ width: "100%" }}
              onClick={() => {
                setMobileComposerMode(contentMode === "now" ? "instant" : "schedule");
                setMobileComposerOpen(true);
              }}
            >
              {contentMode === "now" ? "＋ 開新房間" : "＋ 建立排程"}
            </button>
            <button
              type="button"
              className="cc-btn"
              style={{ width: "100%" }}
              onClick={() => {
                setMobileComposerMode("invite");
                setMobileComposerOpen(true);
              }}
            >
              輸入邀請碼
            </button>
          </div>

          <div className="cc-control-group">
            <div className="cc-control-label">第 1 步：你現在要做哪件事？</div>
            <div className="cc-segment-grid">
              <button type="button" className={`cc-segment-btn ${contentMode === "now" ? "is-active" : ""}`} onClick={() => handleModeChange("now")}>
                <span className="cc-segment-btn__title">現在可進房</span>
                <span className="cc-segment-btn__meta">{filteredRooms.length} 間可立即加入</span>
              </button>
              <button type="button" className={`cc-segment-btn ${contentMode === "schedule" ? "is-active" : ""}`} onClick={() => handleModeChange("schedule")}>
                <span className="cc-segment-btn__title">排程專區</span>
                <span className="cc-segment-btn__meta">{filteredSchedulePosts.length} 個接下來的時段</span>
              </button>
            </div>
          </div>

          <div className="cc-control-group">
            <div className="cc-control-label">第 2 步：你想待在哪一種場景？</div>
            <div className="cc-filter-row cc-filter-row-scroll">
              {ACTIVE_ROOM_SCENE_OPTIONS.map((scene) => (
                <button
                  key={scene.value}
                  type="button"
                  className={`cc-filter-chip ${activeScene === scene.value ? "is-active" : ""}`}
                  onClick={() => handleSceneChange(scene.value)}
                >
                  {scene.label}
                </button>
              ))}
              <button type="button" className={`cc-filter-chip ${activeScene === "all" ? "is-active" : ""}`} onClick={() => handleSceneChange("all")}>
                全部
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="cc-section cc-stack-md">
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">Rooms 場景卡</p>
            <h2 className="cc-h2">先看四種場景，點下去就直接套用篩選。</h2>
          </div>
        </div>

        <div className="cc-home-scene-grid">
          {sceneGalleryCards.map((card) => (
            <button
              key={card.value}
              type="button"
              className="cc-card cc-card-link cc-home-scene-card"
              onClick={() => {
                handleModeChange("now");
                handleSceneChange(card.value);
                window.location.hash = "rooms-board";
              }}
              style={{ textAlign: "left" }}
            >
              <SceneArt image={card.image} alt={card.alt} position={card.imagePosition} scale={card.imageScale} />
              <div className="cc-stack-sm">
                <div className="cc-h3">{card.title}</div>
                <div className="cc-muted" style={{ lineHeight: 1.7 }}>{card.body}</div>
                <div className="cc-action-row" style={{ marginTop: 0 }}>
                  {card.pills.map((pill) => <span key={pill} className="cc-pill-soft">{pill}</span>)}
                </div>
              </div>
              <span className="cc-btn-link">套用這個場景 →</span>
            </button>
          ))}
        </div>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section id="rooms-board" className="cc-section cc-rooms-board">
        <article className="cc-card cc-stack-md">
          <div className="cc-page-header" style={{ marginBottom: 0 }}>
            <div>
              <p className="cc-card-kicker">{contentMode === "now" ? "現在可進房" : "排程板"}</p>
              <h2 className="cc-h2">
                {contentMode === "now" ? "先看眼前有哪些房，覺得適合就直接進去。" : "先看接下來的安排，想要的時段就先掛上去。"}
              </h2>
              {boardGeneratedAt ? (
                <div className="cc-caption" style={{ marginTop: 8 }}>
                  看板快照：{new Date(boardGeneratedAt).toLocaleString("zh-TW")} · {boardCacheState === "cached" ? "CDN / ISR 快取" : "即時刷新"} · {boardBuildTag}
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="cc-card cc-empty-state">正在整理目前可見的房間與排程…</div>
          ) : contentMode === "now" ? (
            filteredRooms.length === 0 ? (
              <div className="cc-note cc-stack-md">
                <div style={emptyVisualStyle} />
                <div className="cc-stack-sm">
                  <div className="cc-h3">目前這個場景還沒有人開房。</div>
                  <div className="cc-muted">你可以成為第一個開房的人。想現在就開始，就開一間；想先約好，就切到排程專區。</div>
                </div>
              </div>
            ) : (
              <ul className="cc-list cc-list--flush">
                {filteredRooms.map((room) => (
                  <li key={room.id}>
                    <Link className="cc-listlink" href={`/rooms/${room.id}`} style={{ borderLeft: `4px solid ${SCENE_LINE[room.ui_scene]}` }}>
                      <div className="cc-stack-sm">
                        <div className="cc-row" style={{ flexWrap: "wrap" }}>
                          <span className="cc-h3">{room.title}</span>
                          <span className="cc-pill-soft">{labelForRoomScene(room.ui_scene)}</span>
                          <span className="cc-pill-soft">{labelForInteractionStyle((room.interaction_style ?? "silent") as InteractionStyle)}</span>
                          <span className="cc-pill-soft">{modeLabel(room.mode)}</span>
                          <span className="cc-pill-soft">{formatDurationLabel(room.duration_minutes)}</span>
                        </div>
                        <div className="cc-muted">
                          {labelForVisibility(room.visibility)} · 最多 {room.max_size} 人 · 建立於 {new Date(room.created_at).toLocaleDateString("zh-TW")}
                        </div>
                        {room.host_note ? <div className="cc-caption">{room.host_note}</div> : null}
                      </div>
                      <span className="cc-btn-link">立即加入 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : filteredSchedulePosts.length === 0 ? (
            <div className="cc-note cc-stack-md">
              <div style={emptyVisualStyle} />
              <div className="cc-stack-sm">
                <div className="cc-h3">目前還沒有這個場景的排程。</div>
                <div className="cc-muted">如果你知道自己想在什麼時間開始，先掛出你的時間通常比等別人更快。</div>
              </div>
            </div>
          ) : (
            <div className="cc-stack-sm">
              {filteredSchedulePosts.map((post) => {
                const host = hostProfiles[post.host_user_id];
                return (
                  <article key={post.id} className="cc-card cc-card-outline cc-stack-sm" style={{ borderLeft: `4px solid ${SCENE_LINE[post.ui_scene]}` }}>
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

        <aside className="cc-card cc-stack-md cc-desktop-only">
          <div>
            <p className="cc-card-kicker">建立與加入</p>
            <h2 className="cc-h2">想自己開，或別人給你邀請碼，都在這裡。</h2>
          </div>
          <div className="cc-action-row" style={{ marginTop: 0 }}>
            <button type="button" className={contentMode === "now" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("now")}>建立即時房</button>
            <button type="button" className={contentMode === "schedule" ? "cc-btn-primary" : "cc-btn"} onClick={() => setContentMode("schedule")}>建立排程</button>
          </div>
          {contentMode === "now" ? renderInstantComposer() : renderScheduleComposer()}
          <hr className="cc-soft-divider" />
          {renderInviteLookup()}
        </aside>
      </section>

      {mobileComposerOpen ? (
        <div className="cc-mobile-sheet cc-mobile-only" role="dialog" aria-modal="true">
          <button type="button" className="cc-mobile-sheet__backdrop" aria-label="關閉建立房間面板" onClick={() => setMobileComposerOpen(false)} />
          <div className="cc-mobile-sheet__panel">
            <div className="cc-mobile-sheet__header">
              <div>
                <div className="cc-card-kicker">
                  {mobileComposerMode === "instant" ? "建立同行空間" : mobileComposerMode === "schedule" ? "建立排程" : "邀請碼入口"}
                </div>
                <div className="cc-h3">
                  {mobileComposerMode === "instant"
                    ? "先決定這間房怎麼開始。"
                    : mobileComposerMode === "schedule"
                    ? "先把時間掛出來，等適合的人加入。"
                    : "輸入邀請碼，直接找到對方的房或排程。"}
                </div>
              </div>
              <button type="button" className="cc-btn" onClick={() => setMobileComposerOpen(false)}>關閉</button>
            </div>

            <div className="cc-action-row" style={{ marginTop: 0 }}>
              <button type="button" className={mobileComposerMode === "instant" ? "cc-btn-primary" : "cc-btn"} onClick={() => setMobileComposerMode("instant")}>即時房</button>
              <button type="button" className={mobileComposerMode === "schedule" ? "cc-btn-primary" : "cc-btn"} onClick={() => setMobileComposerMode("schedule")}>排程</button>
              <button type="button" className={mobileComposerMode === "invite" ? "cc-btn-primary" : "cc-btn"} onClick={() => setMobileComposerMode("invite")}>邀請碼</button>
            </div>

            <div className="cc-stack-md">
              {mobileComposerMode === "instant" ? renderInstantComposer() : mobileComposerMode === "schedule" ? renderScheduleComposer() : renderInviteLookup()}
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </main>
  );
}
