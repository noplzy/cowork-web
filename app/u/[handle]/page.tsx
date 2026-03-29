"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/lib/supabaseClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import {
  type PublicProfileRow,
  formatDateTimeRange,
  labelForInteractionStyle,
  labelForRoomCategory,
  type InteractionStyle,
  type RoomCategory,
} from "@/lib/socialProfile";

type ScheduledRoomPostRow = {
  id: string;
  host_user_id: string;
  title: string;
  room_category: RoomCategory;
  interaction_style: InteractionStyle;
  visibility: string;
  start_at: string;
  end_at: string;
  seat_limit: number;
  note: string | null;
};

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = params?.handle;

  const [loading, setLoading] = useState(true);
  const [viewerLoggedIn, setViewerLoggedIn] = useState(false);
  const [profile, setProfile] = useState<PublicProfileRow | null>(null);
  const [posts, setPosts] = useState<ScheduledRoomPostRow[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const session = await getClientSessionSnapshot().catch(() => null);
        if (!cancelled) {
          setViewerLoggedIn(Boolean(session));
        }

        if (!handle) {
          if (!cancelled) setMsg("找不到指定的公開 ID。");
          return;
        }

        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("handle", handle)
          .maybeSingle();

        if (result.error) throw result.error;
        if (!result.data) {
          if (!cancelled) setMsg("找不到這位使用者，或這份檔案目前沒有對外公開。");
          return;
        }

        const profileRow = result.data as PublicProfileRow;
        if (cancelled) return;

        setProfile(profileRow);

        if (!profileRow.show_upcoming_schedule) {
          setPosts([]);
          return;
        }

        const postResult = await supabase
          .from("scheduled_room_posts")
          .select("id,host_user_id,title,room_category,interaction_style,visibility,start_at,end_at,seat_limit,note")
          .eq("host_user_id", profileRow.user_id)
          .eq("visibility", "public")
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(6);

        if (postResult.error) throw postResult.error;
        if (!cancelled) {
          setPosts((postResult.data ?? []) as ScheduledRoomPostRow[]);
        }
      } catch (error) {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "讀取公開個人檔案失敗。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <main className="cc-container">
        <TopNav />
        <section className="cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在準備公開檔案</div>
            <div className="cc-muted">系統正在讀取這位島民的公開資料。</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Public Profile</span>
          <p className="cc-eyebrow">公開個人檔案｜先讓別人知道你是誰、會開什麼房、喜歡什麼節奏</p>

          {profile ? (
            <>
              <div className="cc-card-row">
                <div>
                  <h1 className="cc-h2">{profile.display_name}</h1>
                  <div className="cc-caption">@{profile.handle}</div>
                </div>
                <span className={profile.is_professional_buddy ? "cc-pill-success" : "cc-pill-soft"}>
                  {profile.is_professional_buddy ? "專業搭子候選" : "一般島民"}
                </span>
              </div>

              {profile.bio ? (
                <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
                  {profile.bio}
                </p>
              ) : (
                <div className="cc-note">這位使用者還沒有填寫自我介紹。</div>
              )}

              {profile.tags?.length ? (
                <div className="cc-page-meta">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="cc-pill-soft">{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="cc-note cc-stack-sm">
                <div><strong>好友邀請：</strong>{profile.accepting_friend_requests ? "目前願意接收" : "目前關閉"}</div>
                <div><strong>排程邀請：</strong>{profile.accepting_schedule_invites ? "目前可接受" : "目前關閉"}</div>
                <div><strong>排程公開：</strong>{profile.show_upcoming_schedule ? "會顯示即將到來的排程" : "目前不公開排程"}</div>
              </div>

              <div className="cc-action-row">
                {viewerLoggedIn ? (
                  <Link href={`/friends?search=${encodeURIComponent(profile.handle)}`} className="cc-btn-primary">
                    從好友頁加好友
                  </Link>
                ) : (
                  <Link href="/auth/login" className="cc-btn-primary">
                    登入後加好友
                  </Link>
                )}
                <Link href="/schedule" className="cc-btn">查看排程板</Link>
              </div>
            </>
          ) : (
            <div className="cc-alert cc-alert-error">{msg || "找不到這份公開檔案。"}</div>
          )}
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">設計目的</p>
            <h2 className="cc-h2">公開檔案不是後台，而是信任頁。</h2>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>公開檔案處理：顯示名稱、公開 ID、簡介、標籤、是否可加好友。</div>
            <div>私人帳號中心處理：手機驗證、通知設定、方案 / 額度、支付摘要。</div>
            <div>好友與私訊不要直接塞進 Room 主畫面，先把社交骨架分層。</div>
          </div>
          <div className="cc-caption">
            這樣後續接排程、專業搭子、公開名單與房內互動時，才不會把每一頁都改成垃圾抽屜。
          </div>
        </article>
      </section>

      {msg && !profile ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      {profile?.show_upcoming_schedule ? (
        <section className="cc-section">
          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">即將到來的排程</p>
              <h2 className="cc-h2">先看這位使用者接下來打算開什麼房。</h2>
            </div>

            {posts.length === 0 ? (
              <div className="cc-note">目前沒有對外公開的即將到來排程。</div>
            ) : (
              <div className="cc-stack-sm">
                {posts.map((post) => (
                  <div key={post.id} className="cc-card cc-card-soft cc-stack-sm">
                    <div className="cc-h3">{post.title}</div>
                    <div className="cc-caption">
                      {labelForRoomCategory(post.room_category)} · {labelForInteractionStyle(post.interaction_style)}
                    </div>
                    <div className="cc-note cc-stack-sm">
                      <div><strong>時間：</strong>{formatDateTimeRange(post.start_at, post.end_at)}</div>
                      <div><strong>名額：</strong>{post.seat_limit} 人</div>
                    </div>
                    {post.note ? <div className="cc-muted" style={{ lineHeight: 1.75 }}>{post.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
