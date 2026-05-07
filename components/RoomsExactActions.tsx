"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function RoomsExactActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createRoom(category: "focus" | "life" | "share" | "hobby" = "focus") {
    if (busy) return;
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.push("/auth/login?next=/rooms");
      return;
    }

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: category === "focus" ? "安靜同行 50 分鐘" : "安感島同行空間",
          duration_minutes: 50,
          mode: "group",
          max_size: 4,
          room_category: category,
          interaction_style: category === "focus" ? "silent" : "light-chat",
          visibility: "public",
          host_note: "Image2.0 exact replica quick create",
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "建立房間失敗");
      const roomId = payload?.room?.id ?? payload?.roomId;
      router.push(roomId ? `/rooms/${roomId}` : "/rooms");
    } catch (error) {
      alert(error instanceof Error ? error.message : "建立房間失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="i20x-room-function-layer" data-image20-exact-functional-layer="rooms-v5">
      <button type="button" className="i20x-room-action" style={{ left: "7.5%", top: "42.5%", width: "11.4%", height: "5.5%" }} onClick={() => createRoom("focus")} aria-label="建立專注房間" />
      <button type="button" className="i20x-room-action" style={{ left: "20.5%", top: "42.5%", width: "11.4%", height: "5.5%" }} onClick={() => router.push("/buddies")} aria-label="找安感夥伴" />
      <button type="button" className="i20x-room-action" style={{ left: "7%", top: "78%", width: "18%", height: "16%" }} onClick={() => createRoom("focus")} aria-label="建立專注任務房" />
      <button type="button" className="i20x-room-action" style={{ left: "27%", top: "78%", width: "18%", height: "16%" }} onClick={() => createRoom("life")} aria-label="建立生活陪伴房" />
      <button type="button" className="i20x-room-action" style={{ left: "47%", top: "78%", width: "18%", height: "16%" }} onClick={() => createRoom("share")} aria-label="建立主題分享房" />
      <button type="button" className="i20x-room-action" style={{ left: "67%", top: "78%", width: "18%", height: "16%" }} onClick={() => createRoom("hobby")} aria-label="建立興趣同好房" />
    </div>
  );
}
