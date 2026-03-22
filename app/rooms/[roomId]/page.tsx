// app/rooms/[roomId]/page.tsx
// Desktop: custom Daily call object for reliable outgoing full-blur.
// Mobile/Tablet: keep Daily Prebuilt and disable all blur / virtual background / full-blur.
//
// Source of truth:
// - Same Supabase / token / entitlement / room membership flow.
// - Do NOT change server-side token security or billing rules here.

"use client";

const __BUILD_TAG = "ROOMS_DESKTOP_CUSTOM_MOBILE_PREBUILT_V1_20260319";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Room = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
  created_by: string;
  daily_room_url?: string | null;
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

type BgMode = "off" | "blur" | "image";
type FullBlurPreset = "360p" | "480p";

const FULLBLUR_PRESETS: Record<FullBlurPreset, { w: number; h: number; fps: number }> = {
  "360p": { w: 640, h: 360, fps: 24 },
  "480p": { w: 854, h: 480, fps: 24 },
};

const VB_PRESETS: Array<{ id: string; label: string; source: string }> = [
  {
    id: "warm-gray",
    label: "暖灰",
    source:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8AAAAMBAQAYKGiGAAAAAElFTkSuQmCC",
  },
  {
    id: "soft-blue",
    label: "柔藍",
    source:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mMAgtwAAAQBAUeSOdYAAAAASUVORK5CYII=",
  },
  {
    id: "soft-pink",
    label: "柔粉",
    source:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mNg+M8AAAICAQB7CYF4AAAAAElFTkSuQmCC",
  },
];

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
  const [bgPreset, setBgPreset] = useState<string>(VB_PRESETS[0]?.id || "warm-gray");
  const [bgStrength, setBgStrength] = useState<number>(1);
  const [bgMsg, setBgMsg] = useState("");
  const [bgApplying, setBgApplying] = useState(false);

  const [fullBlurOn, setFullBlurOn] = useState(false);
  const [fullBlurPx, setFullBlurPx] = useState<number>(10);
  const [fullBlurPreset, setFullBlurPreset] = useState<FullBlurPreset>("360p");
  const [fullBlurApplying, setFullBlurApplying] = useState(false);
  const [fullBlurMsg, setFullBlurMsg] = useState("");

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
    setBgMsg("手機/平板（MVP）禁用背景模糊、虛擬背景、全畫面模糊。");
    setFullBlurMsg("手機/平板（MVP）禁用全畫面模糊。");
  }, [effectsMvpDisabled]);

  const callUrl = useMemo(() => {
    if (!room?.daily_room_url || !dailyToken) return "";
    const sep = room.daily_room_url.includes("?") ? "&" : "?";
    return `${room.daily_room_url}${sep}t=${encodeURIComponent(dailyToken)}`;
  }, [room?.daily_room_url, dailyToken]);

  const canShowCall = useMemo(() => Boolean(room?.daily_room_url) && isMember && Boolean(dailyToken), [room?.daily_room_url, isMember, dailyToken]);

  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const t = setInterval(() => {
      if (!tokenExp) return setSecondsLeft(0);
      const now = Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, tokenExp - now));
    }, 1000);
    return () => clearInterval(t);
  }, [tokenExp]);

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

      setLocalAudioOn(!(localAudio?.off || localAudio?.blocked?.byPermissions));
      setLocalVideoOn(!(localVideo?.off || localVideo?.blocked?.byPermissions));
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

        try {
          console.log("[Daily] supportedBrowser:", Daily.supportedBrowser?.());
        } catch {}

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
        }, 1200);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Daily] desktop custom init failed:", e);
        setMsg((prev) => prev || e?.message || "桌機自訂視訊初始化失敗");
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

  async function applyVideoProcessor(next?: { mode?: BgMode; preset?: string; strength?: number }) {
    const call = dailyCallRef.current;
    if (!call) return;
    if (effectsMvpDisabled) {
      setBgMsg("手機/平板（MVP）禁用模糊功能。");
      return;
    }
    if (!joinedMeeting) {
      setBgMsg("尚未成功加入桌機自訂通話。");
      return;
    }
    if (fullBlurOn && (next?.mode ?? bgMode) !== "off") {
      setBgMsg("全畫面模糊啟用中，請先關閉全畫面模糊再使用背景模糊/虛擬背景。");
      return;
    }

    const mode = next?.mode ?? bgMode;
    const preset = next?.preset ?? bgPreset;
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
      } else {
        const source = VB_PRESETS.find((x) => x.id === preset)?.source || VB_PRESETS[0]?.source;
        await call.updateInputSettings({
          video: {
            processor: {
              type: "background-image",
              config: { source },
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
      setFullBlurMsg("手機/平板（MVP）禁用全畫面模糊。");
      setFullBlurOn(false);
      return;
    }
    if (!joinedMeeting) {
      setFullBlurMsg("尚未成功加入桌機自訂通話，不能啟用全畫面模糊。");
      setFullBlurOn(false);
      return;
    }
    if (fullBlurPipelineRef.current) return;
    if (!runtimeCaps?.supportsCanvasCaptureStream || !runtimeCaps?.supportsCanvasFilter) {
      setFullBlurMsg("這台桌機瀏覽器不支援 canvas full-blur 所需能力。");
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

      // IMPORTANT:
      // 不要拿目前已發布的 local track 當作 full-blur 的來源。
      // 一旦 Daily 把 outgoing input 切成 canvas/custom track，它可能會停掉或替換原本的 published camera track，
      // 進而讓 canvas 來源直接變黑。這裡固定自己再開一條 camera stream 當 blur source。
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

      if (!switched) throw new Error("桌機自訂通話仍無法把 full-blur track 切成 outgoing video。");
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
  }, [dailyReady, joinedMeeting, bgMode, bgPreset, bgStrength, effectsMvpDisabled]);

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
    (async () => {
      if (!roomId) return;

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setUid(user.id);
      setEmail(user.email ?? "");

      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url")
        .eq("id", roomId)
        .single();

      if (roomErr) {
        setMsg(roomErr.message);
        setChecking(false);
        return;
      }

      setRoom(roomData as Room);

      const { data: memData, error: memErr } = await supabase
        .from("room_members")
        .select("room_id,user_id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memErr) setMsg(memErr.message);
      setIsMember(Boolean(memData));
      setChecking(false);
    })();
  }, [router, roomId]);

  async function refreshRoom() {
    if (!roomId) return;
    const { data, error } = await supabase
      .from("rooms")
      .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url")
      .eq("id", roomId)
      .single();
    if (error) return setMsg(error.message);
    setRoom(data as Room);
  }

  async function join() {
    if (!roomId) return;
    setBusy(true);
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setBusy(false);
      router.replace("/auth/login");
      return;
    }

    const { error } = await supabase
      .from("room_members")
      .upsert({ room_id: roomId, user_id: user.id }, { onConflict: "room_id,user_id" });

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

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setBusy(false);
      router.replace("/auth/login");
      return;
    }

    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    setBusy(false);
    if (error) return setMsg(error.message);

    setIsMember(false);
    setDailyToken("");
    setTokenExp(0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  async function createDailyRoom() {
    if (!roomId || !room) return;
    setBusy(true);
    setMsg("");

    if (room.created_by !== uid) {
      setBusy(false);
      return setMsg("只有房主可以建立視訊房間（MVP 先這樣）。");
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
      return setMsg((json as any)?.error ?? "建立 Daily 房間失敗");
    }

    const url = (json as any)?.url as string | undefined;
    if (!url) {
      setBusy(false);
      return setMsg("Daily 沒回傳 room url");
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

    const { data: sessionData } = await supabase.auth.getSession();
    const access = sessionData.session?.access_token;
    if (!access) {
      setTokenBusy(false);
      return setMsg("Missing Supabase session token（請重新登入）");
    }

    const resp = await fetch("/api/daily/meeting-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ roomId }),
    });

    const json = (await resp.json().catch(() => ({}))) as any;

    if (!resp.ok) {
      if (resp.status === 402) {
        setDailyToken("");
        setTokenExp(0);
        setTokenBusy(false);
        return setMsg("本月免費額度已用完（可升級 VIP 或等下月重置）。");
      }

      setTokenBusy(false);
      return setMsg(json?.error ?? "取得 Daily token 失敗");
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
    try {
      await call.setLocalAudio(!localAudioOn);
      setLocalAudioOn((v) => !v);
    } catch (e: any) {
      setMsg(e?.message || "切換麥克風失敗");
    }
  }

  async function toggleLocalVideo() {
    const call = dailyCallRef.current;
    if (!call) return;
    try {
      await call.setLocalVideo(!localVideoOn);
      setLocalVideoOn((v) => !v);
    } catch (e: any) {
      setMsg(e?.message || "切換鏡頭失敗");
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

  const showExtendBanner =
    isMember && !!room?.daily_room_url && !!dailyToken && secondsLeft > 0 && secondsLeft <= 120;

  if (!roomId) return <main className="p-6">Loading params...</main>;
  if (checking) return <main className="p-6">Loading...</main>;

  return (
    <main className="p-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/rooms" style={{ opacity: 0.8 }}>
            ← Rooms
          </Link>
          <h1 style={{ margin: 0 }}>{room?.title ?? "Room"}</h1>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ opacity: 0.7 }}>{email}</span>
          <Link href="/account" style={{ opacity: 0.85 }}>
            方案/額度
          </Link>
          <button onClick={signOut} className="cc-btn">
            登出
          </button>
        </div>
      </div>

      {room && (
        <p style={{ marginTop: 12, opacity: 0.8 }}>
          {room.mode} · {room.duration_minutes}m · max {room.max_size}
        </p>
      )}

      <section style={{ marginTop: 8, opacity: 0.85 }}>
        {isVip ? (
          <span>VIP：續場 ∞（時間盒 {room?.duration_minutes ?? 25}m / 場）</span>
        ) : pairVipCarry ? (
          <span>由「同房 VIP」續命：你可繼續續場（Pair 例外規則）</span>
        ) : (
          <span>
            免費：本場消耗 {costCredits} 場；剩餘 {remainingCredits ?? "?"}/{monthlyAllowance} 場（每月重置）
          </span>
        )}
      </section>

      <section style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!isMember ? (
          <button disabled={busy} onClick={join} className="cc-btn">
            加入房間
          </button>
        ) : (
          <button disabled={busy} onClick={leave} className="cc-btn">
            離開房間
          </button>
        )}

        <button disabled={busy} onClick={refreshRoom} className="cc-btn">
          重新整理
        </button>

        {room?.daily_room_url ? (
          <span style={{ opacity: 0.7, display: "inline-flex", alignItems: "center" }}>已建立視訊房間</span>
        ) : (
          <button disabled={busy} onClick={createDailyRoom} className="cc-btn">
            建立視訊房間（Daily）
          </button>
        )}

        {isMember && room?.daily_room_url && (
          <button disabled={tokenBusy} onClick={fetchMeetingToken} className="cc-btn">
            重新取得 token
          </button>
        )}
      </section>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {showExtendBanner && (
        <div
          className="cc-card"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ opacity: 0.9 }}>本場即將結束（剩 {secondsLeft}s）。要續下一場嗎？</div>
          <button disabled={tokenBusy} onClick={fetchMeetingToken} className="cc-btn">
            續下一場
          </button>
        </div>
      )}

      <hr style={{ margin: "20px 0", opacity: 0.2 }} />

      <section>
        <h2 style={{ marginTop: 0 }}>
          視訊區（{effectsMvpDisabled ? "Daily Prebuilt / Mobile" : "Daily Custom / Desktop"}）
        </h2>

        {!isMember && (
          <p style={{ opacity: 0.75 }}>
            你必須先「加入房間」才會顯示視訊（避免路人直接吃你的 RTC 成本）。
          </p>
        )}

        {isMember && !room?.daily_room_url && (
          <p style={{ opacity: 0.75 }}>
            尚未建立 Daily 房間。若你是房主，點上面「建立視訊房間（Daily）」。
          </p>
        )}

        {isMember && room?.daily_room_url && !dailyToken && (
          <p style={{ opacity: 0.75 }}>
            {tokenBusy ? "正在取得進入權杖（token）…" : "缺少 token（通常是額度用完/方案限制/或環境變數缺漏）"}
          </p>
        )}

        {canShowCall && effectsMvpDisabled && (
          <div className="cc-card" style={{ borderRadius: 16, overflow: "hidden", padding: 12 }}>
            <div
              className="cc-card"
              style={{
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Mobile / Tablet MVP</div>
              <div style={{ opacity: 0.76, lineHeight: 1.6 }}>
                為了先把手機/平板的共工流程跑穩，行動端暫時禁用：
                背景模糊、虛擬背景、全畫面模糊。你仍可正常加入通話、扣場、續場與使用 VIP。
              </div>
            </div>

            <iframe
              ref={mobileIframeRef}
              src={callUrl}
              style={{ width: "100%", height: "70vh", border: 0, borderRadius: 12 }}
              allow="microphone; camera; autoplay; display-capture"
            />
          </div>
        )}

        {canShowCall && !effectsMvpDisabled && (
          <div className="cc-card" style={{ borderRadius: 16, overflow: "hidden", padding: 12 }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                paddingBottom: 12,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontWeight: 700 }}>桌機自訂通話</div>
              <span style={{ opacity: 0.72, fontSize: 12 }}>
                build={__BUILD_TAG} / meetingState={meetingState} / joined={String(joinedMeeting)}
              </span>

              <button className="cc-btn" onClick={toggleLocalAudio} disabled={!dailyReady}>
                {localAudioOn ? "麥克風：開" : "麥克風：關"}
              </button>

              <button className="cc-btn" onClick={toggleLocalVideo} disabled={!dailyReady}>
                {localVideoOn ? "鏡頭：開" : "鏡頭：關"}
              </button>
            </div>

            <div
              className="cc-card"
              style={{
                padding: 12,
                borderRadius: 12,
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 600 }}>背景效果</div>

              <select
                className="cc-select"
                value={bgMode}
                onChange={(e) => setBgMode(e.target.value as BgMode)}
                disabled={!dailyReady || !joinedMeeting || bgApplying || fullBlurOn}
              >
                <option value="off">關閉</option>
                <option value="blur">背景模糊</option>
                <option value="image">虛擬背景</option>
              </select>

              {bgMode === "blur" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ opacity: 0.78, fontSize: 12 }}>模糊強度</span>
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
              )}

              {bgMode === "image" && (
                <select
                  className="cc-select"
                  value={bgPreset}
                  onChange={(e) => setBgPreset(e.target.value)}
                  disabled={!dailyReady || !joinedMeeting || bgApplying || fullBlurOn}
                >
                  {VB_PRESETS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ opacity: 0.64, fontSize: 12 }}>
                {!dailyReady ? "載入中…" : !joinedMeeting ? "尚未加入桌機通話" : "背景模糊 / 虛擬背景僅在桌機開啟"}
              </div>
            </div>

            <div
              className="cc-card"
              style={{
                padding: 12,
                borderRadius: 12,
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 600 }}>全畫面模糊</div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={fullBlurOn}
                  onChange={(e) => setFullBlurOn(e.target.checked)}
                  disabled={!dailyReady || !joinedMeeting || fullBlurApplying}
                />
                <span style={{ fontSize: 12, opacity: 0.9 }}>啟用（遠端也必須看到你變糊）</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.78, fontSize: 12 }}>解析度</span>
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

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.78, fontSize: 12 }}>模糊(px)</span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={fullBlurPx}
                  onChange={(e) => setFullBlurPx(Number(e.target.value))}
                  disabled={!dailyReady || !joinedMeeting || fullBlurApplying}
                />
                <span style={{ width: 28, textAlign: "right", fontSize: 12, opacity: 0.9 }}>{fullBlurPx}</span>
              </label>

              <div style={{ opacity: 0.64, fontSize: 12 }}>
                {!dailyReady
                  ? "載入中…"
                  : !joinedMeeting
                  ? "尚未加入桌機通話"
                  : fullBlurApplying
                  ? "切換中…"
                  : "右上角會顯示處理後預覽；最終以遠端是否也變糊為準"}
              </div>
            </div>

            {bgMsg && (
              <div className="cc-danger" style={{ paddingTop: 10 }}>
                {bgMsg}
              </div>
            )}

            {fullBlurMsg && (
              <div className="cc-danger" style={{ paddingTop: 10 }}>
                {fullBlurMsg}
              </div>
            )}

            <video
              ref={desktopPreviewRef}
              style={{
                position: "fixed",
                top: 10,
                right: 10,
                width: 220,
                height: 124,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.45)",
                display: fullBlurOn ? "block" : "none",
                zIndex: 9999,
              }}
              autoPlay
              muted
              playsInline
            />

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: participantList.length <= 1 ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {participantList.length === 0 ? (
                <div
                  className="cc-card"
                  style={{
                    minHeight: 280,
                    display: "grid",
                    placeItems: "center",
                    opacity: 0.72,
                    borderRadius: 16,
                  }}
                >
                  連線中，正在等待桌機自訂通話初始化…
                </div>
              ) : (
                participantList.map(([id, participant]) => (
                  <MediaTile key={id} participant={participant} isLocal={id === "local"} />
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
