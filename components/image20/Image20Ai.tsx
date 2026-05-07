"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type Mode = "global" | "personal" | "host";
const copy: Record<Mode, { label: string; title: string; body: string }> = {
  global: { label: "Global", title: "AI Companion", body: "協助你找入口、理解規則、把今天想做的事情拆成可以開始的一步。" },
  personal: { label: "Personal", title: "Personal Room AI", body: "只協助你自己開始、卡住救援與收尾，不公開你的私人內容。" },
  host: { label: "Host", title: "Shared Host AI", body: "房間級主持層，適合開場、轉場、提醒與低頻收束。正式上線前不會消耗 AI 額度。" },
};

export function Image20AiCompanion() {
  const pathname = usePathname();
  const inRoom = /^\/rooms\/[^/]+/.test(pathname || "");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(inRoom ? "host" : "global");
  const modes = useMemo<Mode[]>(() => (inRoom ? ["host", "personal", "global"] : ["global"]), [inRoom]);
  return (
    <div data-image20-ai="dom-v6">
      {open ? (
        <section className="i20-ai-panel">
          <div className="cover" />
          <div className="body">
            <div className="i20-softbar" style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.12)" }}>
              <div><span className="i20-kicker">AI</span><h3 className="i20-serif" style={{ margin: 0 }}>{copy[mode].title}</h3></div>
              <button type="button" className="i20-btn ghost" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="i20-chip-row">{modes.map((m) => <button key={m} className={`i20-chip ${m === mode ? "active" : ""}`} onClick={() => setMode(m)}>{copy[m].label}</button>)}</div>
            <div className="i20-ai-msg">{copy[mode].body}</div>
            <small style={{ opacity: .72 }}>UI 已保留。未設定 AI server gate / env 前，不會送出對話或消耗額度。</small>
          </div>
        </section>
      ) : null}
      <button type="button" className="i20-ai-orb" onClick={() => setOpen((value) => !value)} aria-label="AI Companion">
        <img src="/site-assets/image20/ai/ai-companion-soft-orb.png" alt="" />
      </button>
    </div>
  );
}
