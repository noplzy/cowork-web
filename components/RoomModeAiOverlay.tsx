"use client";

import { useState } from "react";

export function RoomModeAiOverlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="i20x-room-function-layer" data-image20-room-ai="room-mode-v5">
      <button type="button" className="i20x-room-action" style={{ left: "90%", top: "80%", width: "7%", height: "10%" }} onClick={() => setOpen(true)} aria-label="開啟房內 AI" />
      {open ? (
        <div className="i20x-ai-panel" style={{ position: "absolute", right: "3%", bottom: "7%", width: "35%" }}>
          <img src="/site-assets/image20-reference/room-mode-ai-panel.png" alt="Room Mode AI Panel" />
          <button type="button" className="i20x-ai-close" onClick={() => setOpen(false)} aria-label="關閉房內 AI" />
        </div>
      ) : null}
    </div>
  );
}
