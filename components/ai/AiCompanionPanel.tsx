"use client";

import { useMemo, useRef, useState } from "react";

type AiCompanionTab = "personal" | "host" | "voice";
type PersonalIntent = "start" | "stuck" | "wrapup" | "general";
type SharedHostAction = "OPENING" | "HELP_NEXT_STEP" | "WRAP_UP" | "EXTENSION_CHECK";

type AiCompanionPanelProps = {
  roomId: string;
  accessToken: string;
  dailyReady: boolean;
  roomTitle?: string;
  isMember?: boolean;
};

type JsonMap = Record<string, any>;

const PERSONAL_INTENTS: Array<{ value: PersonalIntent; label: string; helper: string }> = [
  { value: "start", label: "開始", helper: "給我一個可以立刻做的小步驟" },
  { value: "stuck", label: "卡住", helper: "幫我把問題拆成下一步" },
  { value: "wrapup", label: "收尾", helper: "幫我整理完成事項與下一步" },
  { value: "general", label: "一般", helper: "低壓力陪伴回覆" },
];

const HOST_ACTIONS: Array<{ value: SharedHostAction; label: string; helper: string }> = [
  { value: "OPENING", label: "開場引導", helper: "讓大家知道現在怎麼開始" },
  { value: "HELP_NEXT_STEP", label: "下一步協助", helper: "中途把節奏拉回一個小步驟" },
  { value: "WRAP_UP", label: "收尾整理", helper: "整理完成事項與後續提醒" },
  { value: "EXTENSION_CHECK", label: "續場確認", helper: "溫和詢問是否需要延長" },
];

async function parseErrorResponse(response: Response) {
  const json = await response.json().catch(() => null);
  const message = json?.error || json?.detail || `HTTP ${response.status}`;
  const extra = json?.providerRequestId ? `｜requestId: ${json.providerRequestId}` : "";
  return `${message}${extra}`;
}

