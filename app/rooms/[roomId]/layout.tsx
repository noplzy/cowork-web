import type { ReactNode } from "react";
import { RoomLifecycleBridge } from "@/components/rooms/RoomLifecycleBridge";
import { RoomOperationalDock } from "@/components/rooms/RoomOperationalDock";

export default function RoomDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RoomLifecycleBridge />
      <RoomOperationalDock />
      {children}
    </>
  );
}
