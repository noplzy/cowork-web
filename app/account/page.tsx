"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/lib/supabaseClient";
import { fetchAccountStatus, type AccountStatusResp, clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { ensureOwnPrivateSettings, ensureOwnProfile } from "@/lib/profileClient";
import {
  type PrivateProfileSettingsRow,
  type PublicProfileRow,
  PROFILE_VISIBILITY_OPTIONS,
  formatPaymentSummary,
  formatPhoneForHumans,
  normalizeHandle,
  parseTagsInput,
  tagsToInput,
} from "@/lib/socialProfile";

type Counts = {
  friends: number;
  upcomingSchedules: number;
};

export default function AccountCenterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [msg, setMsg] = useState("");

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileRow | null>(null);
  const [privateSettings, setPrivateSettings] = useState<PrivateProfileSettingsRow | null>(null);
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [counts, setCounts] = useState<Counts>({ friends: 0, upcomingSchedules: 0 });

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [visibility, setVisibility] = useState<PublicProfileRow["visibility"]>("public");
  const [acceptingFriendRequests, setAcceptingFriendRequests] = useState(true);
  const [acceptingScheduleInvites, setAcceptingScheduleInvites] = useState(true);
  const [showUpcomingSchedule, setShowUpcomingSchedule] = useState(true);
  const [isProfessionalBuddy, setIsProfessionalBuddy] = useState(false);

  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyScheduleUpdates, setNotifyScheduleUpdates] = useState(true);
  const [notifyRoomReminders, setNotifyRoomReminders] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setMsg("");

        const session = await getClientSessionSnapshot();
        if (!session) {
          router.replace("/auth/login?next=/account");
          return;
        }

        if (cancelled) return;

        setEmail(session.email);
        setUserId(session.user.id);
        setPhone(session.user.phone ?? null);

        const [profileRow, privateRow] = await Promise.all([
          ensureOwnProfile(session.user),
          ensureOwnPrivateSettings(session.user.id),
        ]);

        if (cancelled) return;

        setProfile(profileRow);
        setPrivateSettings(privateRow);

        setDisplayName(profileRow.display_name ?? "");
        setHandle(profileRow.handle ?? "");
        setAvatarUrl(profileRow.avatar_url ?? "");
        setBio(profileRow.bio ?? "");
        setTagsInput(tagsToInput(profileRow.tags));
        setVisibility(profileRow.visibility ?? "public");
        setAcceptingFriendRequests(Boolean(profileRow.accepting_friend_requests));
        setAcceptingScheduleInvites(Boolean(profileRow.accepting_schedule_invites));
        setShowUpcomingSchedule(Boolean(profileRow.show_upcoming_schedule));
        setIsProfessionalBuddy(Boolean(profileRow.is_professional_buddy));

        setNotifyFriendRequests(Boolean(privateRow.notify_friend_requests));
        setNotifyScheduleUpdates(Boolean(privateRow.notify_schedule_updates));
        setNotifyRoomReminders(Boolean(privateRow.notify_room_reminders));

        if (session.accessToken) {
          const nextStatus = await fetchAccountStatus(session.accessToken).catch(() => null);
          if (!cancelled) {
            setStatus(nextStatus);
          }
        }

        const [friendshipsResult, scheduleResult] = await Promise.all([
          supabase
            .from("friendships")
            .select("user_low,user_high")
            .or(`user_low.eq.${session.user.id},user_high.eq.${session.user.id}`),
          supabase
            .from("scheduled_room_posts")
            .select("id")
            .eq("host_user_id", session.user.id)
            .gte("start_at", new Date().toISOString()),
        ]);

        if (!cancelled) {
          setCounts({
            friends: friendshipsResult.data?.length ?? 0,
            upcomingSchedules: scheduleResult.data?.length ?? 0,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "讀取帳號中心失敗。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const publicProfileUrl = useMemo(() => (handle ? `/u/${handle}` : ""), [handle]);
  const paymentSummary = useMemo(
    () => formatPaymentSummary(privateSettings?.payment_card_brand, privateSettings?.payment_card_last4),
    [privateSettings?.payment_card_brand, privateSettings?.payment_card_last4],
  );

  async function savePublicProfile() {
    if (!userId) return;
    if (!displayName.trim()) {
      setMsg("顯示名稱不能留白。");
      return;
    }
    if (!handle.trim()) {
      setMsg("公開 ID 不能留白。");
      return;
    }

    setSavingProfile(true);
    setMsg("");

    const payload = {
      user_id: userId,
      display_name: displayName.trim().slice(0, 40),
      handle: normalizeHandle(handle),
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim() || null,
      tags: parseTagsInput(tagsInput),
      visibility,
      accepting_friend_requests: acceptingFriendRequests,
      accepting_schedule_invites: acceptingScheduleInvites,
      show_upcoming_schedule: showUpcomingSchedule,
      is_professional_buddy: isProfessionalBuddy,
    };

    const result = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    setSavingProfile(false);

    if (result.error) {
      setMsg(/handle/i.test(result.error.message) ? "這個公開 ID 已被使用或格式不正確，請換一個。" : result.error.message);
      return;
    }

    setProfile(result.data as PublicProfileRow);
    setMsg("公開個人檔案已更新。");
  }

  async function savePrivateSettings() {
    if (!userId) return;

    setSavingPrivate(true);
    setMsg("");

    const result = await supabase
      .from("user_private_profile_settings")
      .upsert(
        {
          user_id: userId,
          notify_friend_requests: notifyFriendRequests,
          notify_schedule_updates: notifyScheduleUpdates,
          notify_room_reminders: notifyRoomReminders,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    setSavingPrivate(false);

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setPrivateSettings(result.data as PrivateProfileSettingsRow);
    clearAccountStatusCache();
    setMsg("私人設定已更新。");
  }

  if (loading) {
    return (
      <main className="cc-container">
        <TopNav />
        <section className="cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在準備帳號中心</div>
            <div className="cc-muted">系統正在整理你的公開檔案、私人設定與方案資訊。</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Account Center</span>
          <p className="cc-eyebrow">帳號中心｜公開形象與私人設定分開，才不會越改越亂</p>
          <h1 className="cc-h2">這裡才是正式的帳號中心，不再把所有東西都塞進手機驗證頁。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            公開個人檔案給別人看，私人帳號設定留在自己這裡。
            這樣之後要接好友、排程、專業搭子、金流摘要與身份驗證，才不會變成同一頁的大雜燴。
          </p>

          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">方案</span>
              <div className="cc-metric-value">{status?.is_vip ? "VIP" : "FREE"}</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">本月剩餘</span>
              <div className="cc-metric-value">{status?.is_vip ? "∞" : status?.credits_remaining ?? "?"}</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">好友數</span>
              <div className="cc-metric-value">{counts.friends}</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">已排程</span>
              <div className="cc-metric-value">{counts.upcomingSchedules}</div>
            </div>
          </div>

          <div className="cc-action-row">
            {publicProfileUrl ? (
              <Link href={publicProfileUrl} className="cc-btn-primary">
                查看公開檔案
              </Link>
            ) : null}
            <Link href="/friends" className="cc-btn">
              好友與邀請
            </Link>
            <Link href="/schedule" className="cc-btn">
              房間排程板
            </Link>
            <Link href="/account/identity" className="cc-btn">
              手機驗證 / 身份綁定
            </Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">目前帳號摘要</p>
            <h2 className="cc-h2">先把重要資訊放在同一面板，不讓人找半天。</h2>
          </div>

          <div className="cc-note cc-stack-sm">
            <div><strong>Email：</strong>{email || "—"}</div>
            <div><strong>公開 ID：</strong>{profile?.handle || "—"}</div>
            <div><strong>手機：</strong>{formatPhoneForHumans(phone)}</div>
            <div><strong>付款方式摘要：</strong>{paymentSummary}</div>
            <div><strong>週期起點：</strong>{status?.month_start ?? "—"}</div>
          </div>

          <div className="cc-caption">
            付款卡摘要之後應由 PSP / webhook 寫入，不建議由前台使用者手動填完整卡號。
          </div>
        </article>
      </section>

      {msg ? <div className="cc-alert cc-alert-error cc-section">{msg}</div> : null}

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">公開個人檔案</p>
            <h2 className="cc-h2">別人看得到的，放這裡管。</h2>
          </div>

          <label className="cc-field">
            <span className="cc-field-label">顯示名稱</span>
            <input className="cc-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：Wade / 安感媽媽 / 夜讀島民" />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">公開 ID（handle）</span>
            <input className="cc-input" value={handle} onChange={(e) => setHandle(normalizeHandle(e.target.value))} placeholder="例如：wade-focus" />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">頭像網址</span>
            <input className="cc-input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">自我介紹</span>
            <textarea className="cc-input" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="介紹你平常會開什麼房、喜歡什麼節奏、希望遇到什麼樣的同行。" />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">標籤（逗號分隔）</span>
            <input className="cc-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="共工, 讀書, 家務, 育兒, 深夜陪伴" />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">可見性</span>
            <select className="cc-select" value={visibility} onChange={(e) => setVisibility(e.target.value as PublicProfileRow["visibility"])}>
              {PROFILE_VISIBILITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={acceptingFriendRequests} onChange={(e) => setAcceptingFriendRequests(e.target.checked)} />
            <span className="cc-field-label">允許別人從檔案或房內名單送出好友邀請</span>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={acceptingScheduleInvites} onChange={(e) => setAcceptingScheduleInvites(e.target.checked)} />
            <span className="cc-field-label">允許別人用排程或固定同行的方式邀請我</span>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={showUpcomingSchedule} onChange={(e) => setShowUpcomingSchedule(e.target.checked)} />
            <span className="cc-field-label">在公開檔案顯示即將到來的排程</span>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={isProfessionalBuddy} onChange={(e) => setIsProfessionalBuddy(e.target.checked)} />
            <span className="cc-field-label">先保留為「專業搭子候選」標記（未連動交易能力）</span>
          </label>

          <div className="cc-action-row">
            <button className="cc-btn-primary" type="button" disabled={savingProfile} onClick={savePublicProfile}>
              {savingProfile ? "儲存中…" : "儲存公開檔案"}
            </button>
            {publicProfileUrl ? (
              <Link href={publicProfileUrl} className="cc-btn">
                預覽公開頁
              </Link>
            ) : null}
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">私人設定</p>
            <h2 className="cc-h2">只影響你自己的提醒、安全與權益摘要。</h2>
          </div>

          <div className="cc-note cc-stack-sm">
            <div><strong>手機驗證：</strong>{phone ? "已綁定，可在身份綁定頁調整" : "尚未綁定"}</div>
            <div><strong>卡號摘要：</strong>{paymentSummary}</div>
            <div><strong>說明：</strong> 卡號摘要未來應由 PSP 寫入，這一版先只做展示落點。</div>
          </div>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={notifyFriendRequests} onChange={(e) => setNotifyFriendRequests(e.target.checked)} />
            <span className="cc-field-label">好友邀請通知</span>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={notifyScheduleUpdates} onChange={(e) => setNotifyScheduleUpdates(e.target.checked)} />
            <span className="cc-field-label">排程變更通知</span>
          </label>

          <label className="cc-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={notifyRoomReminders} onChange={(e) => setNotifyRoomReminders(e.target.checked)} />
            <span className="cc-field-label">房間提醒通知</span>
          </label>

          <div className="cc-action-row">
            <button className="cc-btn-primary" type="button" disabled={savingPrivate} onClick={savePrivateSettings}>
              {savingPrivate ? "儲存中…" : "儲存私人設定"}
            </button>
            <Link href="/account/identity" className="cc-btn">
              前往身份綁定
            </Link>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
