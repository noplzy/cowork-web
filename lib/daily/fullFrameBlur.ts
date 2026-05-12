export type FullBlurQuality = "balanced" | "clear";

type FullFrameBlurOptions = {
  sourceTrack: MediaStreamTrack;
  blurPx: number;
  quality: FullBlurQuality;
};

type FullBlurPreset = {
  width: number;
  height: number;
  fps: number;
};

export type FullFrameBlurPipeline = {
  sourceTrack: MediaStreamTrack;
  processedTrack: MediaStreamTrack;
  updateBlurPx: (value: number) => void;
  disposeProcessedOnly: () => void;
  disposeAll: () => void;
};

const PRESETS: Record<FullBlurQuality, FullBlurPreset> = {
  balanced: {
    width: 640,
    height: 360,
    fps: 24,
  },
  clear: {
    width: 960,
    height: 540,
    fps: 24,
  },
};

function clampBlurPx(value: number): number {
  return Math.min(28, Math.max(2, Number.isFinite(value) ? value : 10));
}

function assertCanvasCaptureStream(canvas: HTMLCanvasElement): MediaStream {
  const captureStream = (canvas as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  }).captureStream;

  if (typeof captureStream !== "function") {
    throw new Error("此瀏覽器暫不支援全畫面模糊。");
  }

  return captureStream.call(canvas, 24);
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("無法讀取本地鏡頭畫面。"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadeddata", handleReady, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

export async function createFullFrameBlurPipeline({
  sourceTrack,
  blurPx,
  quality,
}: FullFrameBlurOptions): Promise<FullFrameBlurPipeline> {
  if (sourceTrack.readyState !== "live") {
    throw new Error("本地鏡頭尚未準備完成。");
  }

  const preset = PRESETS[quality];
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([sourceTrack]);

  await waitForVideoReady(video);
  await video.play().catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context || !("filter" in context)) {
    throw new Error("此瀏覽器暫不支援全畫面模糊。");
  }

  const processedStream = assertCanvasCaptureStream(canvas);
  const processedTrack = processedStream.getVideoTracks()[0];
  if (!processedTrack) {
    throw new Error("無法建立全畫面模糊影像軌。");
  }

  let disposed = false;
  let currentBlurPx = clampBlurPx(blurPx);
  let lastDrawAt = 0;
  let animationFrameId = 0;
  const frameGap = 1000 / preset.fps;

  const drawFrame = (timestamp: number) => {
    if (disposed) {
      return;
    }

    if (timestamp - lastDrawAt >= frameGap) {
      const overscan = Math.min(48, Math.max(10, currentBlurPx * 2));
      context.save();
      context.filter = `blur(${currentBlurPx}px)`;
      context.drawImage(
        video,
        -overscan,
        -overscan,
        canvas.width + overscan * 2,
        canvas.height + overscan * 2
      );
      context.restore();
      lastDrawAt = timestamp;
    }

    animationFrameId = window.requestAnimationFrame(drawFrame);
  };

  animationFrameId = window.requestAnimationFrame(drawFrame);

  const disposeProcessedOnly = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.cancelAnimationFrame(animationFrameId);
    processedTrack.stop();
    processedStream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  };

  const disposeAll = () => {
    disposeProcessedOnly();
    sourceTrack.stop();
  };

  return {
    sourceTrack,
    processedTrack,
    updateBlurPx(value: number) {
      currentBlurPx = clampBlurPx(value);
    },
    disposeProcessedOnly,
    disposeAll,
  };
}
