import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type PublicProfilePageProps = {
  params: Promise<{ handle: string }> | { handle: string };
};

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  tags: string[] | null;
  accepting_friend_requests: boolean;
  accepting_schedule_invites: boolean;
  show_upcoming_schedule: boolean;
  is_professional_buddy: boolean;
  visibility: "public" | "members" | "friends";
};

type ServiceRow = {
  id: string;
  title: string;
  summary: string;
  buddy_category: string;
  interaction_style: string;
  delivery_mode: string;
  price_per_hour_twd: number;
  availability_note: string | null;
};

const categoryLabels: Record<string, string> = {
  focus: "專注陪伴",
  life: "生活陪伴",
  sports: "運動健身",
  hobby: "興趣同好",
  share: "主題交流",
  support: "情感支持",
  travel: "旅行出遊",
};

const interactionLabels: Record<string, string> = {
  silent: "安靜同行",
  "light-chat": "輕聊天",
  guided: "引導型",
  "open-share": "開放分享",
};

const deliveryLabels: Record<string, string> = {
  remote: "線上",
  in_person: "線下",
  hybrid: "線上＋線下",
};

function fallbackInitial(value: string) {
  return value.trim().slice(0, 1) || "島";
}

function labelFrom(map: Record<string, string>, value: string) {
  return map[value] ?? "未分類";
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { handle } = await Promise.resolve(params);
  const normalizedHandle = decodeURIComponent(handle ?? "").trim();

  if (!normalizedHandle) {
    notFound();
  }

  const profileResult = await supabaseAdmin
    .from("profiles")
    .select(
      "user_id,handle,display_name,avatar_url,bio,tags,accepting_friend_requests,accepting_schedule_invites,show_upcoming_schedule,is_professional_buddy,visibility"
    )
    .eq("handle", normalizedHandle)
    .eq("visibility", "public")
    .maybeSingle();

  const profile = profileResult.data as ProfileRow | null;

  if (profileResult.error || !profile) {
    notFound();
  }

  const serviceResult = await supabaseAdmin
    .from("buddy_services")
    .select(
      "id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd,availability_note"
    )
    .eq("provider_user_id", profile.user_id)
    .eq("status", "active")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(3);

  const services = (serviceResult.data ?? []) as ServiceRow[];
  const tags = profile.tags ?? [];

  return (
    <main className={`i20-root ${styles.publicProfileRoot}`} data-image20-dom-page="public-profile-v12">
      <section className={styles.publicProfileHero}>
        <div className={styles.publicProfileBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.publicProfileHeroGrid}>
          <article className={styles.publicProfileIdentity}>
            <div className={styles.publicProfileAvatar}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name} />
              ) : (
                <span>{fallbackInitial(profile.display_name)}</span>
              )}
            </div>

            <div>
              <div className={styles.publicProfileMetaLine}>
                <span className="i20-kicker">Public Profile</span>
                {profile.is_professional_buddy ? <b>安感夥伴</b> : null}
              </div>
              <h1 className="i20-serif">{profile.display_name}</h1>
              <strong>@{profile.handle}</strong>
              <p>{profile.bio || "這位島民尚未公開自我介紹。"}</p>

              <div className={styles.publicProfileSignals}>
                <span>{profile.accepting_friend_requests ? "接受好友邀請" : "暫不接受好友邀請"}</span>
                <span>{profile.accepting_schedule_invites ? "接受排程邀請" : "暫不接受排程邀請"}</span>
                <span>{profile.show_upcoming_schedule ? "可顯示公開行程" : "行程暫不公開"}</span>
              </div>
            </div>
          </article>

          <aside className={styles.publicProfileActionCard}>
            <span className="i20-kicker">Connect</span>
            <h2 className="i20-serif">想和這位島民建立連結嗎？</h2>
            <p>公開檔案頁先整理可信任資訊、服務入口與後續互動區位。</p>
            <div className={styles.publicProfileActionButtons}>
              <button type="button" disabled>
                打招呼功能待開放
              </button>
              <button type="button" disabled>
                好友邀請待開放
              </button>
              <Link href="/buddies">查看 Buddies 服務</Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.publicProfileBody}>
        <article className={styles.publicProfilePanel}>
          <span className="i20-kicker">Tags</span>
          <h3 className="i20-serif">公開標籤與陪伴傾向</h3>
          <div className={styles.publicProfileTagRow}>
            {tags.length ? (
              tags.map((tag) => <span key={tag}>{tag}</span>)
            ) : (
              <span>尚未公開標籤</span>
            )}
          </div>
          <p>標籤用來協助理解互動氣質，不代表平台對個人做出完整分類。</p>
        </article>

        <article className={styles.publicProfilePanel}>
          <span className="i20-kicker">Services</span>
          <h3 className="i20-serif">公開 Buddies 服務</h3>
          <div className={styles.publicProfileServiceList}>
            {services.length ? (
              services.map((service) => (
                <div className={styles.publicProfileServiceCard} key={service.id}>
                  <div>
                    <b>{service.title}</b>
                    <p>{service.summary}</p>
                  </div>
                  <div>
                    <span>{labelFrom(categoryLabels, service.buddy_category)}</span>
                    <span>{labelFrom(interactionLabels, service.interaction_style)}</span>
                    <span>{labelFrom(deliveryLabels, service.delivery_mode)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.publicProfileEmpty}>
                <b>目前沒有公開服務。</b>
                <p>若這位島民日後上架 Buddies 服務，會集中顯示於此。</p>
              </div>
            )}
          </div>
        </article>

        <article className={styles.publicProfilePanel}>
          <span className="i20-kicker">Schedule</span>
          <h3 className="i20-serif">近期公開房間 / 時段</h3>
          <div className={styles.publicProfileEmpty}>
            <b>公開排程區位已保留。</b>
            <p>後續可接公開排程資料，顯示可預約房間與可見時間。</p>
          </div>
        </article>

        <article className={styles.publicProfilePanel}>
          <span className="i20-kicker">Safety</span>
          <h3 className="i20-serif">信任與安全</h3>
          <div className={styles.publicProfileSafetyList}>
            <span>只顯示公開可見的個人檔案</span>
            <span>不展示私人聯絡資訊</span>
            <span>服務與互動入口會依權限逐步開放</span>
          </div>
          <Link href="/terms">查看平台規則 →</Link>
        </article>
      </section>

      <Image20Footer />
    </main>
  );
}
