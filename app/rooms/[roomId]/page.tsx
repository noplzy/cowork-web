"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { fetchAccountStatus } from "@/lib/accountStatusClient";
import { getRuntimeCaps, type RuntimeCaps } from "@/lib/runtimeCaps";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";
import {
  RoomCallStage,
  type RoomParticipantTile,
} from "@/components/rooms/RoomCallStage";
import {
  RoomVideoEffectsPanel,
  type FullBlurQuality,
} from "@/components/rooms/RoomVideoEffectsPanel";
import {
  createFullFrameBlurPipeline,
  type FullFrameBlurPipeline,
} from "@/lib/daily/fullFrameBlur";

type Room = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
  created_by: string;
  daily_room_url?: string | null;
  visibility?: "public" | "members" | "friends" | "invited" | null;
  invite_code?: string | null;
};

type Bootstrap = {
  room: Room;
  is_owner: boolean;
  is_member: boolean;
  can_join: boolean;
  requires_invite_code: boolean;
  invite_code_accepted: boolean;
};

type Token = {
  token: string;
  exp: number;
  duration_minutes: number;
  cost_credits: number;
  free_monthly_allowance: number;
  remaining_credits: number | null;
  is_vip: boolean;
  allowed_by_pair_vip_carry: boolean;
};

type DailyCallLike = {
  join: (options: { url: string; token?: string }) => Promise<unknown>;
  leave?: () => Promise<unknown> | unknown;
  destroy?: () => Promise<unknown> | unknown;
  on?: (eventName: string, handler: (event?: unknown) => void) => void;
  off?: (eventName: string, handler: (event?: unknown) => void) => void;
  participants?: () => Record<string, any>;
  setLocalAudio?: (enabled: boolean) => Promise<unknown> | unknown;
  setLocalVideo?: (enabled: boolean) => Promise<unknown> | unknown;
  localAudio?: () => boolean;
  localVideo?: () => boolean;
  startScreenShare?: () => Promise<unknown> | unknown;
  stopScreenShare?: () => Promise<unknown> | unknown;
  updateInputSettings?: (settings: unknown) => Promise<unknown>;
  getInputSettings?: () => Promise<any> | any;
  setInputDevicesAsync?: (settings: unknown) => Promise<unknown>;
};

const DEFAULT_BACKGROUND_BLUR = 65;
const DEFAULT_FULL_BLUR_PX = 10;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function backgroundBlurSliderToProcessor(value: number): number {
  return clampNumber(value, 15, 100) / 100;
}

function processorToBackgroundBlurSlider(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BACKGROUND_BLUR;
  }

  return Math.round(clampNumber(value, 0.15, 1) * 100);
}

function getTrackFromParticipant(
  participant: any,
  trackKind: "video" | "audio" | "screenVideo"
): MediaStreamTrack | null {
  const track =
    participant?.tracks?.[trackKind]?.persistentTrack ??
    participant?.tracks?.[trackKind]?.track ??
    participant?.[`${trackKind}Track`] ??
    null;

  return track instanceof MediaStreamTrack ? track : null;
}

function participantTrackIsOn(
  participant: any,
  trackKind: "video" | "audio" | "screenVideo"
): boolean {
  const state = participant?.tracks?.[trackKind]?.state;
  if (typeof state === "string") {
    return state === "playable" || state === "loading" || state === "interrupted";
  }

  return Boolean(getTrackFromParticipant(participant, trackKind));
}

function participantDisplayName(participantId: string, participant: any): string {
  if (participant?.local) {
    return "你";
  }

  return (
    participant?.user_name ||
    participant?.user_id ||
    participant?.owner_name ||
    `同行者 ${participantId.slice(0, 4)}`
  );
}

