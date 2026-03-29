import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  type PrivateProfileSettingsRow,
  type PublicProfileRow,
  buildDefaultHandle,
  deriveDisplayName,
} from "@/lib/socialProfile";

export function makeDefaultPublicProfile(user: User) {
  const displayName = deriveDisplayName({
    email: user.email,
    user_metadata: (user as any).user_metadata ?? null,
  });
  const handleSeed =
    ((user as any).user_metadata?.preferred_username as string | undefined) ||
    ((user as any).user_metadata?.user_name as string | undefined) ||
    displayName;

  return {
    user_id: user.id,
    handle: buildDefaultHandle(user.id, handleSeed),
    display_name: displayName,
    avatar_url:
      ((user as any).user_metadata?.avatar_url as string | undefined) ||
      ((user as any).user_metadata?.picture as string | undefined) ||
      null,
    bio: null,
    tags: [] as string[],
    visibility: "public" as const,
    accepting_friend_requests: true,
    accepting_schedule_invites: true,
    show_upcoming_schedule: true,
    is_professional_buddy: false,
  };
}

export async function ensureOwnProfile(user: User) {
  const existing = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as PublicProfileRow;

  const fallback = makeDefaultPublicProfile(user);
  const inserted = await supabase.from("profiles").insert(fallback).select("*").single();

  if (!inserted.error && inserted.data) {
    return inserted.data as PublicProfileRow;
  }

  const retry = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (retry.error) throw retry.error;
  if (!retry.data) {
    throw inserted.error ?? new Error("建立個人檔案失敗");
  }
  return retry.data as PublicProfileRow;
}

export async function ensureOwnPrivateSettings(userId: string) {
  const existing = await supabase
    .from("user_private_profile_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as PrivateProfileSettingsRow;

  const inserted = await supabase
    .from("user_private_profile_settings")
    .insert({
      user_id: userId,
      notify_friend_requests: true,
      notify_schedule_updates: true,
      notify_room_reminders: true,
    })
    .select("*")
    .single();

  if (!inserted.error && inserted.data) {
    return inserted.data as PrivateProfileSettingsRow;
  }

  const retry = await supabase
    .from("user_private_profile_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (retry.error) throw retry.error;
  if (!retry.data) {
    throw inserted.error ?? new Error("建立私人設定失敗");
  }
  return retry.data as PrivateProfileSettingsRow;
}
