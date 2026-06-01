"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

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

const HEARTBEAT_INTERVAL_MS = 25_000;
const DEFAULT_PRESENCE_MODE: PresenceMode = "quiet";

function getRoomIdFromParams(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function clickedLeaveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const anchor = target.closest("a");
  if (anchor instanceof HTMLAnchorElement) {
    const href = anchor.getAttribute("href") || "";
    if (href === "/rooms" || href.startsWith("/rooms?")) {
      return true;
    }
  }

  const button = target.closest("button");
  const label = (button?.textContent || "").replace(/\s+/g, "");
  return Boolean(label && (label.includes("離開") || label.includes("回房間列表")));
}

export function RoomLifecycleBridge() {
  const params = useParams<{ roomId?: string | string[] }>();
  const roomId = getRoomIdFromParams(params?.roomId);
  const accessTokenRef = useRef("");
  const leaveSentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    getClientSessionSnapshot()
      .then((session) => {
        if (!cancelled) {
          accessTokenRef.current = session?.accessToken || "";
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    async function sendPresence(eventType: PresenceEventType, keepalive = false) {
      const token = accessTokenRef.current;
      if (!token) return;

      const body = JSON.stringify({
        roomId,
        presenceMode: DEFAULT_PRESENCE_MODE,
        eventType,
        visibleState: typeof document === "undefined" ? null : document.visibilityState,
        mediaTrackState: {
          source: "room_lifecycle_bridge",
          page_hidden: typeof document === "undefined" ? null : document.hidden,
        },
      });

      await fetch("/api/rooms/presence/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
        keepalive,
      }).catch(() => undefined);
    }

    async function sendLeave(keepalive = true) {
      if (leaveSentRef.current) return;
      const token = accessTokenRef.current;
      if (!token) return;

      leaveSentRef.current = true;

      await sendPresence("left", keepalive);

      await fetch("/api/rooms/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, reason: "explicit_navigation" }),
        keepalive,
      }).catch(() => undefined);
    }

    const sendInitial = window.setTimeout(() => {
      void sendPresence("selected");
      void sendPresence("heartbeat");
    }, 800);

    const heartbeat = window.setInterval(() => {
      void sendPresence("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    const onVisibilityChange = () => {
      void sendPresence(document.hidden ? "hidden" : "visible", true);
    };

    const onPageHide = () => {
      void sendPresence("hidden", true);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!clickedLeaveTarget(event.target)) return;
      void sendLeave(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.clearTimeout(sendInitial);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [roomId]);

  return null;
}
