import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const editorialItems = [
  {
    title: "更安心的邀請",
    body: "熟悉的人加入房間時，互動脈絡會比陌生配對更容易理解。",
  },
  {
    title: "更穩定的分享",
    body: "好友關係能降低邀請成本，也能替私人房與日常重逢留下入口。",
  },
  {
    title: "更清楚的邊界",
    body: "待處理邀請、封鎖與回報會分開呈現，避免社交壓力混在一起。",
  },
] as const;

export default function FriendsPage() {
  return (
    <main className="i20-root" data-image20-dom-page="friends-v10-template-aligned">
      <section className={styles.friendsHero}>
        <div className={styles.friendsHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.friendsHeroInner}>
          <div>
            <span className="i20-kicker">Friends</span>
            <h1 className="i20-serif">在安感島，不必總是自己開始。</h1>
            <p>
              好友讓邀請更安心，房間裡的陪伴更自在；你可以慢慢建立熟悉的人際圈，
              也能保留舒服的距離。
            </p>
          </div>

          <aside className={styles.friendsHeroNotice}>
            <span>安感小提醒</span>
            <b>好友功能會優先保留邀請、回覆與安全邊界。</b>
            <p>比起熱鬧，這裡更在意你是否能安心地再度相遇。</p>
          </aside>
        </div>
      </section>

      <section className={styles.friendsBody}>
        <aside className={styles.friendsEditorial}>
          <span className="i20-kicker">Why Friends</span>
          <h2 className="i20-serif">好友如何影響你的房間體驗</h2>

          <div className={styles.friendsEditorialList}>
            {editorialItems.map((item) => (
              <article key={item.title}>
                <b>{item.title}</b>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className={styles.friendsPrimaryColumn}>
          <article className={styles.friendsPanel}>
            <div className={styles.friendsPanelHead}>
              <div>
                <span className="i20-kicker">Trusted Friends</span>
                <h3>信任好友</h3>
              </div>
              <button className={styles.pendingButton} type="button" disabled>
                名單管理待開放
              </button>
            </div>

            <div className={styles.friendsEmptyList}>
              <div className={styles.friendsEmptyState}>
                <b>目前還沒有好友名單。</b>
                <p>
                  當你與熟悉的人建立連結後，最近互動、可再次邀請與在場狀態都會整理在這裡。
                </p>
              </div>

              <div className={styles.friendsInviteRow}>
                <div className={styles.friendAvatar}>+</div>
                <div>
                  <strong>從安心的入口開始</strong>
                  <span>你可以先從同行空間或安感夥伴頁面探索合適的互動方式。</span>
                </div>
                <Link href="/rooms" className="i20-btn">
                  探索房間
                </Link>
              </div>
            </div>
          </article>
        </section>

        <aside className={styles.friendsSideColumn}>
          <article className={styles.friendsPanel}>
            <div className={styles.friendsPanelHead}>
              <div>
                <span className="i20-kicker">Requests</span>
                <h3>待處理邀請</h3>
              </div>
              <button className={styles.pendingButton} type="button" disabled>
                查看全部
              </button>
            </div>

            <div className={styles.friendsCompactState}>
              <b>目前沒有待確認邀請。</b>
              <p>收到邀請時，接受、略過與後續管理都會集中在這裡。</p>
            </div>
          </article>

          <article className={styles.friendsPanel}>
            <span className="i20-kicker">Invite</span>
            <h3>邀請好友</h3>
            <p>邀請連結與邀請帳號入口會在此區域呈現。</p>
            <div className={styles.friendsInvitePreview}>
              <span>邀請功能準備中</span>
              <button type="button" disabled>
                建立邀請連結
              </button>
            </div>
          </article>

          <article className={`${styles.friendsPanel} ${styles.friendsDarkPanel}`}>
            <span className="i20-kicker">Safety</span>
            <h3>封鎖與回報</h3>
            <p>
              不舒服的互動會優先被隔離。之後封鎖名單與回報紀錄會集中顯示在這裡。
            </p>
            <Link href="/contact" className="i20-btn peach">
              聯絡客服
            </Link>
          </article>
        </aside>
      </section>

      <Image20Footer />
    </main>
  );
}
