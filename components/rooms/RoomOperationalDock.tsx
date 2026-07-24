"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";
import styles from "./RoomOperationalDock.module.css";

type RelationshipState =
  | "self"
  | "friend"
  | "incoming"
  | "outgoing"
  | "blocked_by_me"
  | "unavailable"
  | "none";

type RoomMember = {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  public_profile_url: string | null;
  public_profile_enabled: boolean;
  accepting_friend_requests: boolean;
  is_owner: boolean;
  is_viewer: boolean;
  is_professional_buddy: boolean;
  real_name_verified: boolean;
  relationship: RelationshipState;
  relationship_request_id: string | null;
  presence: {
    is_current: boolean;
    mode: string;
    status: string;
    brb_until: string | null;
    last_presence_at: string | null;
    daily_participant_state: string;
    audio_track_state: string;
    video_track_state: string;
    screen_track_state: string;
  };
};

type Snapshot = {
  server_now: string;
  room: {
    id: string;
    title: string;
    mode: string;
    max_size: number;
    duration_minutes: number;
    created_by: string;
    status: string;
    visibility: string;
    invite_code: string | null;
    room_category: string | null;
    interaction_style: string | null;
    started_at: string | null;
    scheduled_end_at: string | null;
    ended_at: string | null;
    remaining_seconds: number | null;
    cleanup_reason: string | null;
  };
  viewer: {
    user_id: string;
    is_owner: boolean;
    plan_code: string;
    plan_label: string;
    rooms_entitled: boolean;
    visual_remaining_seconds: number | null;
    visual_remaining_minutes: number | null;
    extension_points_remaining: number | null;
    free_room_credits_remaining: number;
    free_monthly_allowance: number;
  };
  members: RoomMember[];
  member_count: number;
  current_participant_count: number;
  extension: {
    grants: Array<Record<string, unknown>>;
    server_enabled: boolean;
  };
  soft_errors: string[];
  build_tag: string;
};

type LiveParticipant = {
  userId: string | null;
  sessionId: string;
  isLocal: boolean;
  audioOn: boolean;
  videoOn: boolean;
  screenOn: boolean;
};

type DailyCallLike = {
  participants?: () => Record<string, any>;
  updateParticipant?: (
    sessionId: string,
    updates: { eject?: true; setAudio?: boolean; setVideo?: boolean },
  ) => unknown;
};

type Tab = "overview" | "members" | "room";

const REPORT_CATEGORIES = [
  ["harassment", "騷擾或不當互動"],
  ["sexual", "性騷擾或性內容"],
  ["privacy", "隱私或未經同意錄製"],
  ["impersonation", "冒用身分"],
  ["scam", "詐騙或可疑交易"],
  ["spam", "垃圾訊息"],
  ["self_harm", "自傷風險"],
  ["illegal", "違法內容"],
  ["other", "其他"],
] as const;

let dailyModulePromise: Promise<any> | null = null;

function getRoomId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function getDailyCallInstance(): Promise<DailyCallLike | null> {
  try {
    dailyModulePromise ||= import("@daily-co/daily-js");
    const module = await dailyModulePromise;
    const Daily = module?.default ?? module;
    return (Daily?.getCallInstance?.() as DailyCallLike | null) || null;
  } catch {
    return null;
  }
}

function readLiveParticipants(call: DailyCallLike | null): LiveParticipant[] {
  const rows = call?.participants?.() || {};
  return Object.entries(rows)
    .filter(([, participant]) => participant && participant.joined_at !== false)
    .map(([key, participant]: [string, any]) => ({
      userId:
        typeof participant.user_id === "string" && participant.user_id
          ? participant.user_id
          : participant.local
            ? "local"
            : null,
      sessionId: String(participant.session_id || key),
      isLocal: Boolean(participant.local),
      audioOn:
        participant?.tracks?.audio?.state === "playable" ||
        Boolean(participant?.audio),
      videoOn:
        participant?.tracks?.video?.state === "playable" ||
        Boolean(participant?.video),
      screenOn:
        participant?.tracks?.screenVideo?.state === "playable" ||
        Boolean(participant?.screen),
    }));
}

