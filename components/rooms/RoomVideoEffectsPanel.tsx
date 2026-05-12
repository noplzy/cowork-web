"use client";

import styles from "./RoomVideoEffectsPanel.module.css";

export type FullBlurQuality = "balanced" | "clear";

type RoomVideoEffectsPanelProps = {
  dailyReady: boolean;
  effectBusy: boolean;
  effectStatus: string;
  effectError: string;
  mobileEffectsBlocked: boolean;
  desktopBlurAvailable: boolean;
  fullBlurAvailable: boolean;
  backgroundBlurEnabled: boolean;
  backgroundBlurStrength: number;
  fullBlurEnabled: boolean;
  fullBlurPx: number;
  fullBlurQuality: FullBlurQuality;
  onToggleBackgroundBlur: () => void | Promise<void>;
  onBackgroundBlurStrengthChange: (value: number) => void;
  onToggleFullBlur: () => void | Promise<void>;
  onFullBlurPxChange: (value: number) => void;
  onFullBlurQualityChange: (value: FullBlurQuality) => void;
};

export function RoomVideoEffectsPanel({
  dailyReady,
  effectBusy,
  effectStatus,
  effectError,
  mobileEffectsBlocked,
  desktopBlurAvailable,
  fullBlurAvailable,
  backgroundBlurEnabled,
  backgroundBlurStrength,
  fullBlurEnabled,
  fullBlurPx,
  fullBlurQuality,
  onToggleBackgroundBlur,
  onBackgroundBlurStrengthChange,
  onToggleFullBlur,
  onFullBlurPxChange,
  onFullBlurQualityChange,
}: RoomVideoEffectsPanelProps) {
  const effectsReady = dailyReady && !effectBusy;
  const backgroundDisabled =
    !effectsReady || mobileEffectsBlocked || !desktopBlurAvailable;
  const fullBlurDisabled =
    !effectsReady || mobileEffectsBlocked || !fullBlurAvailable;

  return (
    <section className="i20-panel" data-room-video-effects="scheme-c-call-object-v1">
      <span className="i20-kicker">Video Effects</span>
      <h3>視訊效果</h3>
      <p>
        背景模糊與全畫面模糊皆可調整強度。為維持房內流暢度，兩種效果會擇一啟用。
      </p>

      {mobileEffectsBlocked ? (
        <div className={styles.notice}>
          行動端以穩定通話為優先，影像模糊效果僅於桌機提供。
        </div>
      ) : null}

      <div className={styles.effectGrid}>
        <article className={styles.effectCard}>
          <div className={styles.effectHead}>
            <div>
              <b>背景模糊</b>
              <span>保留人物，柔化房間背景</span>
            </div>
            <button
              type="button"
              className={`i20-btn ${backgroundBlurEnabled ? "peach" : "light"}`}
              onClick={() => void onToggleBackgroundBlur()}
              disabled={backgroundDisabled}
            >
              {backgroundBlurEnabled ? "關閉" : "啟用"}
            </button>
          </div>

          <label className={styles.sliderLabel}>
            <span>模糊程度</span>
            <strong>{backgroundBlurStrength}%</strong>
          </label>
          <input
            className={styles.slider}
            type="range"
            min={15}
            max={100}
            step={1}
            value={backgroundBlurStrength}
            onChange={(event) =>
              onBackgroundBlurStrengthChange(Number(event.target.value))
            }
            disabled={backgroundDisabled || !backgroundBlurEnabled}
          />
        </article>

        <article className={styles.effectCard}>
          <div className={styles.effectHead}>
            <div>
              <b>全畫面模糊</b>
              <span>整段影像柔化後再送進房間</span>
            </div>
            <button
              type="button"
              className={`i20-btn ${fullBlurEnabled ? "peach" : "light"}`}
              onClick={() => void onToggleFullBlur()}
              disabled={fullBlurDisabled}
            >
              {fullBlurEnabled ? "關閉" : "啟用"}
            </button>
          </div>

          <label className={styles.sliderLabel}>
            <span>模糊程度</span>
            <strong>{fullBlurPx}px</strong>
          </label>
          <input
            className={styles.slider}
            type="range"
            min={2}
            max={28}
            step={1}
            value={fullBlurPx}
            onChange={(event) => onFullBlurPxChange(Number(event.target.value))}
            disabled={fullBlurDisabled || !fullBlurEnabled}
          />

          <div className={styles.qualityRow}>
            <label>
              畫質優先序
              <select
                className="i20-select"
                value={fullBlurQuality}
                onChange={(event) =>
                  onFullBlurQualityChange(event.target.value as FullBlurQuality)
                }
                disabled={fullBlurDisabled || fullBlurEnabled}
              >
                <option value="balanced">穩定 360p / 24fps</option>
                <option value="clear">清晰 540p / 24fps</option>
              </select>
            </label>
          </div>
        </article>
      </div>

      {effectError ? (
        <div className={`${styles.status} ${styles.error}`}>{effectError}</div>
      ) : (
        <div className={styles.status}>{effectStatus}</div>
      )}
    </section>
  );
}
