"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const HEARTBEAT_INTERVAL_MS = 25_000;
const STATE_REFRESH_INTERVAL_MS = 30_000;
const STORAGE_KEY_PREFIX = "calmco:room-presence-mode:";

type PresenceMode = "quiet" | "audio" | "mosaic" | "camera";
type PresenceEventType =
  | "selected"
  | "heartbeat"
  | "visible"
  | "hidden"
  | "audio_on"
  | "audio_off"
  | "video_on"
  | "video_off"
  | "brb_start"
  | "brb_end"
  | "extension_confirmed"
  | "left";

type RuntimeSnapshot = {
  ready: boolean;
  audio: boolean;
  video: boolean;
  screen: boolean;
  dailyParticipantState: "unknown" | "joining" | "joined" | "left";
};

type PresenceStatePayload = {
  room?: {
    scheduled_end_at?: string | null;
    duration_minutes?: number | null;
  };
  states?: Array<{
    user_id?: string;
    presence_mode?: PresenceMode;
    presence_status?: string;
    brb_until?: string | null;
  }>;
  extension_confirmations?: Array<Record<string, unknown>>;
  commercial_extension_finalization?: string;
  commercial_state?: {
    entitlement?: {
      planCode?: string;
      roomsEntitled?: boolean;
      visualWallet?: { remaining?: number; granted?: number; consumed?: number } | null;
      extensionWallet?: { remaining?: number; granted?: number; consumed?: number } | null;
    };
    extensionGrants?: Array<{
      id?: string;
      new_scheduled_end_at?: string;
      points_consumed?: number;
      status?: string;
    }>;
    serverPilotEnabled?: boolean;
  };
  build_tag?: string;
};

const modeOptions: Array<{
  code: PresenceMode;
  label: string;
  detail: string;
}> = [
  { code: "quiet", label: "安靜", detail: "鏡頭與麥克風可關閉" },
  { code: "audio", label: "音訊", detail: "不送視訊軌" },
  { code: "mosaic", label: "柔焦", detail: "屬視覺額度" },
  { code: "camera", label: "鏡頭", detail: "屬視覺額度" },
];

function getRoomIdFromParams(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function clickedLeaveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const control = target.closest('[data-room-control="leave"]');
  if (control) return true;

  const anchor = target.closest("a");
  if (anchor instanceof HTMLAnchorElement) {
    const href = anchor.getAttribute("href") || "";
    if (href === "/rooms" || href.startsWith("/rooms?")) return true;
  }

  const button = target.closest("button");
  const label = (button?.textContent || "").replace(/\s+/g, "");
  return Boolean(label && (label.includes("離開") || label.includes("回房間列表")));
}

function readRuntimeSnapshot(): RuntimeSnapshot {
  const stage = document.querySelector<HTMLElement>('[data-room-call-stage="true"]');
  if (!stage) {
    return {
      ready: false,
      audio: false,
      video: false,
      screen: false,
      dailyParticipantState: "unknown",
    };
  }

  const ready = stage.dataset.dailyReady === "true";
  return {
    ready,
    audio: stage.dataset.localAudio === "on",
    video: stage.dataset.localVideo === "on",
    screen: stage.dataset.screenSharing === "on",
    dailyParticipantState: ready ? "joined" : "joining",
  };
}

