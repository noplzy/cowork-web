import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20EditorialPages.module.css";

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

function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
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
  const tags = (profile.tags ?? []).slice(0, 6);

  const styleSignals = [
    {
      code: "友",
      title: profile.accepting_friend_requests ? "接受好友邀請" : "暫不接受好友邀請",
      body: profile.accepting_friend_requests
        ? "公開檔案已開放被發現，後續邀請流程會依功能狀態提供。"
        : "這位島民選擇保留距離，公開頁不代表可任意靠近。",
    },
    {
      code: "排",
      title: profile.accepting_schedule_invites ? "接受排程邀請" : "暫不接受排程邀請",
      body: profile.accepting_schedule_invites
        ? "可保留未來排程互動空間，是否顯示依公開狀態而定。"
        : "目前不開放外部排程邀請。",
    },
    {
      code: "公",
      title: profile.show_upcoming_schedule ? "可顯示公開時段" : "不公開近期時段",
      body: profile.show_upcoming_schedule
        ? "若有可展示排程，會集中於公開頁的時段區。"
        : "這位島民選擇不在公開頁呈現行程。",
    },
  ] as const;

  return (
    <main className={styles.profilePage} data-image20-dom-page="public-profile-template-v13">
      <section className={styles.profileHero}>
        <div className={styles.profileHeroMedia} aria-hidden="true" />
        <Image20TopNav />

        <div className={styles.profileHeroInner}>
          <div className={styles.profilePortrait}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} />
            ) : (
              <span>{fallbackInitial(profile.display_name)}</span>
            )}
            <div className={styles.profileOnlineBadge}>
              <i className={styles.profileStatusDot} aria-hidden="true" />
              公開頁
            </div>
          </div>

          <article className={styles.profileIdentity}>
            <div className={styles.profileMetaRow}>
              <span className="i20-kicker">Public Profile</span>
              {profile.is_professional_buddy ? (
                <span className={styles.profileBuddyBadge}>安感夥伴</span>
              ) : null}
            </div>

            <h1 className="i20-serif">{profile.display_name}</h1>
            <strong className={styles.profileHandle}>@{profile.handle}</strong>
            <p className={styles.profileLead}>
              {profile.bio || "這位島民尚未公開自我介紹，但仍保留一個被安靜理解的入口。"}
            </p>

            <div className={styles.profileSignalRow}>
              <span>{profile.accepting_friend_requests ? "可接受好友邀請" : "暫不接受好友邀請"}</span>
              <span>{profile.accepting_schedule_invites ? "可接受排程邀請" : "暫不接受排程邀請"}</span>
              <span>{profile.show_upcoming_schedule ? "公開時段可見" : "行程不公開"}</span>
            </div>

            <div className={styles.profileTrustCard}>
              <b>信任與安全</b>
              <span>公開頁只顯示對方願意公開的資訊，不展示私人聯絡方式與非公開內容。</span>
            </div>
          </article>

          <aside className={styles.profileActionCard}>
            <span className="i20-kicker">Connect</span>
            <h2 className="i20-serif">想更了解這位島民？</h2>
            <p>
              先從公開服務、同行空間與平台規則理解彼此，
              不把公開檔案變成無邊界的社交壓力。
            </p>

            <div className={styles.profileActions}>
              <Link href="#public-services">查看公開服務</Link>
              <Link href="/rooms">探索同行空間</Link>
              <Link href="/terms">查看平台規則</Link>
            </div>

            <span className={styles.profilePrivacyNote}>
              安感島重視隱私；公開頁不是私人訊息通道。
            </span>
          </aside>
        </div>
      </section>

      <section className={styles.profileBody}>
        <article className={styles.profileBodyPanel}>
          <span className="i20-kicker">Public Tags</span>
          <h3 className="i20-serif">公開標籤與擅長主題</h3>
          <p className={styles.profilePanelLead}>
            這些標籤用來幫助理解風格，不代表對個人做完整分類。
          </p>

          <div className={styles.profileTileGrid}>
            {tags.length ? (
              tags.map((tag) => (
                <div className={styles.profileTile} key={tag}>
                  <b>{tag}</b>
                  <span>公開標籤</span>
                </div>
              ))
            ) : (
              <div className={styles.profileTile}>
                <b>尚未公開</b>
                <span>目前沒有可展示標籤</span>
              </div>
            )}
          </div>

          <div className={styles.profileQuietNote}>
            <b>不公開，也是一種設定。</b>
            <span>公開頁會尊重個人選擇，不補寫沒有被公開的資訊。</span>
          </div>
        </article>

        <article className={styles.profileBodyPanel}>
          <span className="i20-kicker">Companion Style</span>
          <h3 className="i20-serif">陪伴與互動風格</h3>
          <p className={styles.profilePanelLead}>
            用公開設定整理彼此距離，而不是用過度資訊堆出熟悉感。
          </p>

          <div className={styles.profileStyleList}>
            {styleSignals.map((item) => (
              <div className={styles.profileStyleItem} key={item.title}>
                <em>{item.code}</em>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.profileQuote}>
            <b>公開自介</b>
            <span>{profile.bio || "這位島民尚未公開自介。"}</span>
          </div>
        </article>

        <article className={styles.profileBodyPanel}>
          <span className="i20-kicker">Schedule</span>
          <h3 className="i20-serif">近期公開房間 / 時段</h3>
          <p className={styles.profilePanelLead}>
            只有公開可見的排程，才應該出現在這個位置。
          </p>

          <div className={styles.profileScheduleList}>
            {profile.show_upcoming_schedule ? (
              <div className={styles.profileScheduleCard}>
                <b>目前沒有可展示的公開時段。</b>
                <span>這位島民允許公開時段呈現；若後續有排程，會在此整理。</span>
              </div>
            ) : (
              <div className={styles.profileScheduleCard}>
                <b>行程目前不公開。</b>
                <span>安感島尊重使用者的公開設定，不會補展示未授權內容。</span>
              </div>
            )}
          </div>

          <Link className={styles.profileInlineLink} href="/rooms">
            前往同行空間 →
          </Link>
        </article>

        <aside className={styles.profileServiceAside} id="public-services">
          <span className="i20-kicker">Buddies Services</span>
          <h3 className="i20-serif">公開 Buddies 服務</h3>
          <p>若這位島民有公開上架的服務，會優先整理在這裡。</p>

          <div className={styles.profileServiceList}>
            {services.length ? (
              services.map((service) => (
                <article className={styles.profileServiceCard} key={service.id}>
                  <div>
                    <b>{service.title}</b>
                    <span>{service.summary}</span>
                    <strong>{formatTwd(service.price_per_hour_twd)} / 小時</strong>
                  </div>

                  <div>
                    <em>{labelFrom(categoryLabels, service.buddy_category)}</em>
                    <em>{labelFrom(interactionLabels, service.interaction_style)}</em>
                    <em>{labelFrom(deliveryLabels, service.delivery_mode)}</em>
                  </div>
                </article>
              ))
            ) : (
              <article className={styles.profileServiceCard}>
                <div>
                  <b>目前沒有公開服務。</b>
                  <span>這位島民尚未公開上架 Buddies 服務。</span>
                </div>
              </article>
            )}
          </div>

          <div className={styles.profileHelperCard}>
            <b>想理解安感夥伴？</b>
            <span>可以先回到 Buddies 市集，查看正式公開的服務卡。</span>
            <Link className={styles.profileInlineLink} href="/buddies">
              前往安感夥伴 →
            </Link>
          </div>
        </aside>
      </section>

      <div className={styles.profileBottomSignature}>
        安感島 Calm&amp;Co —— 讓每一次公開，都保留安全與分寸。
      </div>

      <Image20Footer />
    </main>
  );
}
