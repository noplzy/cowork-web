import Link from "next/link";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const friendEntryPoints = [
  {
    eyebrow: "Reconnect",
    title: "熟悉的人，留在舒服的距離",
    body: "好友頁以低壓力重逢為主，不把社交做成即時壓力。",
  },
  {
    eyebrow: "Invite",
    title: "邀請與回覆要可讀",
    body: "收到、送出與已處理的互動，之後都會在同一頁整理。",
  },
  {
    eyebrow: "Safety",
    title: "不舒服時能先保護自己",
    body: "封鎖、回報與邊界設定會被放在比熱鬧更前面。",
  },
] as const;

export default function FriendsPage() {
  return (
    <Image20SidebarShell
      title="好友"
      lead="把熟悉的人留在舒服的距離：能重逢、能再約，也能保留邊界。"
    >
      <div className="i20-page" data-image20-dom-page="friends-v9-extra9">
        <div className={styles.summaryGrid}>
          {friendEntryPoints.map((item) => (
            <article className="i20-card" key={item.title}>
              <span className="i20-kicker">{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.friendBoard}>
          <section className="i20-panel">
            <div className="i20-section-head">
              <div>
                <span className="i20-kicker">My Friends</span>
                <h3>好友名單</h3>
              </div>
              <Link href="/rooms" className="i20-btn light">
                從同行空間開始
              </Link>
            </div>

            <div className={styles.friendRows}>
              <div className={styles.emptyPanel}>
                <b>目前沒有要展示的好友名單。</b>
                <p>
                  新增好友後，最近互動、可再次同行的人與邀請狀態都會集中整理在這裡。
                </p>
              </div>

              <div className={styles.friendRow}>
                <div className={styles.friendAvatar}>+</div>
                <div>
                  <strong>邀請入口</strong>
                  <small>可從公開檔案或共同房間開始，慢慢建立熟悉且舒服的互動。</small>
                </div>
                <Link href="/buddies" className="i20-btn">
                  探索安感夥伴
                </Link>
              </div>
            </div>
          </section>

          <aside className={styles.sideStack}>
            <section className="i20-panel">
              <span className="i20-kicker">Requests</span>
              <h3>收到的邀請</h3>
              <div className={styles.emptyPanel} style={{ marginTop: 14 }}>
                <b>目前沒有待確認邀請。</b>
                <p>收到邀請時，接受與略過會集中顯示在這裡。</p>
              </div>
            </section>

            <section className="i20-panel dark">
              <span className="i20-kicker">Safety</span>
              <h3>安全名單</h3>
              <p>
                不舒服的互動應該可以快速被隔離。封鎖與回報會以獨立區塊整理，不混在日常互動裡。
              </p>
              <Link href="/contact" className="i20-btn peach">
                聯絡客服
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </Image20SidebarShell>
  );
}
