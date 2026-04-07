// app/rooms/[roomId]/page.tsx
// Desktop: custom Daily call object for reliable outgoing full-blur.
// Mobile/Tablet: keep Daily Prebuilt and disable background blur / full-blur.
//
// Source of truth:
// - Same Supabase / token / entitlement / room membership flow.
// - Do NOT change server-side token security or billing rules here.

"use client";

const __BUILD_TAG = "ROOMS_DESKTOP_CUSTOM_NO_VB_V1_20260324_ROSTER_SOCIAL_ACTIONS_V2_INVITE_FIX";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache, fetchAccountStatus } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { labelForVisibility, type PublicProfileRow, sortFriendPair, tagsToInput } from "@/lib/socialProfile";

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

type TokenResp = {
  token: string;
  exp: number;
  duration_minutes: number;
  cost_credits: number;
  free_monthly_allowance: number;
  remaining_credits: number | null;
  is_vip: boolean;
  allowed_by_pair_vip_carry: boolean;
};

type RoomMemberRow = {
  room_id: string;
  user_id: string;
};

type FriendRequestRow = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
};

type FriendshipRow = {
  user_low: string;
  user_high: string;
  created_at: string;
};

type RosterMemberItem = {
  user_id: string;
  profile: PublicProfileRow | null;
  is_owner: boolean;
  is_self: boolean;
  is_friend: boolean;
  incoming_request: FriendRequestRow | null;
  outgoing_request: FriendRequestRow | null;
};

type BgMode = "off" | "blur";
type FullBlurPreset = "360p" | "480p";

const FULLBLUR_PRESETS: Record<FullBlurPreset, { w: number; h: number; fps: number }> = {
  "360p": { w: 640, h: 360, fps: 24 },
  "480p": { w: 854, h: 480, fps: 24 },
};

function roomModeLabel(mode?: Room["mode"]) {
  return mode === "pair" ? "雙人專注" : "小組共工";
}

function getVideoTrack(p: any): MediaStreamTrack | null {
  const v = p?.tracks?.video;
  return v?.persistentTrack?.track || v?.track || null;
}

function getAudioTrack(p: any): MediaStreamTrack | null {
  const a = p?.tracks?.audio;
  return a?.persistentTrack?.track || a?.track || null;
}

function isTrackPlayable(trackInfo: any): boolean {
  if (!trackInfo) return false;
  const state = trackInfo.state;
  return state === "playable" || state === "loaded" || state === "interrupted" || !!trackInfo.track || !!trackInfo.persistentTrack?.track;
}

function getParticipantLabel(p: any, fallback: string): string {
  return p?.user_name || p?.userName || p?.user_id || p?.session_id || fallback;
}

function rosterDisplayName(profile: PublicProfileRow | null, userId: string) {
  return profile?.display_name?.trim() || `使用者 ${userId.slice(0, 8)}…`;
}

function rosterSecondaryLabel(profile: PublicProfileRow | null, userId: string) {
  if (profile?.handle) return `@${profile.handle}`;
  return `ID ${userId.slice(0, 8)}…`;
}

function buildReportHref(roomId: string, member: RosterMemberItem) {
  const label = member.profile?.handle
    ? `${rosterDisplayName(member.profile, member.user_id)} (@${member.profile.handle})`
    : rosterDisplayName(member.profile, member.user_id);

  const sp = new URLSearchParams({
    issue: "report-user",
    roomId,
    targetUserId: member.user_id,
    targetLabel: label,
  });

  return `/contact?${sp.toString()}`;
}

async function waitForVideoReady(el: HTMLVideoElement) {
  if (el.readyState >= 2 && el.videoWidth > 0 && el.videoHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("source video metadata load failed"));
    };
    const cleanup = () => {
      el.removeEventListener("loadedmetadata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("error", onError as any);
    };
    el.addEventListener("loadedmetadata", onReady, { once: true });
    el.addEventListener("canplay", onReady, { once: true });
    el.addEventListener("error", onError as any, { once: true });
    window.setTimeout(() => {
      cleanup();
      if (el.readyState >= 2 && el.videoWidth > 0 && el.videoHeight > 0) resolve();
      else reject(new Error("source video metadata timeout"));
    }, 3000);
  });
}

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

function CameraIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7A2.5 2.5 0 0 1 13.5 18h-7A2.5 2.5 0 0 1 4 15.5v-7Z" />
      <path d="m16 10 4-2.5v9L16 14" />
      {off ? <path d="M3.5 4.5 20 19" /> : null}
    </svg>
  );
}

function ExtendSessionNotice({
  tokenExp,
  tokenBusy,
  onRefresh,
}: {
  tokenExp: number;
  tokenBusy: boolean;
  onRefresh: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!tokenExp) {
      setSecondsLeft(0);
      return;
    }

    const sync = () => {
      const now = Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, tokenExp - now));
    };

    sync();
    const id = window.setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [tokenExp]);

  if (!tokenExp || secondsLeft <= 0 || secondsLeft > 120) {
    return null;
  }

  return (
    <div className="cc-alert cc-alert-warn cc-spread" style={{ flexWrap: "wrap" }}>
      <div>這一場快結束了，剩下 {secondsLeft} 秒。需要的話可以直接續下一場。</div>
      <button disabled={tokenBusy} onClick={onRefresh} className="cc-btn" type="button">
        續下一場
      </button>
    </div>
  );
}

