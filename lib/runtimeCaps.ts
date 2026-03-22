// lib/runtimeCaps.ts
// Capability-based gating for UI/features.
// MVP policy: mobile/tablet devices disable all blur-related effects.

export type RuntimeCaps = {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  supportsCanvasCaptureStream: boolean;
  supportsCanvasFilter: boolean;
};

function detectIOS(ua: string): boolean {
  // iPadOS 13+ can pretend to be Mac; add touch heuristic.
  const isIPhoneIPadIPod = /iPhone|iPad|iPod/i.test(ua);
  const isMacLikeIPad = /Macintosh/i.test(ua) && typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 1;
  return isIPhoneIPadIPod || isMacLikeIPad;
}

export function getRuntimeCaps(): RuntimeCaps {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      supportsCanvasCaptureStream: false,
      supportsCanvasFilter: false,
    };
  }

  const ua = navigator.userAgent || "";
  const isIOS = detectIOS(ua);
  const isAndroid = /Android/i.test(ua);

  // Pointer heuristic: coarse pointer + small-ish viewport => mobile/tablet UX
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const smallViewport = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 900;

  const isMobile = isIOS || isAndroid || (coarse && smallViewport);

  const supportsCanvasCaptureStream =
    typeof (HTMLCanvasElement.prototype as any).captureStream === "function";

  // Canvas 2D ctx filter support (not perfect, but good enough)
  let supportsCanvasFilter = false;
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d") as any;
    supportsCanvasFilter = !!ctx && "filter" in ctx;
  } catch {
    supportsCanvasFilter = false;
  }

  return {
    isMobile,
    isIOS,
    isAndroid,
    supportsCanvasCaptureStream,
    supportsCanvasFilter,
  };
}
