"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/lib/supabaseClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { ensureOwnProfile } from "@/lib/profileClient";
import { type PublicProfileRow, sortFriendPair, tagsToInput } from "@/lib/socialProfile";

type FriendRequestRow = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
};

type FriendshipRow = {
  user_low: string;
  user_high: string;
  created_at: string;
};

function FriendsPageFallback() {
  return (
    <main className="cc-container">
      <TopNav />
      <section className="cc-card cc-empty-state">
        <div className="cc-stack-sm">
          <div className="cc-h3">正在整理好友與邀請</div>
          <div className="cc-muted">系統正在準備好友頁內容。</div>
        </div>
      </section>
    </main>
  );
}

function FriendsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [ownProfile, setOwnProfile] = useState<PublicProfileRow | null>(null);

  const [incomingRequests, setIncomingRequests] = useState<FriendRequestRow[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestRow[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, PublicProfileRow>>({});
  const [requestProfiles, setRequestProfiles] = useState<Record<string, PublicProfileRow>>({});

  const initialSearch = useMemo(() => searchParams.get("search") || "", [searchParams]);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfileRow[]>([]);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  async function runSearch(rawKeyword?: string, currentUserId?: string) {
    const keyword = (rawKeyword ?? searchInput).trim();
    const currentId = currentUserId || userId;

    if (!keyword) {
      setSearchResults([]);
      return;
    }

    const result = await supabase
      .from("profiles")
      .select("*")
      .or(`handle.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
      .neq("user_id", currentId)
      .in("visibility", ["public", "members"])
      .eq("accepting_friend_requests", true)
      .limit(8);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setSearchResults((result.data ?? []) as PublicProfileRow[]);
  }

  async function loadAll(nextUserId: string, nextEmail: string) {
    try {
      setLoading(true);
      setMsg("");

      const session = await getClientSessionSnapshot();
      if (!session) {
        router.replace("/auth/login?next=/friends");
        return;
      }

      setEmail(nextEmail || session.email);
      setUserId(nextUserId || session.user.id);

      const profileRow = await ensureOwnProfile(session.user);
      setOwnProfile(profileRow);

      const [incomingResult, outgoingResult, friendshipsResult] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("*")
          .eq("addressee_user_id", session.user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("friend_requests")
          .select("*")
          .eq("requester_user_id", session.user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("friendships")
          .select("*")
          .or(`user_low.eq.${session.user.id},user_high.eq.${session.user.id}`)
          .order("created_at", { ascending: false }),
      ]);

      if (incomingResult.error) throw incomingResult.error;
      if (outgoingResult.error) throw outgoingResult.error;
      if (friendshipsResult.error) throw friendshipsResult.error;

      const incomingRows = (incomingResult.data ?? []) as FriendRequestRow[];
      const outgoingRows = (outgoingResult.data ?? []) as FriendRequestRow[];
      const friendshipRows = (friendshipsResult.data ?? []) as FriendshipRow[];

      const otherFriendIds = friendshipRows.map((item) =>
        item.user_low === session.user.id ? item.user_high : item.user_low,
      );

      const requestUserIds = Array.from(
        new Set([
          ...incomingRows.map((item) => item.requester_user_id),
          ...outgoingRows.map((item) => item.addressee_user_id),
        ]),
      );

      let profileMap: Record<string, PublicProfileRow> = {};
      let requestProfileMap: Record<string, PublicProfileRow> = {};

      if (otherFriendIds.length > 0) {
        const friendProfileResult = await supabase.from("profiles").select("*").in("user_id", otherFriendIds);
        if (friendProfileResult.error) throw friendProfileResult.error;
        profileMap = Object.fromEntries(
          ((friendProfileResult.data ?? []) as PublicProfileRow[]).map((item) => [item.user_id, item]),
        );
      }

      if (requestUserIds.length > 0) {
        const requestProfileResult = await supabase.from("profiles").select("*").in("user_id", requestUserIds);
        if (requestProfileResult.error) throw requestProfileResult.error;
        requestProfileMap = Object.fromEntries(
          ((requestProfileResult.data ?? []) as PublicProfileRow[]).map((item) => [item.user_id, item]),
        );
      }

      setIncomingRequests(incomingRows);
      setOutgoingRequests(outgoingRows);
      setFriendships(friendshipRows);
      setFriendProfiles(profileMap);
      setRequestProfiles(requestProfileMap);

      if (initialSearch.trim()) {
        await runSearch(initialSearch.trim(), session.user.id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await getClientSessionSnapshot();
        if (!session) {
          router.replace("/auth/login?next=/friends");
          return;
        }
        if (cancelled) return;
        await loadAll(session.user.id, session.email);
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          setMsg(error instanceof Error ? error.message : "讀取好友頁失敗。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, initialSearch]);

  async function sendFriendRequest(target: PublicProfileRow) {
    if (!userId) return;

    setBusy(true);
    setMsg("");

    const existingResult = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(requester_user_id.eq.${userId},addressee_user_id.eq.${target.user_id}),and(requester_user_id.eq.${target.user_id},addressee_user_id.eq.${userId})`,
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingResult.error) {
      setBusy(false);
      setMsg(existingResult.error.message);
      return;
    }

    const existing = (existingResult.data ?? [])[0] as FriendRequestRow | undefined;
    if (existing?.status === "pending") {
      setBusy(false);
      setMsg(
        existing.requester_user_id === userId
          ? "你已經送出過好友邀請了。"
          : "對方已經先送出邀請，你可以直接在上方接受。",
      );
      return;
    }

    const friendshipExists = friendships.some((item) => [item.user_low, item.user_high].includes(target.user_id));
    if (friendshipExists) {
      setBusy(false);
      setMsg("你們已經是好友。");
      return;
    }

    const insertResult = await supabase.from("friend_requests").insert({
      requester_user_id: userId,
      addressee_user_id: target.user_id,
      status: "pending",
    });

    setBusy(false);

    if (insertResult.error) {
      setMsg(insertResult.error.message);
      return;
    }

    setMsg(`已送出好友邀請給 ${target.display_name}。`);
    await loadAll(userId, email);
  }

  async function acceptRequest(request: FriendRequestRow) {
    setBusy(true);
    setMsg("");

    const pair = sortFriendPair(request.requester_user_id, request.addressee_user_id);

    const [updateResult, friendshipResult] = await Promise.all([
      supabase.from("friend_requests").update({ status: "accepted" }).eq("id", request.id),
      supabase.from("friendships").upsert(pair, { onConflict: "user_low,user_high" }),
    ]);

    setBusy(false);

    if (updateResult.error) {
      setMsg(updateResult.error.message);
      return;
    }

    if (friendshipResult.error) {
      setMsg(friendshipResult.error.message);
      return;
    }

    setMsg("已加入好友。");
    await loadAll(userId, email);
  }

  async function updateRequestStatus(requestId: string, status: "declined" | "cancelled") {
    setBusy(true);
    setMsg("");

    const result = await supabase.from("friend_requests").update({ status }).eq("id", requestId);

    setBusy(false);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setMsg(status === "declined" ? "已略過這筆邀請。" : "已取消邀請。");
    await loadAll(userId, email);
  }

  const friendCards = useMemo(() => {
    return friendships.map((item) => {
      const otherId = item.user_low === userId ? item.user_high : item.user_low;
      return {
        friendship: item,
        profile: friendProfiles[otherId],
      };
    });
  }, [friendProfiles, friendships, userId]);

  if (loading) {
    return <FriendsPageFallback />;
  }

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Friends</span>
          <p className="cc-eyebrow">好友骨架｜先把邀請、接受與公開檔案打通，不把房間頁變成 Discord 分身</p>
          <h1 className="cc-h2">好友關係先做乾淨，再談私訊與重社群。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            這一版先把好友邀請、好友名單與公開檔案打通。
            房內私訊、未讀訊息、重社群牆都先不插隊，避免把 Rooms 主線一起拖垮。
          </p>

          <div className="cc-note cc-stack-sm">
            <div>
              <strong>你的公開 ID：</strong>
              {ownProfile?.handle || "—"}
            </div>
            <div>
              <strong>可被搜尋：</strong>
              {ownProfile?.accepting_friend_requests ? "是" : "否"}
            </div>
            <div>
              <strong>公開檔案：</strong>
              {ownProfile?.handle ? `/u/${ownProfile.handle}` : "—"}
            </div>
          </div>

          <div className="cc-action-row">
            {ownProfile?.handle ? <Link href={`/u/${ownProfile.handle}`} className="cc-btn-primary">查看公開檔案</Link> : null}
            <Link href="/account" className="cc-btn">回帳號中心</Link>
            <Link href="/rooms" className="cc-btn">回同行空間</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">搜尋公開檔案</p>
            <h2 className="cc-h2">先用公開 ID 或顯示名稱找人。</h2>
          </div>

          <div className="cc-action-row" style={{ alignItems: "stretch" }}>
            <input
              className="cc-input"
              style={{ flex: 1, minWidth: 220 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜尋 handle 或顯示名稱"
            />
            <button className="cc-btn-primary" type="button" disabled={busy} onClick={() => void runSearch()}>
              搜尋
            </button>
          </div>

          <div className="cc-caption">只會顯示允許公開 / 會員可見，且目前願意接收好友邀請的檔案。</div>

          <div className="cc-stack-sm">
            {searchResults.length === 0 ? (
              <div className="cc-note">輸入公開 ID 或顯示名稱後搜尋。若你是從別人的檔案進來，也可直接在那邊加好友。</div>
            ) : (
              searchResults.map((item) => (
                <div key={item.user_id} className="cc-card cc-card-soft cc-stack-sm">
                  <div className="cc-card-row">
                    <div>
                      <div className="cc-h3">{item.display_name}</div>
                      <div className="cc-caption">@{item.handle}</div>
                    </div>
                    <div className="cc-action-row" style={{ marginTop: 0 }}>
                      <Link href={`/u/${item.handle}`} className="cc-btn">查看檔案</Link>
                      <button className="cc-btn-primary" type="button" disabled={busy} onClick={() => void sendFriendRequest(item)}>
                        加好友
                      </button>
                    </div>
                  </div>

                  {item.bio ? <div className="cc-muted" style={{ lineHeight: 1.75 }}>{item.bio}</div> : null}
                  {item.tags?.length ? <div className="cc-caption">{tagsToInput(item.tags)}</div> : null}
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">收到的邀請</p>
            <h2 className="cc-h2">先處理對方送來的好友邀請。</h2>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="cc-note">目前沒有新的好友邀請。</div>
          ) : (
            incomingRequests.map((request) => (
              <div key={request.id} className="cc-card cc-card-soft cc-stack-sm">
                <div className="cc-caption">
                  來自：{requestProfiles[request.requester_user_id]?.display_name || `使用者 ${request.requester_user_id.slice(0, 8)}…`}
                  {requestProfiles[request.requester_user_id]?.handle ? ` · @${requestProfiles[request.requester_user_id]?.handle}` : ""}
                </div>
                <div className="cc-action-row">
                  <button className="cc-btn-primary" type="button" disabled={busy} onClick={() => void acceptRequest(request)}>
                    接受
                  </button>
                  <button className="cc-btn" type="button" disabled={busy} onClick={() => void updateRequestStatus(request.id, "declined")}>
                    略過
                  </button>
                </div>
              </div>
            ))
          )}
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">已送出的邀請</p>
            <h2 className="cc-h2">避免同一個人重複送很多次。</h2>
          </div>

          {outgoingRequests.length === 0 ? (
            <div className="cc-note">你目前沒有待回覆的好友邀請。</div>
          ) : (
            outgoingRequests.map((request) => (
              <div key={request.id} className="cc-card cc-card-soft cc-stack-sm">
                <div className="cc-caption">
                  送往：{requestProfiles[request.addressee_user_id]?.display_name || `使用者 ${request.addressee_user_id.slice(0, 8)}…`}
                  {requestProfiles[request.addressee_user_id]?.handle ? ` · @${requestProfiles[request.addressee_user_id]?.handle}` : ""}
                </div>
                <div className="cc-action-row">
                  <button className="cc-btn" type="button" disabled={busy} onClick={() => void updateRequestStatus(request.id, "cancelled")}>
                    取消邀請
                  </button>
                </div>
              </div>
            ))
          )}
        </article>
      </section>

      <section className="cc-section">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">好友名單</p>
            <h2 className="cc-h2">之後固定同行、好友排程、邀請制房間都會靠這裡。</h2>
          </div>

          {friendCards.length === 0 ? (
            <div className="cc-note">目前還沒有好友。先從公開檔案與房間互動建立最小社交骨架。</div>
          ) : (
            <div className="cc-grid-2">
              {friendCards.map(({ friendship, profile }) => {
                const otherId = friendship.user_low === userId ? friendship.user_high : friendship.user_low;
                return (
                  <div key={`${friendship.user_low}-${friendship.user_high}`} className="cc-card cc-card-soft cc-stack-sm">
                    <div>
                      <div className="cc-h3">{profile?.display_name || "未完成檔案的使用者"}</div>
                      <div className="cc-caption">{profile?.handle ? `@${profile.handle}` : otherId.slice(0, 8)}</div>
                    </div>

                    {profile?.bio ? <div className="cc-muted" style={{ lineHeight: 1.75 }}>{profile.bio}</div> : null}
                    {profile?.tags?.length ? <div className="cc-caption">{tagsToInput(profile.tags)}</div> : null}

                    <div className="cc-action-row">
                      {profile?.handle ? <Link href={`/u/${profile.handle}`} className="cc-btn-primary">查看檔案</Link> : null}
                      <Link href="/rooms" className="cc-btn">去同行空間</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<FriendsPageFallback />}>
      <FriendsPageContent />
    </Suspense>
  );
}
