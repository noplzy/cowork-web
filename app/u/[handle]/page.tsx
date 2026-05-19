import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20PolicyProfiles.module.css";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const safeHandle = decodeURIComponent(handle || "islander");

  return (
    <main className={styles.profileRoot} data-image20-dom-page="public-profile-v12-template-aligned">
      <section className={styles.profileHero}>
        <div className={styles.profileHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.profileHeroInner}>
          <article className={styles.profileHeroCopy}>
            <div className={styles.profileIdentity}>
              <div className={styles.profileAvatar}>島</div>

              <div>
                <span className="i20-kicker">Public Profile</span>
                <h1>@{safeHandle}</h1>
                <p>
                  公開檔案是一張安靜可信的名片。
                  這裡整理對外可見的陪伴風格、房間偏好與公開互動入口，
                  讓每一次接觸都更容易理解。
                </p>
                <div className={styles.profileMetaRow}>
                  <span>安感島公開檔案</span>
                  <span>可見性依個人設定</span>
                  <span>低壓力互動</span>
                </div>
              </div>
            </div>
          </article>

          <aside className={styles.profileActionCard}>
            <span className="i20-kicker">Connect</span>
            <h2>想更了解這位島民？</h2>
            <p>
              好友邀請、安感夥伴與公開排程會在適當條件下呈現；
              你也可以先從目前可用的入口開始。
            </p>
            <div className={styles.profileActionButtons}>
              <Link href="/friends" className="i20-btn peach">
                前往好友頁
              </Link>
              <Link href="/buddies" className="i20-btn ghost">
                探索安感夥伴
              </Link>
              <Link href="/contact" className="i20-btn ghost">
                回報 / 客服
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.profileBody}>
        <div className={styles.profileBoard}>
          <article className={styles.profilePanel}>
            <span>Room Preferences</span>
            <h3>偏好的陪伴方式</h3>
            <p>公開偏好會協助他人理解互動節奏，而不是逼人立刻表現。</p>
            <div className={styles.profileTileGrid}>
              <div className={styles.profileTile}>
                <b>專注任務</b>
                <span>一起把重要的事穩穩完成。</span>
              </div>
              <div className={styles.profileTile}>
                <b>生活陪伴</b>
                <span>讓日常的片段不那麼孤單。</span>
              </div>
              <div className={styles.profileTile}>
                <b>主題分享</b>
                <span>有想法時，找到可交流的人。</span>
              </div>
              <div className={styles.profileTile}>
                <b>興趣同好</b>
                <span>把相近的喜好慢慢靠近。</span>
              </div>
            </div>
          </article>

          <article className={styles.profilePanel}>
            <span>Companion Style</span>
            <h3>公開互動狀態</h3>
            <p>這個版位會承接公開自介、互動風格與平台信任提示。</p>
            <ul className={styles.profileList}>
              <li>公開暱稱：@{safeHandle}</li>
              <li>公開自介：尚未提供更多說明。</li>
              <li>接受好友邀請：依使用者設定顯示。</li>
              <li>接受排程邀請：依使用者設定顯示。</li>
            </ul>
            <div className={styles.profileQuote}>
              在安感島，公開不是暴露，而是讓可被理解的資訊恰好被看見。
            </div>
          </article>

          <article className={styles.profilePanel}>
            <span>Availability</span>
            <h3>近期公開房間 / 時段</h3>
            <p>若使用者公開排程，近期可見的時段會集中整理在這裡。</p>
            <div className={styles.profileScheduleList}>
              <div className={styles.profileScheduleItem}>
                <div className={styles.profileScheduleDate}>—</div>
                <div>
                  <strong>目前沒有公開時段</strong>
                  <span>房間與排程是否顯示，取決於個人可見性設定。</span>
                </div>
              </div>
            </div>

            <div className={styles.profileBookingCard}>
              <b>我提供 Buddies 服務</b>
              <p>若這位使用者有公開上架服務，之後可在此直接看到預約入口。</p>
              <Link href="/buddies" className="i20-btn light">
                查看安感夥伴
              </Link>
            </div>
          </article>
        </div>

        <p className={styles.profileBottomNote}>
          公開檔案的目的，是讓互動更清楚、更安全，而不是讓人被過度展示。
        </p>
      </section>

      <Image20Footer />
    </main>
  );
}
