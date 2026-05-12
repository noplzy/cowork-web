"use client";

import { useEffect, useMemo, useRef } from "react";
import styles from "./RoomCallStage.module.css";

export type RoomParticipantTile = {
  id: string;
  name: string;
  isLocal: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  videoOn: boolean;
  audioOn: boolean;
};

type RoomCallStageProps = {
  roomTitle: string;
  durationMinutes: number;
  roomMode: string;
  roomStatus: string;
  participants: RoomParticipantTile[];
  ready: boolean;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  screenSharing: boolean;
  onToggleAudio: () => void | Promise<void>;
  onToggleVideo: () => void | Promise<void>;
  onToggleScreenShare: () => void | Promise<void>;
  onLeave: () => void | Promise<void>;
};

function TrackVideo({
  track,
  muted,
  className,
}: {
  track: MediaStreamTrack | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (!track) {
      element.srcObject = null;
      return;
    }

    const stream = new MediaStream([track]);
    element.srcObject = stream;
    void element.play().catch(() => undefined);

    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}

function TrackAudio({ track }: { track: MediaStreamTrack | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (!track) {
      element.srcObject = null;
      return;
    }

    const stream = new MediaStream([track]);
    element.srcObject = stream;
    void element.play().catch(() => undefined);

    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}

export function RoomCallStage({
  roomTitle,
  durationMinutes,
  roomMode,
  roomStatus,
  participants,
  ready,
  localAudioEnabled,
  localVideoEnabled,
  screenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
}: RoomCallStageProps) {
  const visibleTiles = useMemo(() => {
    if (participants.length === 0) {
      return [];
    }

    return participants;
  }, [participants]);

  return (
    <section className={`${styles.stage} i20-call-stage`}>
      <div className="i20-call-bg" />

      <header className={styles.header}>
        <span className="i20-kicker">In-room</span>
        <h2 className="i20-serif">{roomTitle}</h2>
        <div className="i20-chip-row">
          <span className="i20-chip active">{durationMinutes} 分鐘</span>
          <span className="i20-chip active">{roomMode}</span>
          <span className="i20-chip active">{roomStatus}</span>
        </div>
      </header>

      <div className={styles.grid} data-ready={ready ? "true" : "false"}>
        {visibleTiles.length === 0 ? (
          <>
            <div className={styles.placeholder}>等待取得視訊權限</div>
            <div className={styles.placeholder}>加入後會顯示其他參與者</div>
          </>
        ) : (
          visibleTiles.map((participant) => (
            <article
              key={participant.id}
              className={styles.tile}
              data-local={participant.isLocal ? "true" : "false"}
            >
              {participant.screenTrack ? (
                <TrackVideo
                  track={participant.screenTrack}
                  muted={participant.isLocal}
                  className={styles.video}
                />
              ) : participant.videoTrack && participant.videoOn ? (
                <TrackVideo
                  track={participant.videoTrack}
                  muted={participant.isLocal}
                  className={styles.video}
                />
              ) : (
                <div className={styles.avatar}>
                  {participant.name.slice(0, 1).toUpperCase()}
                </div>
              )}

              {!participant.isLocal && participant.audioTrack ? (
                <TrackAudio track={participant.audioTrack} />
              ) : null}

              <div className={styles.caption}>
                <b>{participant.name}</b>
                <span>
                  {participant.screenTrack
                    ? "螢幕分享"
                    : participant.videoOn
                      ? "鏡頭開啟"
                      : "鏡頭關閉"}
                  {" · "}
                  {participant.audioOn ? "音訊開啟" : "靜音"}
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      <nav className={styles.controls} aria-label="房內控制">
        <button
          type="button"
          className={localAudioEnabled ? styles.active : ""}
          onClick={() => void onToggleAudio()}
          disabled={!ready}
        >
          {localAudioEnabled ? "靜音" : "開麥"}
        </button>
        <button
          type="button"
          className={localVideoEnabled ? styles.active : ""}
          onClick={() => void onToggleVideo()}
          disabled={!ready}
        >
          {localVideoEnabled ? "關鏡頭" : "開鏡頭"}
        </button>
        <button
          type="button"
          className={screenSharing ? styles.active : ""}
          onClick={() => void onToggleScreenShare()}
          disabled={!ready}
        >
          {screenSharing ? "停止分享" : "分享螢幕"}
        </button>
        <button
          type="button"
          className={styles.leave}
          onClick={() => void onLeave()}
        >
          離開
        </button>
      </nav>
    </section>
  );
}
