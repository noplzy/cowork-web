import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20PolicyProfiles.module.css";

function firstChar(value?: string | null) {
  return (value || "島").trim().slice(0, 1) || "島";
}

function publicTrustLabel(input: { email?: boolean; phone?: boolean; realName?: boolean; professional?: boolean }) {
  return [
    input.email ? "Email 登入" : null,
    input.phone ? "手機已綁定" : null,
    input.realName ? "實名審核" : null,
    input.professional ? "Professional Buddy" : null,
  ].filter(Boolean);
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const safeHandle = decodeURIComponent(handle || "").trim().replace(/^@/, "").toLowerCase();
  if (!safeHandle) notFound();

  const profileResult = await supabaseAdmin
    .from("profiles")
    .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy,public_profile_enabled,profile_visibility,public_contact_note,updated_at")
    .ilike("handle", safeHandle)
    .maybeSingle();

  if (profileResult.error || !profileResult.data || profileResult.data.public_profile_enabled === false) notFound();
  const profile = profileResult.data as any;

  const [authResult, identityResult, servicesResult, reviewResult] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(profile.user_id).catch(() => ({ data: null, error: null } as any)),
    supabaseAdmin
      .from("identity_verification_requests")
      .select("id,review_status,reviewed_at")
      .eq("user_id", profile.user_id)
      .eq("review_status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("buddy_services")
      .select("id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd,status,visibility,updated_at")
      .eq("provider_user_id", profile.user_id)
      .eq("status", "active")
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("buddy_reviews")
      .select("service_id,rating")
      .limit(200),
  ]);

  const authUser = (authResult as any)?.data?.user;
  const emailVerified = Boolean(authUser?.email && (authUser?.email_confirmed_at || authUser?.confirmed_at));
  const phoneVerified = Boolean(authUser?.phone && authUser?.phone_confirmed_at);
  const realNameVerified = Boolean((identityResult.data ?? [])[0]?.id);
  const trustLabels = publicTrustLabel({ email: emailVerified, phone: phoneVerified, realName: realNameVerified, professional: Boolean(profile.is_professional_buddy) });
  const services = servicesResult.error ? [] : servicesResult.data ?? [];
  const reviews = reviewResult.error ? [] : reviewResult.data ?? [];
  const reviewCount = reviews.length;
  const averageRating = reviewCount ? (reviews.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / reviewCount).toFixed(1) : null;

  return (
    <main className={styles.profileRoot} data-image20-dom-page="public-profile-v118-trust-surface">
      <section className={styles.profileHero}>
        <div className={styles.profileHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />
        <div className={styles.profileHeroInner}>
          <article className={styles.profileHeroCopy}>
            <div className={styles.profileIdentity}>
              <div className={styles.profileAvatar}>{firstChar(profile.display_name || profile.handle)}</div>
              <div>
                <span className="i20-kicker">Public Profile</span>
                <h1>{profile.display_name || `@${profile.handle}`}</h1>
                <p>{profile.bio || "這位島民還沒有寫公開自介。公開檔案只呈現使用者選擇公開的資訊，不揭露私人身份資料。"}</p>
                <div className={styles.profileMetaRow}>
                  <span>@{profile.handle}</span>
                  <span>{profile.profile_visibility || "public"}</span>
                  <span>{profile.is_professional_buddy ? "安感夥伴" : "島民"}</span>
                </div>
              </div>
            </div>
          </article>
          <aside className={styles.profileActionCard}>
            <span className="i20-kicker">Trust Surface</span>
            <h2>公開信任狀態</h2>
            <p>這裡只顯示平台確認過的狀態，不公開 Email、手機號碼或證件資料。</p>
            <div className="i20-chip-row">
              {trustLabels.length ? trustLabels.map((label) => <span className="i20-chip" key={label}>{label}</span>) : <span className="i20-chip">尚無公開信任標記</span>}
              {averageRating ? <span className="i20-chip">評價 {averageRating} / 5</span> : null}
            </div>
            <div className={styles.profileActionButtons}>
              <Link href="/buddies" className="i20-btn peach">探索安感夥伴</Link>
              <Link href="/contact" className="i20-btn ghost">回報 / 客服</Link>
            </div>
          </aside>
        </div>
      </section>
      <section className={styles.profileBody}>
        <div className={styles.profileBoard}>
          <article className={styles.profilePanel}>
            <span>Companion Style</span>
            <h3>公開互動狀態</h3>
            <p>{profile.public_contact_note || "公開檔案讓互動更清楚，而不是要求使用者過度展示自己。"}</p>
            <ul className={styles.profileList}>
              <li>公開暱稱：{profile.display_name || `@${profile.handle}`}</li>
              <li>標籤：{Array.isArray(profile.tags) && profile.tags.length ? profile.tags.join("、") : "尚未設定"}</li>
              <li>手機綁定：{phoneVerified ? "平台已確認" : "未公開或尚未確認"}</li>
              <li>實名審核：{realNameVerified ? "平台已確認" : "Buddies 前仍需審核"}</li>
            </ul>
            <div className={styles.profileQuote}>在安感島，公開不是暴露，而是讓可被理解的資訊恰好被看見。</div>
          </article>
          <article className={styles.profilePanel}>
            <span>Buddies Services</span>
            <h3>公開上架服務</h3>
            <p>若這位使用者有上架 Buddies 服務，會在這裡提供正式服務詳情頁。</p>
            <div className={styles.profileTileGrid}>
              {services.length ? services.map((service: any) => (
                <Link className={styles.profileTile} href={`/buddies/services/${service.id}`} key={service.id}>
                  <b>{service.title}</b>
                  <span>{service.summary}</span>
                  <span>NT${service.price_per_hour_twd}/hr｜{service.buddy_category}</span>
                </Link>
              )) : <div className={styles.profileTile}><b>目前沒有公開服務</b><span>可以先從公開房間或好友邀請開始互動。</span></div>}
            </div>
          </article>
          <article className={styles.profilePanel}>
            <span>Boundaries</span>
            <h3>平台邊界</h3>
            <p>Buddies 是有邊界、可審核、可預約的服務，不是低俗陪聊市場。</p>
            <ul className={styles.profileList}>
              <li>不公開私人 Email、手機或證件資訊。</li>
              <li>付費服務需通過手機與實名規則。</li>
              <li>爭議、退款與檢舉會進入營運審核。</li>
            </ul>
          </article>
        </div>
        <p className={styles.profileBottomNote}>公開檔案的目的，是讓互動更清楚、更安全，而不是讓人被過度展示。</p>
      </section>
      <Image20Footer />
    </main>
  );
}