function clickControlWhenNeeded(
  control: "audio" | "video" | "screen",
  shouldBeOn: boolean,
) {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-room-control="${control}"]`,
  );
  if (!button || button.disabled) return;
  const isOn = button.dataset.controlState === "on";
  if (isOn !== shouldBeOn) button.click();
}

function applyModeToOutgoingTracks(mode: PresenceMode) {
  const snapshot = readRuntimeSnapshot();
  if (!snapshot.ready) return;

  if (mode === "quiet") {
    clickControlWhenNeeded("screen", false);
    clickControlWhenNeeded("video", false);
    clickControlWhenNeeded("audio", false);
    return;
  }

  if (mode === "audio") {
    clickControlWhenNeeded("screen", false);
    clickControlWhenNeeded("video", false);
    return;
  }

  clickControlWhenNeeded("video", true);
}

function formatCountdown(iso?: string | null) {
  if (!iso) return null;
  const delta = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(delta)) return null;
  const minutes = Math.ceil(delta / 60_000);
  return minutes;
}

export function RoomLifecycleBridge() {
  const params = useParams<{ roomId?: string | string[] }>();
  const roomId = getRoomIdFromParams(params?.roomId);
  const accessTokenRef = useRef("");
  const leaveSentRef = useRef(false);
  const suppressLeaveRef = useRef(false);
  const modeRef = useRef<PresenceMode>("quiet");
  const dailyReadySeenRef = useRef(false);
  const lastRuntimeSnapshotRef = useRef<RuntimeSnapshot | null>(null);
  const [mode, setMode] = useState<PresenceMode>("quiet");
  const [brbUntil, setBrbUntil] = useState<string | null>(null);
  const [statePayload, setStatePayload] = useState<PresenceStatePayload | null>(null);
  const [status, setStatus] = useState("正在建立 Presence 狀態…");
  const [expanded, setExpanded] = useState(true);
  const [extensionDecision, setExtensionDecision] = useState<"continue" | "leave" | null>(null);
  const [extensionApplying, setExtensionApplying] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const endInMinutes = useMemo(
    () => formatCountdown(statePayload?.room?.scheduled_end_at),
    [statePayload?.room?.scheduled_end_at, clock],
  );
  const showExtensionPrompt =
    endInMinutes !== null && endInMinutes <= 5 && endInMinutes >= -3;
  const commercialEntitlement = statePayload?.commercial_state?.entitlement;
  const visualRemaining = commercialEntitlement?.visualWallet?.remaining ?? null;
  const extensionPointsRemaining =
    commercialEntitlement?.extensionWallet?.remaining ?? null;
  const visualQuotaExhausted =
    commercialEntitlement?.planCode === "rooms_unlimited_299" &&
    visualRemaining !== null &&
    visualRemaining <= 0;

  useEffect(() => {
    if (!roomId) return;
    const saved = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
    if (saved === "quiet" || saved === "audio" || saved === "mosaic" || saved === "camera") {
      modeRef.current = saved;
      setMode(saved);
    }
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    getClientSessionSnapshot({ force: true })
      .then((session) => {
        if (!cancelled) accessTokenRef.current = session?.accessToken || "";
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    lastRuntimeSnapshotRef.current = null;

    const applyAndReport = () => {
      applyModeToOutgoingTracks(mode);

      const snapshot = readRuntimeSnapshot();
      if (!snapshot.ready) return;
      const previous = lastRuntimeSnapshotRef.current;
      lastRuntimeSnapshotRef.current = snapshot;
      if (!previous) return;

      let eventType: PresenceEventType | null = null;
      if (snapshot.video !== previous.video) {
        eventType = snapshot.video ? "video_on" : "video_off";
      } else if (snapshot.audio !== previous.audio) {
        eventType = snapshot.audio ? "audio_on" : "audio_off";
      } else if (snapshot.screen !== previous.screen) {
        eventType = "heartbeat";
      }

      const actions = (
        window as Window & {
          __calmcoPresenceActions?: {
            send: (eventType: PresenceEventType) => Promise<unknown>;
          };
        }
      ).__calmcoPresenceActions;
      if (eventType && actions) {
        void actions.send(eventType).catch(() => undefined);
      }
    };

    applyAndReport();
    const timer = window.setInterval(applyAndReport, 500);
    const observer = new MutationObserver(applyAndReport);
    const stage = document.querySelector<HTMLElement>(
      '[data-room-call-stage="true"]',
    );
    if (stage) {
      observer.observe(stage, {
        attributes: true,
        attributeFilter: [
          "data-daily-ready",
          "data-local-audio",
          "data-local-video",
          "data-screen-sharing",
        ],
      });
    }

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [roomId, mode]);

  useEffect(() => {
    if (!roomId) return;
    let disposed = false;
    leaveSentRef.current = false;
    dailyReadySeenRef.current = false;

    async function authedFetch(path: string, init?: RequestInit) {
      let token = accessTokenRef.current;
      if (!token) {
        const session = await getClientSessionSnapshot({ force: true }).catch(() => null);
        token = session?.accessToken || "";
        accessTokenRef.current = token;
      }
      if (!token) throw new Error("登入狀態尚未準備完成。");

      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Presence API 失敗。");
      return payload;
    }

    async function sendPresence(
      eventType: PresenceEventType,
      options?: {
        keepalive?: boolean;
        brbUntil?: string | null;
        extensionDecision?: "continue" | "leave";
      },
    ) {
      const snapshot = readRuntimeSnapshot();
      if (snapshot.ready) {
        dailyReadySeenRef.current = true;
      } else if (dailyReadySeenRef.current) {
        snapshot.dailyParticipantState = "left";
      }

      const payload = await authedFetch("/api/rooms/presence/event", {
        method: "POST",
        keepalive: options?.keepalive,
        body: JSON.stringify({
          roomId,
          presenceMode: modeRef.current,
          eventType,
          visibleState: document.visibilityState,
          dailyParticipantState: snapshot.dailyParticipantState,
          mediaTrackState: {
            source: "room_lifecycle_bridge_v128",
            audio: snapshot.audio,
            video: snapshot.video,
            screen: snapshot.screen,
            page_hidden: document.hidden,
          },
          brbUntil: options?.brbUntil,
          extensionDecision: options?.extensionDecision,
        }),
      });
      if (!disposed) {
        const commercialUsage = payload?.commercial_usage || {};
        if (commercialUsage.downgradeRequired === true) {
          modeRef.current = "quiet";
          setMode("quiet");
          window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${roomId}`, "quiet");
          applyModeToOutgoingTracks("quiet");
          setStatus("視覺額度已用完，已安全切回安靜在場。音訊／安靜仍可繼續使用。");
        } else {
          setStatus(
            `${payload?.state?.presence_status || "active"}・${payload?.billing_media_class || "unknown"}`,
          );
        }
      }
      return payload;
    }

    async function refreshState() {
      const payload = (await authedFetch(
        `/api/rooms/${encodeURIComponent(roomId)}/presence-state`,
      )) as PresenceStatePayload;
      if (!disposed) {
        setStatePayload(payload);
        setStatus(payload.build_tag || "Presence 狀態已同步");
      }
    }

    async function sendLeave(keepalive = true) {
      if (suppressLeaveRef.current || leaveSentRef.current) return;
      leaveSentRef.current = true;
      await sendPresence("left", { keepalive }).catch(() => undefined);
      await authedFetch("/api/rooms/leave", {
        method: "POST",
        keepalive,
        body: JSON.stringify({ roomId, reason: "explicit_navigation" }),
      }).catch(() => undefined);
    }

    const initial = window.setTimeout(() => {
      applyModeToOutgoingTracks(modeRef.current);
      void sendPresence("selected").catch((error) => setStatus(error.message));
      void sendPresence("heartbeat").catch(() => undefined);
      void refreshState().catch((error) => setStatus(error.message));
    }, 1_100);

    const heartbeat = window.setInterval(() => {
      void sendPresence("heartbeat").catch((error) => setStatus(error.message));
    }, HEARTBEAT_INTERVAL_MS);

    const stateRefresh = window.setInterval(() => {
      void refreshState().catch(() => undefined);
    }, STATE_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      void sendPresence(document.hidden ? "hidden" : "visible", {
        keepalive: true,
      }).catch(() => undefined);
    };
    const onPageHide = () => {
      void sendLeave(true);
    };
    const onClickCapture = (event: MouseEvent) => {
      if (clickedLeaveTarget(event.target)) void sendLeave(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClickCapture, true);

    (window as Window & {
      __calmcoPresenceActions?: {
        send: typeof sendPresence;
        refresh: typeof refreshState;
      };
    }).__calmcoPresenceActions = { send: sendPresence, refresh: refreshState };

    return () => {
      disposed = true;
      window.clearTimeout(initial);
      window.clearInterval(heartbeat);
      window.clearInterval(stateRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClickCapture, true);
      void sendLeave(true);
      delete (window as Window & { __calmcoPresenceActions?: unknown })
        .__calmcoPresenceActions;
    };
  }, [roomId]);

  async function callPresenceAction(
    eventType: PresenceEventType,
    options?: {
      brbUntil?: string | null;
      extensionDecision?: "continue" | "leave";
    },
  ) {
    const actions = (
      window as Window & {
        __calmcoPresenceActions?: {
          send: (
            eventType: PresenceEventType,
            options?: {
              brbUntil?: string | null;
              extensionDecision?: "continue" | "leave";
            },
          ) => Promise<unknown>;
          refresh: () => Promise<unknown>;
        };
      }
    ).__calmcoPresenceActions;
    if (!actions) return;
    await actions.send(eventType, options);
    await actions.refresh().catch(() => undefined);
  }

  async function chooseMode(nextMode: PresenceMode) {
    if ((nextMode === "mosaic" || nextMode === "camera") && visualQuotaExhausted) {
      setStatus("本期視覺同行額度已用完；仍可使用安靜或音訊在場。");
      return;
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${roomId}`, nextMode);
    setStatus("正在套用 Presence Mode…");
    window.setTimeout(() => applyModeToOutgoingTracks(nextMode), 80);
    await callPresenceAction("selected").catch((error) =>
      setStatus(error.message),
    );
  }

  async function startBrb(minutes: 3 | 5 | 10) {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    setBrbUntil(until);
    setStatus(`BRB ${minutes} 分鐘已開始`);
    await callPresenceAction("brb_start", { brbUntil: until }).catch((error) =>
      setStatus(error.message),
    );
  }

  async function returnFromBrb() {
    setBrbUntil(null);
    setStatus("歡迎回來，正在恢復 Presence…");
    await callPresenceAction("brb_end").catch((error) => setStatus(error.message));
  }

  async function confirmExtension(decision: "continue" | "leave") {
    setExtensionDecision(decision);
    setStatus(decision === "continue" ? "已記錄想繼續 25 分鐘" : "已記錄這次離開");
    await callPresenceAction("extension_confirmed", {
      extensionDecision: decision,
    }).catch((error) => setStatus(error.message));
  }

  async function finalizeExtension() {
    const scheduledEndAt = statePayload?.room?.scheduled_end_at;
    if (!scheduledEndAt) {
      setStatus("尚未取得房間結束時間，請先重新整理 Presence 狀態。");
      return;
    }
    const token = accessTokenRef.current ||
      (await getClientSessionSnapshot({ force: true }).catch(() => null))?.accessToken ||
      "";
    if (!token) {
      setStatus("登入狀態尚未準備完成。");
      return;
    }

    setExtensionApplying(true);
    setStatus("正在核對所有人的延長決定與同行延長點…");
    try {
      const extensionWindowKey = `end:${scheduledEndAt}`;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/commercial-extension`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            extensionWindowKey,
            idempotencyKey: `room:${roomId}:window:${extensionWindowKey}`,
          }),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "套用延長失敗。");

      setStatus("已延長 25 分鐘，正在安全更新短效 Daily token…");
      // Short-term P2 MVP: controlled reload obtains a fresh short-lived token.
      // suppressLeaveRef prevents the lifecycle cleanup from treating this as
      // an explicit departure. The stable billing session key prevents recharge.
      suppressLeaveRef.current = true;
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "套用延長失敗。");
      setExtensionApplying(false);
      await (window as Window & { __calmcoPresenceActions?: { refresh: () => Promise<unknown> } })
        .__calmcoPresenceActions?.refresh()
        .catch(() => undefined);
    }
  }

  if (!roomId) return null;

  return (
    <aside className="presence-v128-dock" data-presence-build="room-presence-commercial-v130-2026-07-20">
      <button
        type="button"
        className="presence-v128-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>Presence</span>
        <b>{modeOptions.find((item) => item.code === mode)?.label}</b>
      </button>

      {expanded ? (
        <div className="presence-v128-panel">
          <header>
            <div>
              <span>舒服在場</span>
              <b>不強迫開鏡頭</b>
            </div>
            <small>{status}</small>
          </header>

          <div className="presence-v128-modes" role="radiogroup" aria-label="Presence Mode">
            {modeOptions.map((item) => (
              <button
                type="button"
                role="radio"
                aria-checked={mode === item.code}
                className={mode === item.code ? "active" : ""}
                key={item.code}
                onClick={() => void chooseMode(item.code)}
                disabled={
                  visualQuotaExhausted &&
                  (item.code === "mosaic" || item.code === "camera")
                }
              >
                <b>{item.label}</b>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>

          {mode === "mosaic" ? (
            <p className="presence-v128-note">柔焦模式會先確保鏡頭開啟；模糊強度仍由既有影像設定控制。</p>
          ) : null}

          {commercialEntitlement?.planCode === "rooms_unlimited_299" ? (
            <div className="presence-v130-wallet">
              <span>Rooms 299 本期額度</span>
              <b>視覺 {visualRemaining === null ? "讀取中" : `${Math.floor(visualRemaining / 60)} 分`}・延長點 {extensionPointsRemaining ?? "—"}</b>
            </div>
          ) : null}

          <div className="presence-v128-brb">
            {brbUntil ? (
              <button type="button" className="primary" onClick={() => void returnFromBrb()}>
                我回來了
              </button>
            ) : (
              <>
                <span>暫時離開</span>
                {[3, 5, 10].map((minutes) => (
                  <button
                    type="button"
                    key={minutes}
                    onClick={() => void startBrb(minutes as 3 | 5 | 10)}
                  >
                    {minutes} 分
                  </button>
                ))}
              </>
            )}
          </div>

          {showExtensionPrompt ? (
            <div className="presence-v128-extension">
              <b>房間約 {endInMinutes && endInMinutes > 0 ? `${endInMinutes} 分鐘後` : "現在"}結束</b>
              <span>每位參與者先選擇是否留下；Rooms 會員本人不扣點，非會員由套用延長的人每位支付 1 點。</span>
              <div>
                <button
                  type="button"
                  className={extensionDecision === "continue" ? "active" : ""}
                  onClick={() => void confirmExtension("continue")}
                >
                  繼續 25 分鐘
                </button>
                <button
                  type="button"
                  className={extensionDecision === "leave" ? "active" : ""}
                  onClick={() => void confirmExtension("leave")}
                >
                  這次離開
                </button>
              </div>
              {extensionDecision === "continue" ? (
                <button
                  type="button"
                  className="presence-v130-apply"
                  disabled={extensionApplying}
                  onClick={() => void finalizeExtension()}
                >
                  {extensionApplying ? "核對中…" : "核對所有人並套用延長"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <style jsx>{`
        .presence-v128-dock {
          position: fixed;
          right: 20px;
          bottom: 88px;
          z-index: 80;
          width: min(390px, calc(100vw - 32px));
          color: #163039;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .presence-v128-toggle {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(244, 216, 181, .35);
          border-radius: 999px;
          padding: 11px 16px;
          background: rgba(10, 35, 44, .92);
          color: #fff0dc;
          box-shadow: 0 18px 60px rgba(0,0,0,.24);
          backdrop-filter: blur(18px);
          cursor: pointer;
        }
        .presence-v128-toggle span { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .7; }
        .presence-v128-panel {
          margin-top: 9px;
          padding: 16px;
          border: 1px solid rgba(31, 53, 59, .12);
          border-radius: 24px;
          background: rgba(246, 239, 228, .96);
          box-shadow: 0 24px 80px rgba(0,0,0,.26);
          backdrop-filter: blur(18px);
        }
        .presence-v128-panel header { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
        .presence-v128-panel header div { display: grid; gap: 3px; }
        .presence-v128-panel header span { color: rgba(22,48,57,.58); font-size: 11px; letter-spacing: .12em; }
        .presence-v128-panel header b { font-family: Georgia, "Noto Serif TC", serif; font-size: 19px; font-weight: 500; }
        .presence-v128-panel header small { max-width: 180px; color: rgba(22,48,57,.56); text-align: right; line-height: 1.4; }
        .presence-v128-modes { margin-top: 14px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .presence-v128-modes button {
          min-height: 64px;
          display: grid;
          gap: 4px;
          text-align: left;
          border: 1px solid rgba(22,48,57,.1);
          border-radius: 15px;
          padding: 10px 12px;
          background: rgba(255,255,255,.48);
          color: #163039;
          cursor: pointer;
        }
        .presence-v128-modes button.active { border-color: #9d7b57; background: rgba(233, 207, 174, .48); }
        .presence-v128-modes span { color: rgba(22,48,57,.58); font-size: 11px; }
        .presence-v128-note { margin: 9px 0 0; color: rgba(22,48,57,.62); font-size: 12px; line-height: 1.55; }
        .presence-v130-wallet { margin-top: 10px; display: grid; gap: 3px; padding: 10px 12px; border-radius: 14px; background: rgba(22,56,67,.07); }
        .presence-v130-wallet span { color: rgba(22,48,57,.58); font-size: 11px; }
        .presence-v130-wallet b { font-size: 13px; }
        .presence-v128-brb { margin-top: 12px; display: flex; align-items: center; gap: 7px; padding-top: 12px; border-top: 1px solid rgba(22,48,57,.1); }
        .presence-v128-brb span { margin-right: auto; color: rgba(22,48,57,.65); font-size: 12px; }
        .presence-v128-brb button, .presence-v128-extension button {
          border: 0;
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(22,48,57,.08);
          color: #163039;
          cursor: pointer;
        }
        .presence-v128-brb button.primary, .presence-v128-extension button.active, .presence-v130-apply { background: #163843; color: #fff0dc; }
        .presence-v130-apply { justify-self: start; margin-top: 3px; }
        .presence-v128-modes button:disabled { opacity: .45; cursor: not-allowed; }
        .presence-v128-extension { margin-top: 12px; padding: 13px; display: grid; gap: 7px; border-radius: 16px; background: rgba(149,116,82,.1); }
        .presence-v128-extension span { color: rgba(22,48,57,.62); font-size: 11px; line-height: 1.5; }
        .presence-v128-extension div { display: flex; gap: 8px; }
        @media (max-width: 640px) {
          .presence-v128-dock { right: 12px; bottom: 76px; width: calc(100vw - 24px); }
          .presence-v128-panel { max-height: 62vh; overflow: auto; }
        }
      `}</style>
    </aside>
  );
}
