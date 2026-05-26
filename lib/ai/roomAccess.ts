import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export type AiRoomContext = {
  userId: string;
  email: string;
  isOwner: boolean;
  isMember: boolean;
  room: {
    id: string;
    title: string;
    created_by: string;
    duration_minutes: number;
    mode: "pair" | "group" | string;
    max_size: number;
    room_category?: string | null;
    interaction_style?: string | null;
    visibility?: string | null;
    daily_room_url?: string | null;
  };
};

export class AiRoomAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AiRoomAccessError";
    this.status = status;
  }
}

export async function getAiRoomContextFromRequest(req: Request, roomId: string): Promise<AiRoomContext> {
  if (!roomId.trim()) {
    throw new AiRoomAccessError("Missing roomId", 400);
  }

  const { userId, email } = await getAuthUserFromRequest(req);

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("id,title,created_by,duration_minutes,mode,max_size,room_category,interaction_style,visibility,daily_room_url")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    throw new AiRoomAccessError(roomError.message, 500);
  }
  if (!room?.id) {
    throw new AiRoomAccessError("Room not found", 404);
  }

  const isOwner = room.created_by === userId;
  const { data: member, error: memberError } = await supabaseAdmin
    .from("room_members")
    .select("room_id,user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    throw new AiRoomAccessError(memberError.message, 500);
  }

  const isMember = Boolean(member) || isOwner;
  if (!isMember) {
    throw new AiRoomAccessError("Not a room member", 403);
  }

  return {
    userId,
    email,
    isOwner,
    isMember,
    room: room as AiRoomContext["room"],
  };
}