function toParticipantTiles(participants: Record<string, any>): RoomParticipantTile[] {
  return Object.entries(participants)
    .filter(([, participant]) => participant && participant?.joined_at !== false)
    .map(([participantId, participant]) => ({
      id: participantId,
      name: participantDisplayName(participantId, participant),
      isLocal: Boolean(participant?.local),
      videoTrack: getTrackFromParticipant(participant, "video"),
      audioTrack: getTrackFromParticipant(participant, "audio"),
      screenTrack: getTrackFromParticipant(participant, "screenVideo"),
      videoOn: participantTrackIsOn(participant, "video"),
      audioOn: participantTrackIsOn(participant, "audio"),
    }))
    .sort((left, right) => {
      if (left.isLocal === right.isLocal) {
        return left.name.localeCompare(right.name, "zh-Hant");
      }
      return left.isLocal ? -1 : 1;
    });
}

function getLocalParticipant(participants: Record<string, any>): any | null {
  return participants.local ?? Object.values(participants).find((item: any) => item?.local) ?? null;
}

function getDeviceId(track: MediaStreamTrack | null): string {
  if (!track || typeof track.getSettings !== "function") {
    return "";
  }

  const settings = track.getSettings();
  return typeof settings.deviceId === "string" ? settings.deviceId : "";
}

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = params?.roomId;
  const inviteFromUrl = (search.get("invite") || search.get("code") || "")
    .trim()
    .toUpperCase();

  const callRef = useRef<DailyCallLike | null>(null);
  const fullBlurPipelineRef = useRef<FullFrameBlurPipeline | null>(null);
  const backgroundBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [canJoin, setCanJoin] = useState(false);
  const [dailyToken, setDailyToken] = useState("");
  const [tokenInfo, setTokenInfo] = useState<Token | null>(null);
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [runtimeCaps, setRuntimeCaps] = useState<RuntimeCaps | null>(null);
  const [dailyReady, setDailyReady] = useState(false);
  const [participants, setParticipants] = useState<RoomParticipantTile[]>([]);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const [effectBusy, setEffectBusy] = useState(false);
  const [effectStatus, setEffectStatus] = useState(
    "進入房間後，可在桌機調整影像模糊效果。"
  );
  const [effectError, setEffectError] = useState("");

  const [backgroundBlurEnabled, setBackgroundBlurEnabled] = useState(false);
  const [backgroundBlurStrength, setBackgroundBlurStrength] = useState(
    DEFAULT_BACKGROUND_BLUR
  );

  const [fullBlurEnabled, setFullBlurEnabled] = useState(false);
  const [fullBlurPx, setFullBlurPx] = useState(DEFAULT_FULL_BLUR_PX);
  const [fullBlurQuality, setFullBlurQuality] =
    useState<FullBlurQuality>("balanced");

  const desktopBlurAvailable = Boolean(runtimeCaps && !runtimeCaps.isMobile);
  const fullBlurAvailable = Boolean(
    runtimeCaps &&
      !runtimeCaps.isMobile &&
      runtimeCaps.supportsCanvasCaptureStream &&
      runtimeCaps.supportsCanvasFilter
  );

  const canMountDaily = Boolean(room?.daily_room_url && dailyToken);
  const roomStatus = useMemo(() => {
    if (!room?.daily_room_url) {
      return "待建立視訊空間";
    }

    if (!dailyToken) {
      return "待取得入場憑證";
    }

    return dailyReady ? "通話已連線" : "視訊空間連線中";
  }, [dailyReady, dailyToken, room?.daily_room_url]);

  useEffect(() => {
    setRuntimeCaps(getRuntimeCaps());
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!session) {
        router.replace("/auth/login");
        return;
      }

      if (cancelled) {
        return;
      }

      setEmail(session.email);
      setAccessToken(session.accessToken ?? "");
      await bootstrap(session.accessToken ?? "", inviteFromUrl);
    })();

    return () => {
      cancelled = true;
    };
    // `inviteFromUrl` is part of the initial bootstrap only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, roomId]);

  useEffect(() => {
    let cancelled = false;
    let joinedHandler: ((event?: unknown) => void) | null = null;
    let leftHandler: ((event?: unknown) => void) | null = null;
    let participantHandler: ((event?: unknown) => void) | null = null;
    let trackHandler: ((event?: unknown) => void) | null = null;
    let inputHandler: ((event?: unknown) => void) | null = null;
    let screenStartedHandler: ((event?: unknown) => void) | null = null;
    let screenStoppedHandler: ((event?: unknown) => void) | null = null;
    let errorHandler: ((event?: unknown) => void) | null = null;

    async function mountCallObject() {
      if (!canMountDaily || !room?.daily_room_url) {
        setDailyReady(false);
        setParticipants([]);
        return;
      }

      await destroyCallObject(false);

      setDailyReady(false);
      setParticipants([]);
      setEffectError("");
      setEffectStatus("房間連線中，完成後即可調整桌機影像效果。");

      const dailyModule = await import("@daily-co/daily-js");
      if (cancelled) {
        return;
      }

      const DailyIframe = (dailyModule as any).default ?? dailyModule;
      const call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      }) as DailyCallLike;

      callRef.current = call;

      const refreshParticipants = () => {
        if (cancelled) {
          return;
        }

        const snapshot = call.participants?.() ?? {};
        const tiles = toParticipantTiles(snapshot);
        const local = getLocalParticipant(snapshot);

        setParticipants(tiles);
        setLocalAudioEnabled(
          typeof call.localAudio === "function"
            ? Boolean(call.localAudio())
            : participantTrackIsOn(local, "audio")
        );
        setLocalVideoEnabled(
          typeof call.localVideo === "function"
            ? Boolean(call.localVideo())
            : participantTrackIsOn(local, "video")
        );
      };

      joinedHandler = () => {
        if (cancelled) {
          return;
        }

        setDailyReady(true);
        setEffectStatus("桌機影像效果已就緒。");
        refreshParticipants();
      };

      leftHandler = () => {
        if (cancelled) {
          return;
        }

        setDailyReady(false);
        setEffectStatus("通話已離開。重新進房後，可再次調整影像效果。");
        refreshParticipants();
      };

      participantHandler = refreshParticipants;
      trackHandler = refreshParticipants;
      screenStartedHandler = () => setScreenSharing(true);
      screenStoppedHandler = () => setScreenSharing(false);
      inputHandler = () => void syncBackgroundBlurState();
      errorHandler = () => {
        setEffectError("影像或通話狀態出現短暫異常，請稍後再試。");
      };

      call.on?.("joined-meeting", joinedHandler);
      call.on?.("left-meeting", leftHandler);
      call.on?.("participant-joined", participantHandler);
      call.on?.("participant-updated", participantHandler);
      call.on?.("participant-left", participantHandler);
      call.on?.("track-started", trackHandler);
      call.on?.("track-stopped", trackHandler);
      call.on?.("input-settings-updated", inputHandler);
      call.on?.("screen-share-started", screenStartedHandler);
      call.on?.("screen-share-stopped", screenStoppedHandler);
      call.on?.("camera-error", errorHandler);
      call.on?.("nonfatal-error", errorHandler);

      await call.join({
        url: room.daily_room_url,
        token: dailyToken,
      });

      refreshParticipants();
    }

    mountCallObject().catch((error: any) => {
      if (cancelled) {
        return;
      }

      setDailyReady(false);
      setMsg(error?.message || "載入房內視訊失敗。");
      setEffectError("視訊空間尚未準備完成，請稍後重新整理頁面。");
    });

    return () => {
      cancelled = true;

      if (backgroundBlurTimerRef.current) {
        clearTimeout(backgroundBlurTimerRef.current);
        backgroundBlurTimerRef.current = null;
      }

      void destroyCallObject(false);

      const call = callRef.current;
      if (!call) {
        return;
      }

      if (joinedHandler) call.off?.("joined-meeting", joinedHandler);
      if (leftHandler) call.off?.("left-meeting", leftHandler);
      if (participantHandler) {
        call.off?.("participant-joined", participantHandler);
        call.off?.("participant-updated", participantHandler);
        call.off?.("participant-left", participantHandler);
      }
      if (trackHandler) {
        call.off?.("track-started", trackHandler);
        call.off?.("track-stopped", trackHandler);
      }
      if (inputHandler) call.off?.("input-settings-updated", inputHandler);
      if (screenStartedHandler) call.off?.("screen-share-started", screenStartedHandler);
      if (screenStoppedHandler) call.off?.("screen-share-stopped", screenStoppedHandler);
      if (errorHandler) {
        call.off?.("camera-error", errorHandler);
        call.off?.("nonfatal-error", errorHandler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMountDaily, room?.daily_room_url, dailyToken]);

  useEffect(() => {
    if (!dailyReady || !backgroundBlurEnabled || fullBlurEnabled) {
      return;
    }

    if (backgroundBlurTimerRef.current) {
      clearTimeout(backgroundBlurTimerRef.current);
    }

    backgroundBlurTimerRef.current = setTimeout(() => {
      void applyBackgroundBlur(true, backgroundBlurStrength, false);
    }, 180);

    return () => {
      if (backgroundBlurTimerRef.current) {
        clearTimeout(backgroundBlurTimerRef.current);
        backgroundBlurTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundBlurStrength, backgroundBlurEnabled, fullBlurEnabled, dailyReady]);

  async function bootstrap(token = accessToken, invite = inviteCode) {
    if (!roomId) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const response = await fetch("/api/rooms/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          inviteCode: invite || undefined,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "讀取房間資訊失敗。");
      }

      const data = json as Bootstrap;
      setRoom(data.room);
      setIsMember(Boolean(data.is_member || data.is_owner));
      setCanJoin(Boolean(data.can_join || data.is_member || data.is_owner));

      if (data.is_member || data.is_owner) {
        await requestToken(token);
      }
    } catch (error: any) {
      setMsg(error?.message || "讀取房間失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!roomId) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(inviteCode ? { inviteCode } : { roomId }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "加入失敗。");
      }

      setIsMember(true);
      setCanJoin(true);
      await requestToken(accessToken);
    } catch (error: any) {
      setMsg(error?.message || "加入房間失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function requestToken(token = accessToken) {
    if (!roomId) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const response = await fetch("/api/daily/meeting-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "取得入場憑證失敗。");
      }

      setDailyToken(json.token);
      setTokenInfo(json as Token);
      await fetchAccountStatus(token).catch(() => null);
    } catch (error: any) {
      setMsg(error?.message || "取得視訊權限失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function destroyCallObject(resetCopy: boolean) {
    await disableFullBlur(false);

    const call = callRef.current;
    callRef.current = null;

    if (call?.leave) {
      await Promise.resolve(call.leave()).catch(() => undefined);
    }

    if (call?.destroy) {
      await Promise.resolve(call.destroy()).catch(() => undefined);
    }

    setDailyReady(false);
    setParticipants([]);
    setScreenSharing(false);

    if (resetCopy) {
      setEffectStatus("通話已離開。");
    }
  }

  async function syncBackgroundBlurState() {
    const call = callRef.current;
    if (!call?.getInputSettings || fullBlurEnabled) {
      return;
    }

    try {
      const settings = await Promise.resolve(call.getInputSettings());
      const processor = settings?.video?.processor;
      if (processor?.type === "background-blur") {
        setBackgroundBlurEnabled(true);
        setBackgroundBlurStrength(
          processorToBackgroundBlurSlider(processor?.config?.strength)
        );
        return;
      }

      if (processor?.type === "none" || !processor?.type) {
        setBackgroundBlurEnabled(false);
      }
    } catch {
      // Best-effort sync only; the call state remains authoritative.
    }
  }

  async function applyBackgroundBlur(
    enabled: boolean,
    uiStrength = backgroundBlurStrength,
    announce = true
  ) {
    const call = callRef.current;

    if (!call?.updateInputSettings) {
      setEffectError("視訊空間尚未準備完成，請稍後再試。");
      return false;
    }

    try {
      await call.updateInputSettings({
        video: {
          processor: enabled
            ? {
                type: "background-blur",
                config: {
                  strength: backgroundBlurSliderToProcessor(uiStrength),
                },
              }
            : { type: "none" },
        },
      });

      setBackgroundBlurEnabled(enabled);
      setEffectError("");

      if (announce) {
        setEffectStatus(
          enabled
            ? `背景模糊已開啟，模糊程度 ${uiStrength}%。`
            : "背景模糊已關閉。"
        );
      }

      return true;
    } catch (error: any) {
      setEffectError(error?.message || "背景模糊暫時無法套用，請稍後再試。");
      return false;
    }
  }

  async function handleToggleBackgroundBlur() {
    if (!dailyReady || effectBusy || !desktopBlurAvailable) {
      return;
    }

    setEffectBusy(true);
    setEffectError("");

    try {
      if (backgroundBlurEnabled) {
        await applyBackgroundBlur(false, backgroundBlurStrength, true);
        return;
      }

      if (fullBlurEnabled) {
        const fullBlurClosed = await disableFullBlur(false);
        if (!fullBlurClosed) {
          return;
        }
      }

      await applyBackgroundBlur(true, backgroundBlurStrength, true);
    } finally {
      setEffectBusy(false);
    }
  }

  function getLocalVideoTrack(): MediaStreamTrack | null {
    const call = callRef.current;
    const snapshot = call?.participants?.() ?? {};
    const local = getLocalParticipant(snapshot);
    const currentTrack = getTrackFromParticipant(local, "video");

    if (!currentTrack || currentTrack.readyState !== "live") {
      return null;
    }

    if (typeof currentTrack.clone === "function") {
      return currentTrack.clone();
    }

    return null;
  }

  async function enableFullBlur() {
    const call = callRef.current;

    if (!dailyReady || !call?.setInputDevicesAsync) {
      setEffectError("視訊空間尚未準備完成，請稍後再試。");
      return false;
    }

    if (!fullBlurAvailable) {
      setEffectError("全畫面模糊目前僅提供桌機使用。");
      return false;
    }

    if (!localVideoEnabled) {
      setEffectError("請先開啟鏡頭，再啟用全畫面模糊。");
      return false;
    }

    const sourceTrack = getLocalVideoTrack();
    if (!sourceTrack) {
      setEffectError("目前無法取得可處理的本地影像，請先重新開啟鏡頭。");
      return false;
    }

    setEffectBusy(true);
    setEffectError("");

    let pipeline: FullFrameBlurPipeline | null = null;

    try {
      if (backgroundBlurEnabled) {
        await applyBackgroundBlur(false, backgroundBlurStrength, false);
      }

      pipeline = await createFullFrameBlurPipeline({
        sourceTrack,
        blurPx: fullBlurPx,
        quality: fullBlurQuality,
      });

      await call.setInputDevicesAsync({
        videoSource: pipeline.processedTrack,
      });

      fullBlurPipelineRef.current = pipeline;
      setFullBlurEnabled(true);
      setBackgroundBlurEnabled(false);
      setEffectStatus(
        "全畫面模糊已開啟，房內其他參與者會看到柔化後的影像。"
      );
      return true;
    } catch (error: any) {
      pipeline?.disposeAll();
      fullBlurPipelineRef.current = null;
      setFullBlurEnabled(false);
      setEffectError(error?.message || "全畫面模糊暫時無法啟用，請稍後再試。");
      return false;
    } finally {
      setEffectBusy(false);
    }
  }

  async function disableFullBlur(announce = true) {
    const call = callRef.current;
    const pipeline = fullBlurPipelineRef.current;

    if (!pipeline) {
      setFullBlurEnabled(false);
      return true;
    }

    if (!call?.setInputDevicesAsync) {
      pipeline.disposeAll();
      fullBlurPipelineRef.current = null;
      setFullBlurEnabled(false);
      setEffectError("視訊空間尚未準備完成，請重新整理房間。");
      return false;
    }

    try {
      const sourceDeviceId = getDeviceId(pipeline.sourceTrack);
      if (sourceDeviceId) {
        await call.setInputDevicesAsync({
          videoDeviceId: sourceDeviceId,
        });
        pipeline.disposeAll();
      } else {
        await call.setInputDevicesAsync({
          videoSource: pipeline.sourceTrack,
        });
        pipeline.disposeProcessedOnly();
      }

      fullBlurPipelineRef.current = null;
      setFullBlurEnabled(false);
      setEffectError("");

      if (announce) {
        setEffectStatus("全畫面模糊已關閉。");
      }

      return true;
    } catch (error: any) {
      pipeline.disposeAll();
      fullBlurPipelineRef.current = null;
      setFullBlurEnabled(false);
      setEffectError(error?.message || "全畫面模糊關閉失敗，請重新整理房間。");
      return false;
    }
  }

  async function handleToggleFullBlur() {
    if (!dailyReady || effectBusy) {
      return;
    }

    if (fullBlurEnabled) {
      setEffectBusy(true);
      try {
        await disableFullBlur(true);
      } finally {
        setEffectBusy(false);
      }
      return;
    }

    await enableFullBlur();
  }

  function handleFullBlurPxChange(value: number) {
    const nextValue = clampNumber(value, 2, 28);
    setFullBlurPx(nextValue);
    fullBlurPipelineRef.current?.updateBlurPx(nextValue);

    if (fullBlurEnabled) {
      setEffectStatus(`全畫面模糊已更新，模糊程度 ${nextValue}px。`);
    }
  }

  function handleFullBlurQualityChange(value: FullBlurQuality) {
    if (fullBlurEnabled) {
      return;
    }

    setFullBlurQuality(value);
  }

  async function toggleLocalAudio() {
    const call = callRef.current;
    if (!call?.setLocalAudio || !dailyReady) {
      return;
    }

    const nextValue = !localAudioEnabled;
    await Promise.resolve(call.setLocalAudio(nextValue)).catch(() => {
      setEffectError("麥克風狀態切換失敗，請稍後再試。");
    });
    setLocalAudioEnabled(nextValue);
  }

  async function toggleLocalVideo() {
    const call = callRef.current;
    if (!call?.setLocalVideo || !dailyReady) {
      return;
    }

    if (localVideoEnabled && fullBlurEnabled) {
      setEffectBusy(true);
      try {
        await disableFullBlur(false);
      } finally {
        setEffectBusy(false);
      }
    }

    const nextValue = !localVideoEnabled;
    await Promise.resolve(call.setLocalVideo(nextValue)).catch(() => {
      setEffectError("鏡頭狀態切換失敗，請稍後再試。");
    });
    setLocalVideoEnabled(nextValue);
  }

  async function toggleScreenShare() {
    const call = callRef.current;
    if (!call || !dailyReady) {
      return;
    }

    try {
      if (screenSharing) {
        await Promise.resolve(call.stopScreenShare?.());
        setScreenSharing(false);
        return;
      }

      await Promise.resolve(call.startScreenShare?.());
      setScreenSharing(true);
    } catch {
      setEffectError("螢幕分享暫時無法啟用。");
    }
  }

  async function leaveRoom() {
    await destroyCallObject(true);
    router.push("/rooms");
  }

  return (
    <Image20SidebarShell
      title="房內空間"
      email={email}
      lead="視訊互動、低壓力在場與桌機影像效果，在同一個房間裡順暢完成。"
    >
      <div
        className="i20-call-shell"
        data-image20-dom-page="room-detail-call-object-v1"
      >
        <RoomCallStage
          roomTitle={room?.title || "同行房間"}
          durationMinutes={room?.duration_minutes ?? 25}
          roomMode={room?.mode === "pair" ? "雙人" : "小組"}
          roomStatus={roomStatus}
          participants={participants}
          ready={dailyReady}
          localAudioEnabled={localAudioEnabled}
          localVideoEnabled={localVideoEnabled}
          screenSharing={screenSharing}
          onToggleAudio={toggleLocalAudio}
          onToggleVideo={toggleLocalVideo}
          onToggleScreenShare={toggleScreenShare}
          onLeave={leaveRoom}
        />

        <aside className="i20-call-side">
          <section className="i20-panel dark">
            <span className="i20-kicker">Room State</span>
            <h3>房間狀態</h3>

            {msg ? <p style={{ color: "#ffc6b9" }}>{msg}</p> : null}

            <div className="i20-list">
              <div className="i20-softbar">
                <b>成員狀態</b>
                <span>{isMember ? "已加入" : "尚未加入"}</span>
              </div>
              <div className="i20-softbar">
                <b>入場憑證</b>
                <span>{dailyToken ? "已簽發" : "待簽發"}</span>
              </div>
              <div className="i20-softbar">
                <b>本場扣場</b>
                <span>{tokenInfo?.cost_credits ?? "?"} credits</span>
              </div>
            </div>

            {!isMember ? (
              <>
                <div className="i20-field" style={{ marginTop: 12 }}>
                  <label>邀請碼</label>
                  <input
                    className="i20-input"
                    value={inviteCode}
                    onChange={(event) =>
                      setInviteCode(event.target.value.toUpperCase())
                    }
                  />
                </div>
                <button
                  className="i20-btn peach"
                  onClick={join}
                  disabled={busy || (!canJoin && !inviteCode)}
                >
                  加入房間
                </button>
              </>
            ) : (
              <button
                className="i20-btn"
                onClick={() => requestToken(accessToken)}
                disabled={busy}
              >
                重新取得入場憑證
              </button>
            )}

            {room?.visibility === "invited" && room.invite_code ? (
              <p>邀請碼：{room.invite_code}</p>
            ) : null}
          </section>

          <RoomVideoEffectsPanel
            dailyReady={dailyReady}
            effectBusy={effectBusy}
            effectStatus={effectStatus}
            effectError={effectError}
            mobileEffectsBlocked={Boolean(runtimeCaps?.isMobile)}
            desktopBlurAvailable={desktopBlurAvailable}
            fullBlurAvailable={fullBlurAvailable}
            backgroundBlurEnabled={backgroundBlurEnabled}
            backgroundBlurStrength={backgroundBlurStrength}
            fullBlurEnabled={fullBlurEnabled}
            fullBlurPx={fullBlurPx}
            fullBlurQuality={fullBlurQuality}
            onToggleBackgroundBlur={handleToggleBackgroundBlur}
            onBackgroundBlurStrengthChange={setBackgroundBlurStrength}
            onToggleFullBlur={handleToggleFullBlur}
            onFullBlurPxChange={handleFullBlurPxChange}
            onFullBlurQualityChange={handleFullBlurQualityChange}
          />

          <section className="i20-panel">
            <span className="i20-kicker">Presence</span>
            <h3>以適合自己的方式在場</h3>
            <p>
              鏡頭與麥克風可依當下情境調整。桌機可使用影像模糊效果；行動端則以穩定通話為優先。
            </p>
          </section>

          <Link href="/rooms" className="i20-btn light">
            回房間列表
          </Link>
        </aside>
      </div>
    </Image20SidebarShell>
  );
}