function MediaTile({
  participant,
  isLocal,
}: {
  participant: any;
  isLocal: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoTrack = getVideoTrack(participant);
  const audioTrack = getAudioTrack(participant);
  const hasVideo = isTrackPlayable(participant?.tracks?.video) && !!videoTrack;
  const hasAudio = isTrackPlayable(participant?.tracks?.audio) && !!audioTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (hasVideo && videoTrack) {
      const ms = new MediaStream([videoTrack]);
      el.srcObject = ms;
      el.muted = true;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [hasVideo, videoTrack]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!isLocal && hasAudio && audioTrack) {
      const ms = new MediaStream([audioTrack]);
      el.srcObject = ms;
      el.muted = false;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [isLocal, hasAudio, audioTrack]);

  return (
    <div
      className="cc-card"
      style={{
        position: "relative",
        minHeight: 220,
        overflow: "hidden",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            minHeight: 220,
            objectFit: "cover",
            background: "#000",
            transform: isLocal ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <div
          style={{
            minHeight: 220,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            color: "rgba(255,255,255,0.75)",
            fontSize: 14,
          }}
        >
          {isLocal ? "你的鏡頭目前關閉" : "對方鏡頭目前關閉"}
        </div>
      )}

      {!isLocal && hasAudio && <audio ref={audioRef} autoPlay playsInline />}

      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.56)",
          color: "#fff",
          fontSize: 12,
          backdropFilter: "blur(8px)",
        }}
      >
        {getParticipantLabel(participant, isLocal ? "你" : "參與者")}
        {isLocal ? "（你）" : ""}
      </div>
    </div>
  );
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;

  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [room, setRoom] = useState<Room | null>(null);
  const [isMember, setIsMember] = useState(false);

  const [dailyToken, setDailyToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenExp, setTokenExp] = useState<number>(0);

  const [costCredits, setCostCredits] = useState<number>(1);
  const [monthlyAllowance, setMonthlyAllowance] = useState<number>(4);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [isVip, setIsVip] = useState<boolean>(false);
  const [pairVipCarry, setPairVipCarry] = useState<boolean>(false);

  const [runtimeCaps, setRuntimeCaps] = useState<{
    isMobile: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    supportsCanvasCaptureStream: boolean;
    supportsCanvasFilter: boolean;
  } | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("off");
  const [bgStrength, setBgStrength] = useState<number>(1);
  const [bgMsg, setBgMsg] = useState("");
  const [bgApplying, setBgApplying] = useState(false);

  const [fullBlurOn, setFullBlurOn] = useState(false);
  const [fullBlurPx, setFullBlurPx] = useState<number>(10);
  const [fullBlurPreset, setFullBlurPreset] = useState<FullBlurPreset>("360p");
  const [fullBlurApplying, setFullBlurApplying] = useState(false);
  const [fullBlurMsg, setFullBlurMsg] = useState("");

  // === ROSTER / SOCIAL ACTIONS ===
  const [rosterLoading, setRosterLoading] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMemberRow[]>([]);
  const [roomMemberProfiles, setRoomMemberProfiles] = useState<Record<string, PublicProfileRow>>({});
  const [incomingRoomRequests, setIncomingRoomRequests] = useState<FriendRequestRow[]>([]);
  const [outgoingRoomRequests, setOutgoingRoomRequests] = useState<FriendRequestRow[]>([]);
  const [roomFriendships, setRoomFriendships] = useState<FriendshipRow[]>([]);
  const [socialBusyUserId, setSocialBusyUserId] = useState("");
  const [inviteCopyMsg, setInviteCopyMsg] = useState("");
  // === END ROSTER / SOCIAL ACTIONS ===

  const dailyCallRef = useRef<any>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement | null>(null);
  const desktopPreviewRef = useRef<HTMLVideoElement | null>(null);
  const fullBlurPxRef = useRef<number>(10);
  const fullBlurOriginalVideoDeviceIdRef = useRef<string | null>(null);

  const fullBlurPipelineRef = useRef<null | {
    ownedSourceStream: MediaStream | null;
    sourceTrack: MediaStreamTrack;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    videoEl: HTMLVideoElement;
    outStream: MediaStream;
    outTrack: MediaStreamTrack;
    rafId: number;
  }>(null);

  const [dailyReady, setDailyReady] = useState(false);
  const [meetingState, setMeetingState] = useState("unknown");
  const [joinedMeeting, setJoinedMeeting] = useState(false);
  const [participantsMap, setParticipantsMap] = useState<Record<string, any>>({});
  const [localAudioOn, setLocalAudioOn] = useState(true);
  const [localVideoOn, setLocalVideoOn] = useState(true);
  const [audioToggleBusy, setAudioToggleBusy] = useState(false);
  const [videoToggleBusy, setVideoToggleBusy] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isAndroid = /Android/i.test(ua);
      const isIOS =
        /iPad|iPhone|iPod/i.test(ua) ||
        ((navigator as any).platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);

      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      const smallScreen = window.innerWidth <= 900;
      const isMobile = isAndroid || isIOS || (coarse && smallScreen);

      const supportsCanvasCaptureStream = typeof (HTMLCanvasElement.prototype as any).captureStream === "function";
      const supportsCanvasFilter = (() => {
        try {
          const c = document.createElement("canvas");
          const ctx = c.getContext("2d") as any;
          return !!ctx && "filter" in ctx;
        } catch {
          return false;
        }
      })();

      const caps = { isMobile, isIOS, isAndroid, supportsCanvasCaptureStream, supportsCanvasFilter };
      setRuntimeCaps(caps);
      console.log("[RoomPage] build:", __BUILD_TAG, "runtimeCaps:", caps);
    } catch {
      setRuntimeCaps({
        isMobile: false,
        isIOS: false,
        isAndroid: false,
        supportsCanvasCaptureStream: false,
        supportsCanvasFilter: false,
      });
    }
  }, []);

  const effectsMvpDisabled = runtimeCaps?.isMobile ?? false;

  useEffect(() => {
    fullBlurPxRef.current = fullBlurPx;
  }, [fullBlurPx]);

  useEffect(() => {
    if (!effectsMvpDisabled) return;
    setBgMode("off");
    setFullBlurOn(false);
    setBgMsg("這台裝置目前提供穩定通話，背景效果暫不提供。");
    setFullBlurMsg("這台裝置目前不提供全畫面模糊。");
  }, [effectsMvpDisabled]);

  const callUrl = useMemo(() => {
    if (!room?.daily_room_url || !dailyToken) return "";
    const sep = room.daily_room_url.includes("?") ? "&" : "?";
    return `${room.daily_room_url}${sep}t=${encodeURIComponent(dailyToken)}`;
  }, [room?.daily_room_url, dailyToken]);

  const canShowCall = useMemo(() => Boolean(room?.daily_room_url) && isMember && Boolean(dailyToken), [room?.daily_room_url, isMember, dailyToken]);

  const syncCallState = () => {
    const call = dailyCallRef.current;
    if (!call) return;
    try {
      const p = call.participants?.() || {};
      setParticipantsMap({ ...p });
      const ms = call.meetingState?.() || "unknown";
      setMeetingState(ms);
      const inferredJoined =
        ms === "joined-meeting" ||
        !!(p.local && (p.local.session_id || p.local.sessionId)) ||
        Object.keys(p).some((k) => k !== "local");
      setJoinedMeeting(inferredJoined);

      const localAudio = p.local?.tracks?.audio;
      const localVideo = p.local?.tracks?.video;

      setLocalAudioOn(isTrackPlayable(localAudio) && !(localAudio?.off || localAudio?.blocked?.byPermissions));
      setLocalVideoOn(isTrackPlayable(localVideo) && !(localVideo?.off || localVideo?.blocked?.byPermissions));
    } catch (e) {
      console.warn("[Daily] syncCallState failed:", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!canShowCall) return;
    if (effectsMvpDisabled) return;

    let pollId: any = null;
    let handlers: Array<[string, (...args: any[]) => void]> = [];

    (async () => {
      try {
        const mod = await import("@daily-co/daily-js");
        const Daily = ((mod as any).default ?? (mod as any)) as any;
        if (cancelled) return;

        const call = Daily.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        dailyCallRef.current = call;
        setDailyReady(true);

        const onAny = () => syncCallState();
        const onError = (ev: any) => console.warn("[Daily] error:", ev);
        const onNonfatal = (ev: any) => console.warn("[Daily] nonfatal-error:", ev);
        const onInputUpdated = (ev: any) => console.log("[Daily] input-settings-updated:", ev);
        const onCameraError = (ev: any) => console.warn("[Daily] camera-error:", ev);

        handlers = [
          ["loaded", onAny],
          ["joining-meeting", onAny],
          ["joined-meeting", onAny],
          ["left-meeting", onAny],
          ["participant-joined", onAny],
          ["participant-updated", onAny],
          ["participant-left", onAny],
          ["track-started", onAny],
          ["track-stopped", onAny],
          ["camera-error", onCameraError],
          ["nonfatal-error", onNonfatal],
          ["input-settings-updated", onInputUpdated],
          ["error", onError],
        ];

        handlers.forEach(([event, fn]) => call.on(event, fn));

        await call.join({
          url: room?.daily_room_url!,
          token: dailyToken,
          userName: email || "Cowork user",
          startAudioOff: false,
          startVideoOff: false,
        });

        syncCallState();

        pollId = window.setInterval(() => {
          if (cancelled) return;
          syncCallState();
        }, 1600);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Daily] desktop custom init failed:", e);
        setMsg((prev) => prev || e?.message || "目前無法啟動視訊，請稍後再試一次。");
      }
    })();

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      handlers.forEach(([event, fn]) => {
        try {
          dailyCallRef.current?.off?.(event, fn);
        } catch {}
      });
      void stopFullBlurPipeline();
      try {
        dailyCallRef.current?.leave?.();
      } catch {}
      try {
        dailyCallRef.current?.destroy?.();
      } catch {}
      dailyCallRef.current = null;
      setDailyReady(false);
      setJoinedMeeting(false);
      setMeetingState("unknown");
      setParticipantsMap({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShowCall, effectsMvpDisabled, room?.daily_room_url, dailyToken, email]);

  async function applyVideoProcessor(next?: { mode?: BgMode; strength?: number }) {
    const call = dailyCallRef.current;
    if (!call) return;
    if (effectsMvpDisabled) {
      setBgMsg("這台裝置目前不提供背景效果。");
      return;
    }
    if (!joinedMeeting) {
      setBgMsg("加入視訊後才能調整背景效果。");
      return;
    }
    if (fullBlurOn && (next?.mode ?? bgMode) !== "off") {
      setBgMsg("全畫面模糊啟用中，請先關閉後再使用背景模糊。");
      return;
    }

    const mode = next?.mode ?? bgMode;
    const strength = next?.strength ?? bgStrength;
    setBgApplying(true);
    setBgMsg("");

    try {
      if (mode === "off") {
        await call.updateInputSettings({
          video: { processor: { type: "none" } },
        });
      } else if (mode === "blur") {
        await call.updateInputSettings({
          video: {
            processor: {
              type: "background-blur",
              config: { strength: Math.max(0.01, Math.min(1, strength)) },
            },
          },
        });
      }
    } catch (e: any) {
      console.error("[Daily] updateInputSettings failed:", e);
      setBgMsg(e?.message || "背景效果設定失敗。");
    } finally {
      setBgApplying(false);
    }
  }

  async function startFullBlurPipeline() {
    const call = dailyCallRef.current as any;
    if (!call) return;

    if (effectsMvpDisabled) {
      setFullBlurMsg("這台裝置目前不提供全畫面模糊。");
      setFullBlurOn(false);
      return;
    }
    if (!joinedMeeting) {
      setFullBlurMsg("加入視訊後才能啟用全畫面模糊。");
      setFullBlurOn(false);
      return;
    }
    if (fullBlurPipelineRef.current) return;
    if (!runtimeCaps?.supportsCanvasCaptureStream || !runtimeCaps?.supportsCanvasFilter) {
      setFullBlurMsg("這個瀏覽器暫時不支援全畫面模糊。");
      setFullBlurOn(false);
      return;
    }

    setFullBlurApplying(true);
    setFullBlurMsg("");

    try {
      if (bgMode !== "off") {
        setBgMode("off");
        try {
          await call.updateInputSettings({ video: { processor: { type: "none" } } });
        } catch {}
      }

      try {
        const devs = await call.getInputDevices?.();
        const cam = devs?.camera;
        fullBlurOriginalVideoDeviceIdRef.current = cam?.deviceId ?? cam?.id ?? null;
      } catch {
        fullBlurOriginalVideoDeviceIdRef.current = null;
      }

      const preset = FULLBLUR_PRESETS[fullBlurPreset];
      let ownedSourceStream: MediaStream | null = null;
      let sourceTrack: MediaStreamTrack | null = null;

      ownedSourceStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: preset.w },
          height: { ideal: preset.h },
          frameRate: { ideal: preset.fps, max: preset.fps },
        },
        audio: false,
      });
      sourceTrack = ownedSourceStream.getVideoTracks()[0] || null;

      if (!sourceTrack) throw new Error("拿不到可用的本地 camera track。");

      const videoEl = document.createElement("video");
      videoEl.muted = true;
      (videoEl as any).playsInline = true;
      videoEl.autoplay = true;
      videoEl.srcObject = new MediaStream([sourceTrack]);
      await videoEl.play();
      await waitForVideoReady(videoEl);

      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || preset.w;
      canvas.height = videoEl.videoHeight || preset.h;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context init failed");

      const outStream = canvas.captureStream(preset.fps);
      const outTrack = outStream.getVideoTracks()[0];
      if (!outTrack) throw new Error("canvas.captureStream 沒產生 video track");

      let rafId = 0;
      const draw = () => {
        const px = fullBlurPxRef.current ?? 10;
        ctx.save();
        try {
          (ctx as any).filter = px > 0 ? `blur(${px}px)` : "none";
        } catch {}
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        try {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        } catch {}
        ctx.restore();
        rafId = requestAnimationFrame(draw);
      };
      draw();

      fullBlurPipelineRef.current = {
        ownedSourceStream,
        sourceTrack,
        canvas,
        ctx,
        videoEl,
        outStream,
        outTrack,
        rafId,
      };

      if (desktopPreviewRef.current) {
        desktopPreviewRef.current.srcObject = outStream;
        desktopPreviewRef.current.muted = true;
        void desktopPreviewRef.current.play().catch(() => {});
      }

      try {
        await call.updateInputSettings({ video: { processor: { type: "none" } } });
      } catch {}

      let switched = false;
      try {
        if (call.setInputDevicesAsync) {
          await call.setInputDevicesAsync({ videoSource: outTrack });
          switched = true;
        }
      } catch (e) {
        console.warn("[FullBlur] setInputDevicesAsync(videoSource) failed:", e);
      }

      if (!switched) {
        try {
          await call.updateInputSettings({
            video: {
              settings: { customTrack: outTrack },
              processor: { type: "none" },
            },
          });
          switched = true;
        } catch (e) {
          console.warn("[FullBlur] customTrack fallback failed:", e);
        }
      }

      if (!switched) throw new Error("目前無法把全畫面模糊套用到輸出畫面。");
    } catch (e: any) {
      console.error("[FullBlur] start failed:", e);
      setFullBlurMsg(e?.message || "全畫面模糊啟用失敗。");
      setFullBlurOn(false);
      await stopFullBlurPipeline();
    } finally {
      setFullBlurApplying(false);
    }
  }

  async function stopFullBlurPipeline() {
    const call = dailyCallRef.current as any;
    const p = fullBlurPipelineRef.current;
    fullBlurPipelineRef.current = null;

    if (desktopPreviewRef.current) {
      desktopPreviewRef.current.srcObject = null;
    }

    if (p) {
      try {
        cancelAnimationFrame(p.rafId);
      } catch {}
      try {
        p.videoEl.pause();
      } catch {}
      try {
        p.outStream.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        p.ownedSourceStream?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      try {
        (p.videoEl as any).srcObject = null;
      } catch {}
    }

    if (!call) return;

    try {
      await call.updateInputSettings({ video: { processor: { type: "none" }, settings: {} } });
    } catch {}

    try {
      const originalId = fullBlurOriginalVideoDeviceIdRef.current;
      if (call.setInputDevicesAsync) {
        await call.setInputDevicesAsync({ videoDeviceId: originalId || null });
      }
    } catch (e) {
      console.warn("[FullBlur] restore camera failed:", e);
    }
  }

  useEffect(() => {
    if (effectsMvpDisabled) return;
    if (!dailyReady) return;
    if (!joinedMeeting) return;
    void applyVideoProcessor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyReady, joinedMeeting, bgMode, bgStrength, effectsMvpDisabled]);

  useEffect(() => {
    if (effectsMvpDisabled) {
      void stopFullBlurPipeline();
      return;
    }
    if (!dailyReady || !joinedMeeting) {
      void stopFullBlurPipeline();
      return;
    }

    if (fullBlurOn) {
      void startFullBlurPipeline();
    } else {
      void stopFullBlurPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyReady, joinedMeeting, fullBlurOn, fullBlurPreset, effectsMvpDisabled]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!roomId) return;

      const session = await getClientSessionSnapshot();
      if (!session) {
        router.replace("/auth/login");
        return;
      }

      if (cancelled) return;
      setUid(session.user.id);
      setEmail(session.email);
      setAccessToken(session.accessToken ?? "");

      const [roomResult, memberResult] = await Promise.all([
        supabase
          .from("rooms")
          .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url,visibility,invite_code")
          .eq("id", roomId)
          .single(),
        supabase
          .from("room_members")
          .select("room_id,user_id")
          .eq("room_id", roomId)
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (roomResult.error) {
        setMsg(roomResult.error.message);
        setChecking(false);
        return;
      }

      if (memberResult.error) {
        setMsg(memberResult.error.message);
      }

      setRoom(roomResult.data as Room);
      setIsMember(Boolean(memberResult.data));
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, roomId]);

  async function refreshRoom() {
    if (!roomId) return;
    const [roomResult, session] = await Promise.all([
      supabase
        .from("rooms")
        .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url,visibility,invite_code")
        .eq("id", roomId)
        .single(),
      getClientSessionSnapshot(),
    ]);

    if (roomResult.error) return setMsg(roomResult.error.message);
    setRoom(roomResult.data as Room);

    if (session?.accessToken) {
      setAccessToken(session.accessToken);
      try {
        const nextStatus = await fetchAccountStatus(session.accessToken, { force: true });
        setIsVip(Boolean(nextStatus.is_vip));
        setRemainingCredits(nextStatus.credits_remaining ?? null);
        setMonthlyAllowance(nextStatus.free_monthly_allowance ?? 4);
      } catch {}
    }
  }

  async function copyInviteCode() {
    const code = room?.invite_code?.trim();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setInviteCopyMsg("邀請碼已複製");
      window.setTimeout(() => setInviteCopyMsg(""), 1800);
    } catch {
      setInviteCopyMsg("複製失敗，請手動抄錄");
      window.setTimeout(() => setInviteCopyMsg(""), 2200);
    }
  }

  // === ROSTER / SOCIAL ACTIONS ===
  async function loadRoomRoster(nextRoom: Room | null, currentUserId: string) {
    if (!roomId || !nextRoom || !currentUserId || !accessToken) return;

    setRosterLoading(true);

    try {
      const resp = await fetch("/api/rooms/roster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId }),
      });

      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        throw new Error(json?.error || "房內名單讀取失敗。");
      }

      const memberRows = ((json?.members ?? []) as RoomMemberRow[]);
      const profileMap = Object.fromEntries(
        (((json?.profiles ?? []) as PublicProfileRow[])).map((item) => [item.user_id, item]),
      );
      const incomingRows = ((json?.incoming_requests ?? []) as FriendRequestRow[]);
      const outgoingRows = ((json?.outgoing_requests ?? []) as FriendRequestRow[]);
      const friendshipRows = ((json?.friendships ?? []) as FriendshipRow[]);

      setRoomMembers(memberRows);
      setRoomMemberProfiles(profileMap);
      setIncomingRoomRequests(incomingRows);
      setOutgoingRoomRequests(outgoingRows);
      setRoomFriendships(friendshipRows);
    } catch (error: any) {
      console.error("[RoomRoster] load failed:", error);
      setMsg((prev) => prev || error?.message || "房內名單讀取失敗。");
      setRoomMembers([]);
      setRoomMemberProfiles({});
      setIncomingRoomRequests([]);
      setOutgoingRoomRequests([]);
      setRoomFriendships([]);
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    if (!room || !uid || !isMember) {
      setRoomMembers([]);
      setRoomMemberProfiles({});
      setIncomingRoomRequests([]);
      setOutgoingRoomRequests([]);
      setRoomFriendships([]);
      setRosterLoading(false);
      return;
    }
    void loadRoomRoster(room, uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.created_by, uid, isMember, accessToken]);

  async function sendFriendRequestFromRoom(targetUserId: string, targetLabel: string) {
    if (!uid || !targetUserId || uid === targetUserId) return;
    setSocialBusyUserId(targetUserId);
    setMsg("");

    try {
      const existingResult = await supabase
        .from("friend_requests")
        .select("*")
        .or(
          `and(requester_user_id.eq.${uid},addressee_user_id.eq.${targetUserId}),and(requester_user_id.eq.${targetUserId},addressee_user_id.eq.${uid})`,
        )
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingResult.error) throw existingResult.error;

      const existing = (existingResult.data ?? [])[0] as FriendRequestRow | undefined;
      if (existing?.status === "pending") {
        setMsg(
          existing.requester_user_id === uid
            ? "你已經送出過好友邀請了。"
            : "對方已先送出邀請，請直接點接受好友。",
        );
        return;
      }

      const alreadyFriend = roomFriendships.some((item) => {
        const otherId = item.user_low === uid ? item.user_high : item.user_low;
        return otherId === targetUserId;
      });

      if (alreadyFriend) {
        setMsg("你們已經是好友。");
        return;
      }

      const insertResult = await supabase.from("friend_requests").insert({
        requester_user_id: uid,
        addressee_user_id: targetUserId,
        status: "pending",
      });

      if (insertResult.error) throw insertResult.error;

      setMsg(`已送出好友邀請給 ${targetLabel}。`);
      await loadRoomRoster(room, uid);
    } catch (error: any) {
      setMsg(error?.message || "送出好友邀請失敗。");
    } finally {
      setSocialBusyUserId("");
    }
  }

  async function acceptFriendRequestFromRoom(request: FriendRequestRow) {
    if (!uid) return;
    setSocialBusyUserId(request.requester_user_id);
    setMsg("");

    try {
      const pair = sortFriendPair(request.requester_user_id, request.addressee_user_id);

      const [updateResult, friendshipResult] = await Promise.all([
        supabase.from("friend_requests").update({ status: "accepted" }).eq("id", request.id),
        supabase.from("friendships").upsert(pair, { onConflict: "user_low,user_high" }),
      ]);

      if (updateResult.error) throw updateResult.error;
      if (friendshipResult.error) throw friendshipResult.error;

      setMsg("已加入好友。");
      await loadRoomRoster(room, uid);
    } catch (error: any) {
      setMsg(error?.message || "接受好友邀請失敗。");
    } finally {
      setSocialBusyUserId("");
    }
  }
  // === END ROSTER / SOCIAL ACTIONS ===

  async function join() {
    if (!roomId) return;
    setBusy(true);
    setMsg("");

    const session = uid ? null : await getClientSessionSnapshot();
    const userId = uid || session?.user.id;
    if (!userId) {
      setBusy(false);
      router.replace("/auth/login");
      return;
    }

    const { error } = await supabase
      .from("room_members")
      .upsert({ room_id: roomId, user_id: userId }, { onConflict: "room_id,user_id" });

    setBusy(false);
    if (error) return setMsg(error.message);
    setIsMember(true);
  }

  async function leave() {
    if (!roomId) return;
    setBusy(true);
    setMsg("");

    try {
      await stopFullBlurPipeline();
    } catch {}

    try {
      await dailyCallRef.current?.leave?.();
    } catch {}

    const session = uid ? null : await getClientSessionSnapshot();
    const userId = uid || session?.user.id;
    if (!userId) {
      setBusy(false);
      router.replace("/auth/login");
      return;
    }

    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    setBusy(false);
    if (error) return setMsg(error.message);

    setIsMember(false);
    setDailyToken("");
    setTokenExp(0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/auth/login");
  }

  async function createDailyRoom() {
    if (!roomId || !room) return;
    setBusy(true);
    setMsg("");

    if (room.created_by !== uid) {
      setBusy(false);
      return setMsg("目前只有房主可以開啟視訊房間。");
    }

    const dailyName = `cowork_${roomId.replaceAll("-", "")}`;

    const resp = await fetch("/api/daily/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: dailyName }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setBusy(false);
      return setMsg((json as any)?.error ?? "建立視訊房間失敗");
    }

    const url = (json as any)?.url as string | undefined;
    if (!url) {
      setBusy(false);
      return setMsg("目前還無法取得視訊房間連結，請稍後再試。");
    }

    const { error } = await supabase.from("rooms").update({ daily_room_url: url }).eq("id", roomId);

    setBusy(false);
    if (error) return setMsg(error.message);
    await refreshRoom();
  }

  async function fetchMeetingToken() {
    if (!roomId) return;

    setTokenBusy(true);
    setMsg("");

    let bearer = accessToken;
    if (!bearer) {
      const session = await getClientSessionSnapshot({ force: true });
      bearer = session?.accessToken ?? "";
      if (bearer) setAccessToken(bearer);
    }

    if (!bearer) {
      setTokenBusy(false);
      return setMsg("登入狀態已過期，請重新登入後再試一次。");
    }

    const resp = await fetch("/api/daily/meeting-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ roomId }),
    });

    const json = (await resp.json().catch(() => ({}))) as any;

    if (!resp.ok) {
      if (resp.status === 402) {
        setDailyToken("");
        setTokenExp(0);
        setTokenBusy(false);
        return setMsg("本月免費額度已用完，可升級 VIP 或等下月重置後再使用。");
      }

      setTokenBusy(false);
      return setMsg(json?.error ?? "目前無法進入視訊，請稍後再試。");
    }

    const tr = json as TokenResp;
    setDailyToken(tr.token || "");
    setTokenExp(tr.exp || 0);

    setCostCredits(tr.cost_credits ?? 1);
    setMonthlyAllowance(tr.free_monthly_allowance ?? 4);
    setRemainingCredits(tr.remaining_credits ?? null);
    setIsVip(Boolean(tr.is_vip));
    setPairVipCarry(Boolean(tr.allowed_by_pair_vip_carry));
    setTokenBusy(false);
  }

  useEffect(() => {
    if (!roomId || !isMember || !room?.daily_room_url) {
      setDailyToken("");
      setTokenExp(0);
      return;
    }
    if (!dailyToken) void fetchMeetingToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isMember, room?.daily_room_url]);

  async function toggleLocalAudio() {
    const call = dailyCallRef.current;
    if (!call) return;
    setAudioToggleBusy(true);
    setMsg("");
    try {
      await call.setLocalAudio(!localAudioOn);
      window.setTimeout(() => syncCallState(), 120);
    } catch (e: any) {
      setMsg(e?.message || "切換麥克風失敗");
    } finally {
      setAudioToggleBusy(false);
    }
  }

  async function toggleLocalVideo() {
    const call = dailyCallRef.current;
    if (!call) return;
    setVideoToggleBusy(true);
    setMsg("");
    try {
      await call.setLocalVideo(!localVideoOn);
      window.setTimeout(() => syncCallState(), 120);
    } catch (e: any) {
      setMsg(e?.message || "切換鏡頭失敗");
    } finally {
      setVideoToggleBusy(false);
    }
  }

  const participantList = useMemo(() => {
    const entries = Object.entries(participantsMap || {});
    return entries.sort(([a], [b]) => {
      if (a === "local") return -1;
      if (b === "local") return 1;
      return 0;
    });
  }, [participantsMap]);

  // === ROSTER / SOCIAL ACTIONS ===
  const rosterMembers = useMemo<RosterMemberItem[]>(() => {
    if (!room || !uid) return [];

    const ids = Array.from(
      new Set([
        ...roomMembers.map((item) => item.user_id),
        room.created_by,
        ...(isMember ? [uid] : []),
      ]),
    );

    return ids
      .map((memberId) => {
        const incomingRequest =
          incomingRoomRequests.find((item) => item.requester_user_id === memberId) ?? null;
        const outgoingRequest =
          outgoingRoomRequests.find((item) => item.addressee_user_id === memberId) ?? null;
        const isFriend = roomFriendships.some((item) => {
          const otherId = item.user_low === uid ? item.user_high : item.user_low;
          return otherId === memberId;
        });

        return {
          user_id: memberId,
          profile: roomMemberProfiles[memberId] ?? null,
          is_owner: room.created_by === memberId,
          is_self: uid === memberId,
          is_friend: isFriend,
          incoming_request: incomingRequest,
          outgoing_request: outgoingRequest,
        };
      })
      .sort((a, b) => {
        if (a.is_self && !b.is_self) return -1;
        if (b.is_self && !a.is_self) return 1;
        if (a.is_owner && !b.is_owner) return -1;
        if (b.is_owner && !a.is_owner) return 1;
        return rosterDisplayName(a.profile, a.user_id).localeCompare(rosterDisplayName(b.profile, b.user_id), "zh-Hant");
      });
  }, [room, uid, roomMembers, roomMemberProfiles, incomingRoomRequests, outgoingRoomRequests, roomFriendships, isMember]);
  // === END ROSTER / SOCIAL ACTIONS ===

  const connectionLabel = joinedMeeting
    ? "已連線"
    : meetingState === "joining-meeting"
    ? "連線中"
    : "準備中";

  if (!roomId) {
    return (
      <main className="cc-container">
        <section className="cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在準備房間資訊</div>
            <div className="cc-muted">稍後會帶你進入正確的房間。</div>
          </div>
        </section>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="cc-container">
        <section className="cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在檢查房間資訊</div>
            <div className="cc-muted">請稍等，系統正在確認你的登入狀態與房間權限。</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cc-container">
      <section className="cc-card cc-stack-lg">
        <div className="cc-page-header">
          <div className="cc-stack-sm">
            <div className="cc-row" style={{ flexWrap: "wrap" }}>
              <Link href="/rooms" className="cc-btn-link">
                ← 回到 Rooms
              </Link>
              <span className="cc-pill-soft">{effectsMvpDisabled ? "行動裝置" : "桌機"}</span>
            </div>
            <h1 className="cc-h2" style={{ fontSize: "clamp(1.7rem, 3vw, 2.8rem)" }}>{room?.title ?? "Room"}</h1>
            {room ? (
              <div className="cc-page-meta">
                <span className="cc-pill-soft">{roomModeLabel(room.mode)}</span>
                <span className="cc-pill-soft">{room.duration_minutes} 分鐘</span>
                <span className="cc-pill-soft">最多 {room.max_size} 人</span>
              </div>
            ) : null}
          </div>

          <div className="cc-navmeta">
            {email ? <span className="cc-pill-soft">{email}</span> : null}
            <Link href="/account" className="cc-btn">方案 / 額度</Link>
            <button onClick={signOut} className="cc-btn" type="button">登出</button>
          </div>
        </div>

        <div className="cc-room-status">
          {isVip ? (
            <div className="cc-note">
              <strong>VIP：</strong> 這一場可持續續場，不受每月場次限制。
            </div>
          ) : pairVipCarry ? (
            <div className="cc-note">
              <strong>續場支援：</strong> 房內有 VIP 使用者時，這一場仍可繼續續場。
            </div>
          ) : (
            <div className="cc-note">
              <strong>本場資訊：</strong> 本場會消耗 {costCredits} 場；目前剩餘 {remainingCredits ?? "?"}/{monthlyAllowance} 場。
            </div>
          )}
        </div>

        <div className="cc-action-row">
          {!isMember ? (
            <button disabled={busy} onClick={join} className="cc-btn-primary" type="button">
              加入房間
            </button>
          ) : (
            <button disabled={busy} onClick={leave} className="cc-btn" type="button">
              離開房間
            </button>
          )}

          <button disabled={busy} onClick={refreshRoom} className="cc-btn" type="button">
            重新整理
          </button>

          {room?.daily_room_url ? (
            <span className="cc-pill-success">視訊已開啟</span>
          ) : room?.created_by === uid ? (
            <button disabled={busy} onClick={createDailyRoom} className="cc-btn" type="button">
              開啟視訊
            </button>
          ) : (
            <span className="cc-pill-soft">等待房主開啟視訊</span>
          )}

          {isMember && room?.daily_room_url ? (
            <button disabled={tokenBusy} onClick={fetchMeetingToken} className="cc-btn" type="button">
              重新連線
            </button>
          ) : null}
        </div>

        {isMember && room?.visibility === "invited" && room?.created_by === uid && room?.invite_code ? (
          <div className="cc-note cc-stack-sm">
            <div className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="cc-stack-sm" style={{ minWidth: 0 }}>
                <div className="cc-h3">邀請制房間邀請碼</div>
                <div className="cc-caption" style={{ lineHeight: 1.7 }}>
                  這組邀請碼會一直保留在房內頁，不需要在建房成功那一瞬間硬記。
                </div>
              </div>
              <span className="cc-pill-accent">{labelForVisibility(room.visibility)}</span>
            </div>
            <div className="cc-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div className="cc-h2" style={{ letterSpacing: "0.08em" }}>{room.invite_code}</div>
              <div className="cc-action-row" style={{ marginTop: 0 }}>
                <button type="button" className="cc-btn-primary" onClick={copyInviteCode}>
                  複製邀請碼
                </button>
                {inviteCopyMsg ? <span className="cc-pill-success">{inviteCopyMsg}</span> : null}
              </div>
            </div>
          </div>
        ) : null}

        {msg ? <div className="cc-alert cc-alert-error">{msg}</div> : null}

        <ExtendSessionNotice tokenExp={tokenExp} tokenBusy={tokenBusy} onRefresh={fetchMeetingToken} />
      </section>

      <section className="cc-card cc-stack-md" style={{ marginTop: 18 }}>
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">房內名單</p>
            <h2 className="cc-h2">先把房內名單、加好友與檢舉入口補齊。</h2>
          </div>
          <span className="cc-pill-soft">{rosterMembers.length} people</span>
        </div>

        {!isMember ? (
          <div className="cc-note">先加入房間後，才會顯示房內名單與社交操作。</div>
        ) : rosterLoading ? (
          <div className="cc-note">正在整理房內名單…</div>
        ) : rosterMembers.length === 0 ? (
          <div className="cc-note">目前還沒有可顯示的房內名單資料。</div>
        ) : (
          <div className="cc-grid-2" style={{ gap: 14 }}>
            {rosterMembers.map((member) => {
              const displayName = rosterDisplayName(member.profile, member.user_id);
              const secondaryLabel = rosterSecondaryLabel(member.profile, member.user_id);
              const reportHref = buildReportHref(roomId, member);
              const socialBusy = socialBusyUserId === member.user_id;

              return (
                <article key={member.user_id} className="cc-card cc-card-soft cc-stack-sm">
                  <div className="cc-card-row" style={{ alignItems: "flex-start" }}>
                    <div className="cc-stack-sm" style={{ minWidth: 0 }}>
                      <div className="cc-h3">{displayName}</div>
                      <div className="cc-caption">{secondaryLabel}</div>
                    </div>

                    <div className="cc-action-row" style={{ marginTop: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {member.is_owner ? <span className="cc-pill-accent">房主</span> : null}
                      {member.is_self ? <span className="cc-pill-success">你</span> : null}
                    </div>
                  </div>

                  {member.profile?.bio ? (
                    <div className="cc-muted" style={{ lineHeight: 1.75 }}>
                      {member.profile.bio}
                    </div>
                  ) : (
                    <div className="cc-caption">
                      這位使用者目前沒有公開更多介紹；先把最小信任與最小治理入口補齊。
                    </div>
                  )}

                  {member.profile?.tags?.length ? (
                    <div className="cc-caption">{tagsToInput(member.profile.tags)}</div>
                  ) : null}

                  <div className="cc-action-row" style={{ flexWrap: "wrap" }}>
                    {member.profile?.handle ? (
                      <Link href={`/u/${member.profile.handle}`} className="cc-btn">
                        查看檔案
                      </Link>
                    ) : null}

                    {!member.is_self && member.is_friend ? (
                      <span className="cc-pill-success">已是好友</span>
                    ) : null}

                    {!member.is_self && !member.is_friend && member.incoming_request ? (
                      <button
                        className="cc-btn-primary"
                        type="button"
                        disabled={socialBusy}
                        onClick={() => void acceptFriendRequestFromRoom(member.incoming_request!)}
                      >
                        {socialBusy ? "處理中…" : "接受好友"}
                      </button>
                    ) : null}

                    {!member.is_self && !member.is_friend && !member.incoming_request && member.outgoing_request ? (
                      <span className="cc-pill-soft">已送出邀請</span>
                    ) : null}

                    {!member.is_self && !member.is_friend && !member.incoming_request && !member.outgoing_request ? (
                      <button
                        className="cc-btn"
                        type="button"
                        disabled={socialBusy}
                        onClick={() => void sendFriendRequestFromRoom(member.user_id, displayName)}
                      >
                        {socialBusy ? "送出中…" : "加好友"}
                      </button>
                    ) : null}

                    {!member.is_self ? (
                      <Link href={reportHref} className="cc-btn">
                        檢舉
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <hr className="cc-soft-divider" />

      <section className="cc-card cc-stack-md">
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">視訊空間</p>
            <h2 className="cc-h2">{effectsMvpDisabled ? "行動裝置視訊" : "桌機視訊"}</h2>
          </div>
          <span className="cc-pill-soft">{connectionLabel}</span>
        </div>

        {!isMember ? (
          <div className="cc-note">先加入房間後，這裡才會顯示視訊內容。</div>
        ) : null}

        {isMember && !room?.daily_room_url ? (
          <div className="cc-note">
            {room?.created_by === uid ? "視訊還沒開啟，點上方的「開啟視訊」即可開始。" : "房主尚未開啟視訊，請稍後再試。"}
          </div>
        ) : null}

        {isMember && room?.daily_room_url && !dailyToken ? (
          <div className="cc-note">
            {tokenBusy ? "正在準備進入視訊…" : "目前正在確認進房資格，請稍後。"}
          </div>
        ) : null}

        {canShowCall && effectsMvpDisabled ? (
          <div className="cc-stack-md">
            <div className="cc-panel cc-stack-sm">
              <div className="cc-h3">穩定通話模式</div>
              <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                為了讓這台裝置的通話更穩定，背景效果暫時不提供；基本音訊與視訊功能可正常使用。
              </div>
            </div>

            <iframe
              ref={mobileIframeRef}
              src={callUrl}
              style={{ width: "100%", height: "70vh", border: 0, borderRadius: 20 }}
              allow="microphone; camera; autoplay; display-capture"
            />
          </div>
        ) : null}

        {canShowCall && !effectsMvpDisabled ? (
          <div className="cc-stack-md">
            <div className="cc-panel cc-stack-sm">
              <div className="cc-card-row">
                <div>
                  <div className="cc-h3">鏡頭與麥克風</div>
                  <div className="cc-caption">加入視訊後，你可以在這裡快速切換自己的裝置狀態。</div>
                </div>
                <div className="cc-action-row" style={{ marginTop: 0 }}>
                  <button
                    className={`cc-icon-toggle ${localAudioOn ? "is-on" : "is-off"}`}
                    onClick={toggleLocalAudio}
                    disabled={!dailyReady || audioToggleBusy}
                    aria-pressed={localAudioOn}
                    aria-label={audioToggleBusy ? "麥克風切換中" : localAudioOn ? "麥克風已開啟，點擊關閉" : "麥克風已關閉，點擊開啟"}
                    title={audioToggleBusy ? "麥克風切換中" : localAudioOn ? "麥克風已開啟" : "麥克風已關閉"}
                    type="button"
                  >
                    <span className="cc-icon-toggle__badge" aria-hidden="true" />
                    <span className="cc-icon-toggle__icon" aria-hidden="true">
                      <MicIcon off={!localAudioOn} />
                    </span>
                  </button>
                  <button
                    className={`cc-icon-toggle ${localVideoOn ? "is-on" : "is-off"}`}
                    onClick={toggleLocalVideo}
                    disabled={!dailyReady || videoToggleBusy}
                    aria-pressed={localVideoOn}
                    aria-label={videoToggleBusy ? "鏡頭切換中" : localVideoOn ? "鏡頭已開啟，點擊關閉" : "鏡頭已關閉，點擊開啟"}
                    title={videoToggleBusy ? "鏡頭切換中" : localVideoOn ? "鏡頭已開啟" : "鏡頭已關閉"}
                    type="button"
                  >
                    <span className="cc-icon-toggle__badge" aria-hidden="true" />
                    <span className="cc-icon-toggle__icon" aria-hidden="true">
                      <CameraIcon off={!localVideoOn} />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="cc-grid-2">
              <div className="cc-panel cc-stack-sm">
                <div className="cc-field">
                  <div className="cc-h3">背景效果</div>
                  <span className="cc-field-label">桌機可選擇保留原畫面，或僅對背景做柔和模糊。</span>
                </div>
                <select
                  className="cc-select"
                  value={bgMode}
                  onChange={(e) => setBgMode(e.target.value as BgMode)}
                  disabled={!dailyReady || !joinedMeeting || bgApplying || fullBlurOn}
                >
                  <option value="off">關閉</option>
                  <option value="blur">背景模糊</option>
                </select>

                {bgMode === "blur" ? (
                  <label className="cc-field">
                    <span className="cc-field-label">模糊強度</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={bgStrength}
                      onChange={(e) => setBgStrength(Number(e.target.value))}
                      disabled={!dailyReady || !joinedMeeting || bgApplying || fullBlurOn}
                    />
                  </label>
                ) : null}

                <div className="cc-caption">
                  {!dailyReady ? "載入中…" : !joinedMeeting ? "加入視訊後可調整" : "背景模糊僅在桌機提供"}
                </div>
              </div>

              <div className="cc-panel cc-stack-sm">
                <div className="cc-h3">全畫面模糊</div>
                <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={fullBlurOn}
                    onChange={(e) => setFullBlurOn(e.target.checked)}
                    disabled={!dailyReady || !joinedMeeting || fullBlurApplying}
                  />
                  <span className="cc-field-label">啟用後，遠端看到的畫面也會一併變柔和。</span>
                </label>

                <label className="cc-field">
                  <span className="cc-field-label">解析度</span>
                  <select
                    className="cc-select"
                    value={fullBlurPreset}
                    onChange={(e) => setFullBlurPreset(e.target.value as FullBlurPreset)}
                    disabled={!dailyReady || !joinedMeeting || fullBlurApplying || fullBlurOn}
                  >
                    {Object.entries(FULLBLUR_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {k}（{v.w}×{v.h} @{v.fps}fps）
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cc-field">
                  <span className="cc-field-label">模糊(px)：{fullBlurPx}</span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={fullBlurPx}
                    onChange={(e) => setFullBlurPx(Number(e.target.value))}
                    disabled={!dailyReady || !joinedMeeting || fullBlurApplying}
                  />
                </label>

                <div className="cc-caption">
                  {!dailyReady
                    ? "載入中…"
                    : !joinedMeeting
                    ? "加入視訊後可調整"
                    : fullBlurApplying
                    ? "切換中…"
                    : "啟用時右上角會顯示效果預覽"}
                </div>
              </div>
            </div>

            {bgMsg ? <div className="cc-danger">{bgMsg}</div> : null}
            {fullBlurMsg ? <div className="cc-danger">{fullBlurMsg}</div> : null}

            <video
              ref={desktopPreviewRef}
              style={{
                position: "fixed",
                top: 12,
                right: 12,
                width: 220,
                height: 124,
                borderRadius: 16,
                border: "1px solid var(--cc-border-strong)",
                background: "rgba(0,0,0,0.45)",
                display: fullBlurOn ? "block" : "none",
                zIndex: 9999,
                boxShadow: "var(--cc-shadow-md)",
              }}
              autoPlay
              muted
              playsInline
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: participantList.length <= 1 ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {participantList.length === 0 ? (
                <div className="cc-card cc-empty-state">正在連線，請稍等一下…</div>
              ) : (
                participantList.map(([id, participant]) => (
                  <MediaTile key={id} participant={participant} isLocal={id === "local"} />
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
