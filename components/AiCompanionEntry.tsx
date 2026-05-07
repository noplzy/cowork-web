"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type AiMode = "global" | "room-personal" | "room-host";

const modeCopy: Record<AiMode, { label: string; title: string; body: string; badge: string }> = {
  global: {
    label: "全站 AI",
    title: "安感島 AI 伴行層",
    body: "可以協助你理解 Rooms、找適合的陪伴入口，或先把要開始的事情拆小。",
    badge: "Global",
  },
  "room-personal": {
    label: "Personal Room AI",
    title: "私人房內救援",
    body: "只協助你本人開始、卡住、收尾；不會把私人內容公開到房間。",
    badge: "Private",
  },
  "room-host": {
    label: "Shared Host AI",
    title: "共享主持人",
    body: "房間級主持層，適合開場、轉場、延長確認與低頻收束。",
    badge: "Shared",
  },
};

export function AiCompanionEntry() {
  const pathname = usePathname();
  const inRoom = /^\/rooms\/[^/]+/.test(pathname || "");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>(inRoom ? "room-host" : "global");

  const availableModes = useMemo<AiMode[]>(() => {
    return inRoom ? ["room-host", "room-personal", "global"] : ["global"];
  }, [inRoom]);

  const current = modeCopy[mode];

  return (
    <div className="image20-ai" data-ai-companion-entry="image2.0-exact-reserved-v3">
      {open ? (
        <section className="image20-ai__panel" aria-label="AI Companion 預留面板">
          <div className="image20-ai__visual" aria-hidden="true" />
          <div className="image20-ai__header">
            <div>
              <span className="image20-ai__kicker">AI 夥伴陪行</span>
              <h2>{current.title}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="關閉 AI 面板">
              ×
            </button>
          </div>

          <div className="image20-ai__tabs" role="tablist" aria-label="AI 模式">
            {availableModes.map((item) => (
              <button
                key={item}
                type="button"
                className={item === mode ? "is-active" : ""}
                onClick={() => setMode(item)}
              >
                {modeCopy[item].label}
              </button>
            ))}
          </div>

          <div className="image20-ai__message">
            <span>{current.badge}</span>
            <p>{current.body}</p>
          </div>

          <p className="image20-ai__privacy">
            目前為 UI 預留狀態；未串接後端前不會送出對話、不會消耗 AI 或房間額度。
          </p>
        </section>
      ) : null}

      <button type="button" className="image20-ai__orb" onClick={() => setOpen((value) => !value)} aria-label="開啟 AI 夥伴">
        <span />
      </button>
    </div>
  );
}
