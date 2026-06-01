import type { ReactNode } from "react";
import { RoomLifecycleBridge } from "@/components/rooms/RoomLifecycleBridge";

export default function RoomDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RoomLifecycleBridge />
      {children}
    </>
  );
}