function formatCountdown(seconds: number | null) {
  if (seconds === null) return "--:--";
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function presenceLabel(member: RoomMember, live: LiveParticipant | undefined) {
  if (live) {
    if (live.screenOn) return "正在分享螢幕";
    if (live.videoOn) return "鏡頭在場";
    if (live.audioOn) return "音訊在場";
    return "安靜在場";
  }
  if (member.presence.status === "brb") return "暫時離開";
  if (member.presence.is_current) return "房內連線中";
  return "目前未連線";
}

function relationshipLabel(value: RelationshipState) {
  const labels: Record<RelationshipState, string> = {
    self: "這是你",
    friend: "已是好友",
    incoming: "等待你回覆",
    outgoing: "邀請已送出",
    blocked_by_me: "已封鎖",
    unavailable: "互動不可用",
    none: "尚未加好友",
  };
  return labels[value];
}

function visibilityLabel(value: string) {
  const labels: Record<string, string> = {
    public: "公開房",
    members: "會員房",
    friends: "好友房",
    invited: "邀請房",
  };
  return labels[value] || value || "—";
}

function relationshipAction(member: RoomMember) {
  if (member.relationship === "friend") {
    return { action: "remove", label: "解除好友" } as const;
  }
  if (member.relationship === "incoming") {
    return { action: "accept", label: "接受邀請" } as const;
  }
  if (member.relationship === "outgoing") {
    return { action: "cancel", label: "取消邀請" } as const;
  }
  if (
    member.relationship === "none" &&
    member.accepting_friend_requests
  ) {
    return { action: "send", label: "加好友" } as const;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function RoomOperationalDock() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = getRoomId(params?.roomId);
  const accessTokenRef = useRef("");
  const serverOffsetRef = useRef(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [notice, setNotice] = useState("正在同步房內資訊…");
  const [busyKey, setBusyKey] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [reportTarget, setReportTarget] = useState<RoomMember | null>(null);
  const [reportCategory, setReportCategory] = useState("harassment");
  const [reportDescription, setReportDescription] = useState("");

  async function ensureToken() {
    if (accessTokenRef.current) return accessTokenRef.current;
    const session = await getClientSessionSnapshot({ force: true }).catch(
      () => null,
    );
    const token = session?.accessToken || "";
    accessTokenRef.current = token;
    return token;
  }

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await ensureToken();
    if (!token) throw new Error("登入狀態尚未準備完成。");
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `操作失敗（${response.status}）。`);
    }
    return payload;
  }

  async function loadSnapshot(silent = false) {
    if (!roomId) return;
    try {
      const payload = (await authedFetch(
        `/api/rooms/${encodeURIComponent(roomId)}/operations`,
      )) as Snapshot;
      serverOffsetRef.current =
        new Date(payload.server_now).getTime() - Date.now();
      setSnapshot(payload);
      setNotice(
        payload.soft_errors?.length
          ? "主要資訊已同步；部分舊資料功能仍在相容模式。"
          : "房內資訊已同步。",
      );
      if (!selectedUserId) {
        const firstOther = payload.members.find((member) => !member.is_viewer);
        if (firstOther) setSelectedUserId(firstOther.user_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "讀取房內資訊失敗。";
      if (!silent) setNotice(message);
      if (/ROOM_ENDED|Room has ended/i.test(message)) {
        window.setTimeout(() => router.replace("/rooms"), 1_000);
      }
    }
  }

  useEffect(() => {
    if (!roomId) return;
    let disposed = false;
    getClientSessionSnapshot({ force: true })
      .then((session) => {
        if (disposed) return;
        accessTokenRef.current = session?.accessToken || "";
        return loadSnapshot();
      })
      .catch((error) => {
        if (!disposed) setNotice(error?.message || "請先登入。");
      });
    const refresh = window.setInterval(() => void loadSnapshot(true), 15_000);
    return () => {
      disposed = true;
      window.clearInterval(refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    let disposed = false;
    const refresh = async () => {
      const call = await getDailyCallInstance();
      if (!disposed) setLiveParticipants(readLiveParticipants(call));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    const scheduled = snapshot?.room.scheduled_end_at;
    if (!scheduled) return snapshot?.room.remaining_seconds ?? null;
    return Math.max(
      0,
      Math.floor(
        (new Date(scheduled).getTime() -
          (clock + serverOffsetRef.current)) /
          1000,
      ),
    );
  }, [clock, snapshot?.room.remaining_seconds, snapshot?.room.scheduled_end_at]);

  const liveByUserId = useMemo(() => {
    const map = new Map<string, LiveParticipant>();
    for (const participant of liveParticipants) {
      const userId = participant.isLocal
        ? snapshot?.viewer.user_id || participant.userId
        : participant.userId;
      if (userId) map.set(userId, participant);
    }
    return map;
  }, [liveParticipants, snapshot?.viewer.user_id]);

  const displayMembers = useMemo(() => {
    const members = [...(snapshot?.members || [])];
    return members.sort((left, right) => {
      const leftLive = liveByUserId.has(left.user_id) || left.presence.is_current;
      const rightLive = liveByUserId.has(right.user_id) || right.presence.is_current;
      if (left.is_viewer !== right.is_viewer) return left.is_viewer ? -1 : 1;
      if (leftLive !== rightLive) return leftLive ? -1 : 1;
      if (left.is_owner !== right.is_owner) return left.is_owner ? -1 : 1;
      return left.display_name.localeCompare(right.display_name, "zh-Hant");
    });
  }, [liveByUserId, snapshot?.members]);

  const identifiedLiveCount = liveByUserId.size;
  const liveCount = Math.max(
    liveParticipants.length,
    snapshot?.current_participant_count || 0,
  );
  const selectedMember =
    displayMembers.find((member) => member.user_id === selectedUserId) ||
    displayMembers.find((member) => !member.is_viewer) ||
    null;
  const warningCountdown =
    remainingSeconds !== null && remainingSeconds <= 5 * 60;

  async function runRelationship(
    member: RoomMember,
    action: "send" | "accept" | "decline" | "cancel" | "remove",
  ) {
    setBusyKey(`relationship:${member.user_id}`);
    setNotice("正在更新好友關係…");
    try {
      await authedFetch(
        `/api/rooms/${encodeURIComponent(roomId)}/relationships`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            target_user_id: member.user_id,
            message: action === "send" ? "很高興在同行房間遇見你。" : null,
          }),
        },
      );
      await loadSnapshot(true);
      setNotice(
        action === "accept"
          ? "已成為好友。"
          : action === "send"
            ? "好友邀請已送出。"
            : action === "remove"
              ? "好友關係已解除。"
              : "好友狀態已更新。",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "好友操作失敗。");
    } finally {
      setBusyKey("");
    }
  }

  async function toggleBlock(member: RoomMember) {
    const blocking = member.relationship !== "blocked_by_me";
    const confirmed = window.confirm(
      blocking
        ? `封鎖 ${member.display_name}？封鎖後不會自動恢復好友關係。`
        : `解除封鎖 ${member.display_name}？`,
    );
    if (!confirmed) return;
    setBusyKey(`block:${member.user_id}`);
    setNotice(blocking ? "正在封鎖使用者…" : "正在解除封鎖…");
    try {
      await authedFetch("/api/safety/block", {
        method: "POST",
        body: JSON.stringify({
          blocked_user_id: member.user_id,
          action: blocking ? "block" : "unblock",
          reason: blocking ? `room:${roomId}` : null,
        }),
      });
      if (blocking) {
        await authedFetch(
          `/api/rooms/${encodeURIComponent(roomId)}/relationships`,
          {
            method: "POST",
            body: JSON.stringify({
              action: "remove",
              target_user_id: member.user_id,
            }),
          },
        ).catch(() => undefined);
      }
      await loadSnapshot(true);
      setNotice(blocking ? "已封鎖此使用者。" : "已解除封鎖。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "封鎖操作失敗。");
    } finally {
      setBusyKey("");
    }
  }

  async function submitReport() {
    if (!reportTarget) return;
    if (reportDescription.trim().length < 10) {
      setNotice("檢舉說明至少需要 10 個字。");
      return;
    }
    setBusyKey(`report:${reportTarget.user_id}`);
    setNotice("正在安全送出檢舉…");
    try {
      await authedFetch(
        `/api/rooms/${encodeURIComponent(roomId)}/moderation`,
        {
          method: "POST",
          body: JSON.stringify({
            target_user_id: reportTarget.user_id,
            category: reportCategory,
            description: reportDescription,
          }),
        },
      );
      setReportTarget(null);
      setReportDescription("");
      setNotice("檢舉已送出，安全團隊可從房間與使用者脈絡回查。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "檢舉送出失敗。");
    } finally {
      setBusyKey("");
    }
  }

  async function removeMember(member: RoomMember) {
    if (!snapshot?.viewer.is_owner || member.is_owner || member.is_viewer) return;
    const confirmed = window.confirm(
      `將 ${member.display_name} 移出本房？對方之後也無法用原本的房間成員資格重新取得 token。`,
    );
    if (!confirmed) return;

    setBusyKey(`remove:${member.user_id}`);
    setNotice("正在安全移出參與者…");
    try {
      const live = liveByUserId.get(member.user_id);
      let ejectConfirmed = !live;
      if (!live && member.presence.is_current && liveParticipants.length > identifiedLiveCount) {
        throw new Error(
          "這位參與者仍使用舊版 Daily token，尚無法安全對應 session。請所有人重新進房取得新版 token 後再移除。",
        );
      }
      if (live) {
        const call = await getDailyCallInstance();
        if (!call?.updateParticipant) {
          throw new Error("Daily 房主控制尚未準備完成，請稍後再試。");
        }
        await Promise.resolve(
          call.updateParticipant(live.sessionId, { eject: true }),
        );
        await sleep(800);
        const stillPresent = readLiveParticipants(call).some(
          (participant) => participant.sessionId === live.sessionId,
        );
        if (stillPresent) {
          throw new Error("Daily 尚未確認參與者已離房，因此沒有撤銷資料庫成員資格。");
        }
        ejectConfirmed = true;
      }

      await authedFetch(`/api/rooms/${encodeURIComponent(roomId)}/owner`, {
        method: "POST",
        body: JSON.stringify({
          action: "remove_member",
          target_user_id: member.user_id,
          client_eject_confirmed: ejectConfirmed,
        }),
      });
      await loadSnapshot(true);
      setNotice(`${member.display_name} 已移出房間。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "移除參與者失敗。");
    } finally {
      setBusyKey("");
    }
  }

  async function endRoom() {
    if (!snapshot?.viewer.is_owner) return;
    const confirmed = window.confirm(
      "確定結束整個房間？所有人會離開，這個動作無法復原。",
    );
    if (!confirmed) return;
    setBusyKey("end-room");
    setNotice("正在結束房間並關閉 Daily 空間…");
    try {
      await authedFetch(`/api/rooms/${encodeURIComponent(roomId)}/owner`, {
        method: "POST",
        body: JSON.stringify({ action: "end_room" }),
      });
      setNotice("房間已結束，正在返回房間列表。");
      window.setTimeout(() => router.replace("/rooms"), 600);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "結束房間失敗。");
      setBusyKey("");
    }
  }

  if (!roomId) return null;

  return (
    <div
      className={styles.root}
      data-p4a-build={P4A_BUILD_TAGS.ui}
      data-room-operational-dock="true"
    >
      <button
        type="button"
        className={`${styles.summaryButton} ${warningCountdown ? styles.warning : ""}`}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className={styles.summaryPrimary}>
          <small>房間剩餘</small>
          <b>{formatCountdown(remainingSeconds)}</b>
        </span>
        <span className={styles.summarySeats}>
          <span className={styles.avatarStack} aria-hidden="true">
            {displayMembers.slice(0, 4).map((member) => (
              <i key={member.user_id}>
                {member.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.avatar_url} alt="" />
                ) : (
                  member.display_name.slice(0, 1)
                )}
              </i>
            ))}
          </span>
          <span>
            <small>房內</small>
            <b>{liveCount}/{snapshot?.room.max_size || "—"} 人</b>
          </span>
        </span>
        <span className={styles.summaryAction}>{expanded ? "收起" : "房內資訊"}</span>
      </button>

      {expanded ? (
        <aside className={styles.drawer} aria-label="房內資訊與安全操作">
          <header className={styles.drawerHeader}>
            <div>
              <span>Room overview</span>
              <h2>{snapshot?.room.title || "同行房間"}</h2>
              <p>{notice}</p>
            </div>
            <button type="button" onClick={() => setExpanded(false)} aria-label="關閉房內資訊">
              ×
            </button>
          </header>

          <nav className={styles.tabs} aria-label="房內資訊分類">
            {([
              ["overview", "總覽"],
              ["members", "成員"],
              ["room", "房間"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={tab === value ? styles.activeTab : ""}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className={styles.drawerBody}>
            {tab === "overview" ? (
              <>
                <section className={styles.heroMetric}>
                  <span>這個房間</span>
                  <b>{formatCountdown(remainingSeconds)}</b>
                  <p>
                    預計 {formatDateTime(snapshot?.room.scheduled_end_at || null)} 結束
                  </p>
                </section>

                <section className={styles.metricGrid}>
                  <article>
                    <span>目前房內</span>
                    <b>{liveCount}/{snapshot?.room.max_size || "—"} 人</b>
                  </article>
                  <article>
                    <span>目前方案</span>
                    <b>{snapshot?.viewer.plan_label || "讀取中"}</b>
                  </article>
                  <article>
                    <span>視覺同行</span>
                    <b>
                      {snapshot?.viewer.visual_remaining_minutes === null ||
                      snapshot?.viewer.visual_remaining_minutes === undefined
                        ? "不適用"
                        : `${snapshot.viewer.visual_remaining_minutes} 分`}
                    </b>
                  </article>
                  <article>
                    <span>同行延長</span>
                    <b>
                      {snapshot?.viewer.extension_points_remaining === null ||
                      snapshot?.viewer.extension_points_remaining === undefined
                        ? "—"
                        : `${snapshot.viewer.extension_points_remaining} 點`}
                    </b>
                  </article>
                </section>

                {!snapshot?.viewer.rooms_entitled ? (
                  <section className={styles.infoCard}>
                    <span>免費方案本月剩餘</span>
                    <b>
                      {snapshot?.viewer.free_room_credits_remaining ?? "—"} / {snapshot?.viewer.free_monthly_allowance ?? 4} 場
                    </b>
                    <p>入場扣場只會由 server ledger 執行一次，重新整理不會重複扣除。</p>
                  </section>
                ) : null}

                <section className={styles.infoCard}>
                  <span>目前在場方式</span>
                  <b>安靜、音訊、柔焦或鏡頭都可以</b>
                  <p>安靜／純音訊不扣視覺分鐘；柔焦、鏡頭與螢幕分享屬視覺額度。</p>
                </section>
              </>
            ) : null}

            {tab === "members" ? (
              <>
                <section className={styles.memberList}>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span>Participants</span>
                      <h3>房內成員</h3>
                    </div>
                    <b>{liveCount} 人連線</b>
                  </div>
                  {displayMembers.map((member) => {
                    const live = liveByUserId.get(member.user_id);
                    const isLive = Boolean(live) || member.presence.is_current;
                    return (
                      <button
                        type="button"
                        key={member.user_id}
                        className={`${styles.memberRow} ${selectedMember?.user_id === member.user_id ? styles.selectedMember : ""}`}
                        onClick={() => setSelectedUserId(member.user_id)}
                      >
                        <span className={styles.memberAvatar}>
                          {member.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.avatar_url} alt="" />
                          ) : (
                            member.display_name.slice(0, 1)
                          )}
                          <i data-live={isLive ? "true" : "false"} />
                        </span>
                        <span className={styles.memberCopy}>
                          <b>
                            {member.display_name}
                            {member.is_viewer ? "（你）" : ""}
                          </b>
                          <small>{presenceLabel(member, live)}</small>
                        </span>
                        <span className={styles.memberBadges}>
                          {member.is_owner ? <em>房主</em> : null}
                          {member.real_name_verified ? <em>已實名</em> : null}
                        </span>
                      </button>
                    );
                  })}
                </section>

                {selectedMember ? (
                  <section className={styles.memberDetail}>
                    <div className={styles.sectionTitle}>
                      <div>
                        <span>Member actions</span>
                        <h3>{selectedMember.display_name}</h3>
                      </div>
                      <b>{relationshipLabel(selectedMember.relationship)}</b>
                    </div>
                    <p>
                      {presenceLabel(
                        selectedMember,
                        liveByUserId.get(selectedMember.user_id),
                      )}
                      {selectedMember.is_professional_buddy ? "・安感夥伴" : ""}
                    </p>

                    {!selectedMember.is_viewer ? (
                      <div className={styles.actionGrid}>
                        {selectedMember.public_profile_url ? (
                          <Link href={selectedMember.public_profile_url}>
                            查看公開頁面
                          </Link>
                        ) : (
                          <span className={styles.disabledAction}>未開放公開頁面</span>
                        )}

                        {relationshipAction(selectedMember) ? (
                          <button
                            type="button"
                            disabled={busyKey === `relationship:${selectedMember.user_id}`}
                            onClick={() => {
                              const action = relationshipAction(selectedMember);
                              if (action) void runRelationship(selectedMember, action.action);
                            }}
                          >
                            {relationshipAction(selectedMember)?.label}
                          </button>
                        ) : null}

                        {selectedMember.relationship === "incoming" ? (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={busyKey === `relationship:${selectedMember.user_id}`}
                            onClick={() => void runRelationship(selectedMember, "decline")}
                          >
                            婉拒邀請
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => {
                            setReportTarget(selectedMember);
                            setReportCategory("harassment");
                            setReportDescription("");
                          }}
                        >
                          檢舉
                        </button>

                        {selectedMember.relationship !== "unavailable" ? (
                          <button
                            type="button"
                            className={styles.dangerTextButton}
                            disabled={busyKey === `block:${selectedMember.user_id}`}
                            onClick={() => void toggleBlock(selectedMember)}
                          >
                            {selectedMember.relationship === "blocked_by_me"
                              ? "解除封鎖"
                              : "封鎖"}
                          </button>
                        ) : null}

                        {snapshot?.viewer.is_owner &&
                        !selectedMember.is_owner &&
                        !selectedMember.is_viewer ? (
                          <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={busyKey === `remove:${selectedMember.user_id}`}
                            onClick={() => void removeMember(selectedMember)}
                          >
                            移出房間
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className={styles.selfNote}>這是你的房內身分。個人公開頁與好友操作只會出現在其他參與者上。</p>
                    )}
                  </section>
                ) : null}
              </>
            ) : null}

            {tab === "room" ? (
              <>
                <section className={styles.infoList}>
                  <div><span>房間類型</span><b>{snapshot?.room.mode === "pair" ? "雙人房" : "小組房"}</b></div>
                  <div><span>可見範圍</span><b>{visibilityLabel(snapshot?.room.visibility || "")}</b></div>
                  <div><span>預定結束</span><b>{formatDateTime(snapshot?.room.scheduled_end_at || null)}</b></div>
                  <div><span>成員名單</span><b>{snapshot?.member_count ?? "—"} 人</b></div>
                  {snapshot?.room.invite_code ? (
                    <div><span>邀請碼</span><b>{snapshot.room.invite_code}</b></div>
                  ) : null}
                </section>

                <section className={styles.infoCard}>
                  <span>延長規則</span>
                  <b>每次 25 分鐘，由每位參與者先表態</b>
                  <p>Rooms 會員本人不扣點；替非 Rooms 會員延長時，每位需要 1 點。</p>
                </section>

                <section className={styles.infoCard}>
                  <span>安全與隱私</span>
                  <b>房內不強迫開鏡頭</b>
                  <p>檢舉會保存房間與目標使用者脈絡，但不保存通話內容或原始媒體。</p>
                </section>

                {snapshot?.viewer.is_owner ? (
                  <section className={styles.ownerCard}>
                    <span>房主控制</span>
                    <b>只在必要時結束整個房間</b>
                    <p>結束房間會關閉 Daily 空間，所有人都必須重新建立新的房間才能再進入。</p>
                    <button
                      type="button"
                      disabled={busyKey === "end-room"}
                      onClick={() => void endRoom()}
                    >
                      {busyKey === "end-room" ? "結束中…" : "結束整個房間"}
                    </button>
                  </section>
                ) : null}

                <button
                  type="button"
                  className={styles.refreshButton}
                  onClick={() => void loadSnapshot()}
                >
                  重新同步房內資訊
                </button>
                <small className={styles.buildTag}>
                  {snapshot?.build_tag || P4A_BUILD_TAGS.operations}
                </small>
              </>
            ) : null}
          </div>
        </aside>
      ) : null}

      {reportTarget ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="檢舉房內使用者">
            <header>
              <div>
                <span>Safety report</span>
                <h3>檢舉 {reportTarget.display_name}</h3>
              </div>
              <button type="button" onClick={() => setReportTarget(null)} aria-label="關閉檢舉表單">×</button>
            </header>
            <label>
              類別
              <select value={reportCategory} onChange={(event: any) => setReportCategory(event.target.value)}>
                {REPORT_CATEGORIES.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              發生了什麼
              <textarea
                value={reportDescription}
                onChange={(event: any) => setReportDescription(event.target.value)}
                placeholder="請描述時間、行為與你希望平台協助的事項。"
                maxLength={3000}
              />
            </label>
            <p>檢舉會附上房間 ID 與目標使用者 ID，不會錄製或上傳通話內容。</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setReportTarget(null)}>取消</button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busyKey === `report:${reportTarget.user_id}`}
                onClick={() => void submitReport()}
              >
                {busyKey === `report:${reportTarget.user_id}` ? "送出中…" : "送出檢舉"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