export function AiCompanionPanel({
  roomId,
  accessToken,
  dailyReady,
  roomTitle = "同行房間",
  isMember = false,
}: AiCompanionPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tab, setTab] = useState<AiCompanionTab>("personal");
  const [personalIntent, setPersonalIntent] = useState<PersonalIntent>("stuck");
  const [personalMessage, setPersonalMessage] = useState("我不知道現在要先做什麼。");
  const [latestPersonalReply, setLatestPersonalReply] = useState("");
  const [latestHostSuggestion, setLatestHostSuggestion] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [status, setStatus] = useState("AI Companion 已準備好。第一版只做房內救援、共享主持建議與單句語音播放。");
  const [error, setError] = useState("");
  const [lastProviderRequestId, setLastProviderRequestId] = useState("");
  const [lastUsageEventId, setLastUsageEventId] = useState("");

  const canUseAi = Boolean(roomId && accessToken && isMember);
  const disabledReason = useMemo(() => {
    if (!roomId) return "缺少 roomId。";
    if (!accessToken) return "尚未取得登入憑證。";
    if (!isMember) return "加入房間後才能使用房內 AI。";
    return "";
  }, [accessToken, isMember, roomId]);

  async function postJson(path: string, body: JsonMap) {
    if (!canUseAi) {
      throw new Error(disabledReason || "AI 尚未就緒。");
    }

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ roomId, ...body }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return (await response.json()) as JsonMap;
  }

  async function askPersonalAi() {
    setBusyKey("personal");
    setError("");
    setStatus("Personal Room AI 正在整理回覆...");

    try {
      const json = await postJson("/api/ai/room/personal/message", {
        message: personalMessage,
        intent: personalIntent,
      });

      const reply = String(json.reply || "").trim();
      setLatestPersonalReply(reply);
      setVoiceText(reply);
      setLastProviderRequestId(json.providerRequestId || "");
      setLastUsageEventId(json.usageEventId || "");
      setStatus("Personal Room AI 已完成。可以直接複製，也可以用語音播放。");
    } catch (err: any) {
      setError(err?.message || "Personal Room AI 呼叫失敗。");
      setStatus("Personal Room AI 暫時不可用。");
    } finally {
      setBusyKey("");
    }
  }

  async function askSharedHost(action: SharedHostAction) {
    setBusyKey(`host:${action}`);
    setError("");
    setStatus("Shared Host AI 正在產生主持建議...");

    try {
      const json = await postJson("/api/ai/room/host/suggest", { action });
      const suggestion = String(json.suggestion || "").trim();
      setLatestHostSuggestion(suggestion);
      setVoiceText(suggestion);
      setLastProviderRequestId(json.providerRequestId || "");
      setLastUsageEventId(json.usageEventId || "");
      setStatus("Shared Host AI 已完成。第一版不會自動對全房廣播，請手動確認後使用。");
    } catch (err: any) {
      setError(err?.message || "Shared Host AI 呼叫失敗。");
      setStatus("Shared Host AI 暫時不可用。");
    } finally {
      setBusyKey("");
    }
  }

  async function playVoice() {
    const text = voiceText.trim();
    if (!text) {
      setError("請先產生或輸入要播放的文字。");
      return;
    }

    setBusyKey("voice");
    setError("");
    setStatus("SeedTTS 正在合成單句語音...");

    try {
      const response = await fetch("/api/ai/room/voice/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId, text }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      const contentType = response.headers.get("content-type") || "";
      setLastProviderRequestId(response.headers.get("x-provider-request-id") || "");
      setLastUsageEventId(response.headers.get("x-ai-usage-event-id") || "");

      if (contentType.includes("application/json")) {
        const json = await response.json().catch(() => ({}));
        setStatus("TTS provider 回傳 JSON。請檢查 SeedTTS response format 是否為音訊串流。");
        setError(json?.error || "SeedTTS 未回傳可播放音訊。");
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      setStatus("語音播放中。第一版只在本機播放，不會注入 Daily 全房音訊。");
    } catch (err: any) {
      setError(err?.message || "SeedTTS 語音播放失敗。");
      setStatus("語音播放暫時不可用。");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="i20-panel ai-companion-panel" data-ai-companion-panel="phase1-room-panel">
      <span className="i20-kicker">AI Companion</span>
      <h3>房內 AI 陪伴</h3>
      <p className="ai-companion-muted">
        {roomTitle}｜{dailyReady ? "通話已連線" : "通話尚未連線"}｜AI 只做低壓力輔助，不取代真人互動。
      </p>

      {!canUseAi ? (
        <div className="ai-companion-alert">{disabledReason}</div>
      ) : null}

      <div className="ai-companion-tabs" role="tablist" aria-label="AI Companion 模式">
        <button type="button" className={tab === "personal" ? "active" : ""} onClick={() => setTab("personal")}>
          房內救援
        </button>
        <button type="button" className={tab === "host" ? "active" : ""} onClick={() => setTab("host")}>
          共享主持
        </button>
        <button type="button" className={tab === "voice" ? "active" : ""} onClick={() => setTab("voice")}>
          語音播放
        </button>
      </div>

      {tab === "personal" ? (
        <div className="ai-companion-pane">
          <div className="ai-companion-intent-row">
            {PERSONAL_INTENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={personalIntent === item.value ? "active" : ""}
                onClick={() => setPersonalIntent(item.value)}
                title={item.helper}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="ai-companion-label" htmlFor="ai-personal-message">
            你現在想讓 AI 幫你整理什麼？
          </label>
          <textarea
            id="ai-personal-message"
            value={personalMessage}
            onChange={(event) => setPersonalMessage(event.target.value)}
            maxLength={900}
            rows={4}
            placeholder="例如：我卡住了，不知道下一步要做什麼。"
          />
          <button type="button" className="i20-btn" onClick={askPersonalAi} disabled={!canUseAi || busyKey === "personal"}>
            {busyKey === "personal" ? "整理中..." : "請 AI 幫我整理"}
          </button>

          {latestPersonalReply ? (
            <article className="ai-companion-output">
              <b>Personal Room AI</b>
              <p>{latestPersonalReply}</p>
              <button type="button" onClick={() => setVoiceText(latestPersonalReply)}>
                放到語音播放
              </button>
            </article>
          ) : null}
        </div>
      ) : null}

      {tab === "host" ? (
        <div className="ai-companion-pane">
          <p className="ai-companion-muted">
            Shared Host AI 只產生房間級主持建議。第一版不自動廣播，避免 AI 打斷真人節奏。
          </p>
          <div className="ai-companion-host-grid">
            {HOST_ACTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => askSharedHost(item.value)}
                disabled={!canUseAi || busyKey === `host:${item.value}`}
              >
                <b>{busyKey === `host:${item.value}` ? "產生中..." : item.label}</b>
                <span>{item.helper}</span>
              </button>
            ))}
          </div>

          {latestHostSuggestion ? (
            <article className="ai-companion-output">
              <b>Shared Host AI</b>
              <p>{latestHostSuggestion}</p>
              <button type="button" onClick={() => setVoiceText(latestHostSuggestion)}>
                放到語音播放
              </button>
            </article>
          ) : null}
        </div>
      ) : null}

      {tab === "voice" ? (
        <div className="ai-companion-pane">
          <label className="ai-companion-label" htmlFor="ai-voice-text">
            單句語音內容
          </label>
          <textarea
            id="ai-voice-text"
            value={voiceText}
            onChange={(event) => setVoiceText(event.target.value)}
            maxLength={900}
            rows={4}
            placeholder="先從 Personal Room AI 或 Shared Host AI 產生一句話，也可以手動輸入。"
          />
          <button type="button" className="i20-btn peach" onClick={playVoice} disabled={!canUseAi || busyKey === "voice"}>
            {busyKey === "voice" ? "合成中..." : "播放 AI 語音"}
          </button>
          <p className="ai-companion-muted">
            目前是本機播放測試，不會讓 Daily 房內所有人都聽到。之後若要全房廣播，需要 Daily 音訊注入或遷移 BytePlus RTC。
          </p>
        </div>
      ) : null}

      {error ? <div className="ai-companion-error">{error}</div> : null}
      <div className="ai-companion-status">
        <span>{status}</span>
        {lastUsageEventId || lastProviderRequestId ? (
          <small>
            {lastUsageEventId ? `usage: ${lastUsageEventId.slice(0, 8)}` : ""}
            {lastProviderRequestId ? ` provider: ${lastProviderRequestId.slice(0, 10)}` : ""}
          </small>
        ) : null}
      </div>

      <style>{`
        .ai-companion-panel {
          display: grid;
          gap: 12px;
        }

        .ai-companion-muted {
          color: rgba(255, 242, 223, 0.72);
          font-size: 13px;
          line-height: 1.65;
        }

        .ai-companion-alert,
        .ai-companion-error {
          border: 1px solid rgba(255, 198, 185, 0.28);
          border-radius: 14px;
          padding: 10px 12px;
          color: #ffc6b9;
          background: rgba(119, 38, 38, 0.16);
          font-size: 13px;
          line-height: 1.55;
        }

        .ai-companion-tabs,
        .ai-companion-intent-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ai-companion-tabs button,
        .ai-companion-intent-row button,
        .ai-companion-output button {
          border: 1px solid rgba(255, 229, 201, 0.18);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 242, 223, 0.78);
          cursor: pointer;
        }

        .ai-companion-tabs button.active,
        .ai-companion-intent-row button.active {
          border-color: rgba(231, 164, 117, 0.72);
          background: rgba(231, 164, 117, 0.16);
          color: #fff0dc;
        }

        .ai-companion-pane {
          display: grid;
          gap: 12px;
        }

        .ai-companion-label {
          color: rgba(255, 242, 223, 0.72);
          font-size: 13px;
          font-weight: 700;
        }

        .ai-companion-pane textarea {
          width: 100%;
          resize: vertical;
          min-height: 96px;
          border: 1px solid rgba(255, 229, 201, 0.14);
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.06);
          color: #fff2df;
          line-height: 1.6;
          outline: none;
        }

        .ai-companion-pane textarea:focus {
          border-color: rgba(231, 164, 117, 0.68);
          box-shadow: 0 0 0 3px rgba(231, 164, 117, 0.12);
        }

        .ai-companion-host-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .ai-companion-host-grid button {
          display: grid;
          gap: 5px;
          min-height: 86px;
          border: 1px solid rgba(255, 229, 201, 0.14);
          border-radius: 16px;
          padding: 12px;
          text-align: left;
          background: rgba(255, 255, 255, 0.06);
          color: #fff2df;
          cursor: pointer;
        }

        .ai-companion-host-grid button:disabled,
        .ai-companion-pane button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .ai-companion-host-grid span {
          color: rgba(255, 242, 223, 0.62);
          font-size: 12px;
          line-height: 1.45;
        }

        .ai-companion-output {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(255, 229, 201, 0.12);
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.045);
        }

        .ai-companion-output b {
          color: #f0c48d;
        }

        .ai-companion-output p {
          margin: 0;
          white-space: pre-wrap;
          color: rgba(255, 242, 223, 0.86);
          font-size: 14px;
          line-height: 1.72;
        }

        .ai-companion-status {
          display: grid;
          gap: 3px;
          color: rgba(255, 242, 223, 0.58);
          font-size: 12px;
          line-height: 1.55;
        }

        .ai-companion-status small {
          color: rgba(255, 242, 223, 0.4);
          word-break: break-all;
        }

        @media (max-width: 720px) {
          .ai-companion-host-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export default AiCompanionPanel;
