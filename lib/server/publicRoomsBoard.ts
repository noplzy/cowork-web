import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  InteractionStyle,
  PublicProfileRow,
  RoomCategory,
  ScheduleVisibility,
} from "@/lib/socialProfile";

export type PublicRoomBoardRow = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
  created_by: string;
  room_category?: RoomCategory | null;
  interaction_style?: InteractionStyle | null;
  visibility?: ScheduleVisibility | null;
  host_note?: string | null;
  invite_code?: string | null;
};

export type PublicScheduledRoomPostRow = {
  id: string;
  host_user_id: string;
  title: string;
  room_category: RoomCategory;
  interaction_style: InteractionStyle;
  visibility: ScheduleVisibility;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  seat_limit: number;
  note: string | null;
  invite_code?: string | null;
};

export type PublicRoomsBoardSnapshot = {
  rooms: PublicRoomBoardRow[];
  schedulePosts: PublicScheduledRoomPostRow[];
  hostProfiles: Record<string, PublicProfileRow>;
  generatedAt: string;
  cacheState: "cached" | "fresh";
  buildTag: string;
};

const PUBLIC_ROOMS_BOARD_REVALIDATE_SECONDS = 60;
const PUBLIC_ROOMS_BOARD_BUILD_TAG = "2026-04-17-public-rooms-board-cache-v1";

async function fetchPublicRoomsBoardFromDb(
  cacheState: "cached" | "fresh"
): Promise<PublicRoomsBoardSnapshot> {
  const publicVisibilityFilter = "visibility.eq.public,visibility.is.null";

  const [roomsResult, schedulePostsResult] = await Promise.all([
    supabaseAdmin
      .from("rooms")
      .select(
        "id,title,duration_minutes,mode,max_size,created_at,created_by,room_category,interaction_style,visibility,host_note,invite_code"
      )
      .or(publicVisibilityFilter)
      .order("created_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("scheduled_room_posts")
      .select("*")
      .or(publicVisibilityFilter)
      .gt("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(30),
  ]);

  if (roomsResult.error) {
    throw new Error(roomsResult.error.message);
  }

  if (schedulePostsResult.error) {
    throw new Error(schedulePostsResult.error.message);
  }

  const rooms = (roomsResult.data ?? []) as PublicRoomBoardRow[];
  const schedulePosts = (schedulePostsResult.data ?? []) as PublicScheduledRoomPostRow[];

  const hostIds = Array.from(new Set(schedulePosts.map((item) => item.host_user_id).filter(Boolean)));
  let hostProfiles: Record<string, PublicProfileRow> = {};

  if (hostIds.length > 0) {
    const profilesResult = await supabaseAdmin.from("profiles").select("*").in("user_id", hostIds);
    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }

    hostProfiles = Object.fromEntries(
      ((profilesResult.data ?? []) as PublicProfileRow[]).map((item) => [item.user_id, item])
    );
  }

  return {
    rooms,
    schedulePosts,
    hostProfiles,
    generatedAt: new Date().toISOString(),
    cacheState,
    buildTag: PUBLIC_ROOMS_BOARD_BUILD_TAG,
  };
}

const getCachedPublicRoomsBoard = unstable_cache(
  async () => fetchPublicRoomsBoardFromDb("cached"),
  ["public-rooms-board-cache-v1"],
  {
    revalidate: PUBLIC_ROOMS_BOARD_REVALIDATE_SECONDS,
    tags: ["public-rooms-board"],
  }
);

export async function getPublicRoomsBoardSnapshot(options?: {
  fresh?: boolean;
}): Promise<PublicRoomsBoardSnapshot> {
  if (options?.fresh) {
    return fetchPublicRoomsBoardFromDb("fresh");
  }

  return getCachedPublicRoomsBoard();
}

export const publicRoomsBoardCacheConfig = {
  revalidateSeconds: PUBLIC_ROOMS_BOARD_REVALIDATE_SECONDS,
  staleWhileRevalidateSeconds: 300,
  buildTag: PUBLIC_ROOMS_BOARD_BUILD_TAG,
};
