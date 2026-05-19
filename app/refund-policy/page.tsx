import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20EditorialPages.module.css";

const summaryItems = [
  {
    title: "清楚適用範圍",
    body: "不同服務型態，會有不同的判定條件。",
  },
  {
    title: "先看是否可交付",
    body: "若服務未能正常完成，先確認可補救空間。",
  },
  {
    title: "中途終止要分辨",
    body: "已開始的服務，不會用一句話粗暴判定。",
  },
  {
    title: "保留核對資訊",
    body: "訂單、時間與問題描述會讓處理更快。",
  },
] as const;

const digitalPolicyRows = [
  {
    code: "A",
    title: "方案與數位服務",
    body: "退款判定會先依方案頁、正式公告與實際交付狀態確認。",
  },
  {
    code: "B",
    title: "非人為無法交付",
    body: "若因平台、設備或第三方限制導致無法完成，可申請協助處理。",
  },
  {
    code: "C",
    title: "先補救，再判定",
    body: "能補救、延期或重排者，會先提供具體處理方式。",
  },
] as const;

const exceptionRows = [
  {
    code: "1",
    title: "已開始的人工或安排型服務",
    body: "是否可退款，需依工作是否已開始與實際投入判定。",
  },
  {
    code: "2",
    title: "使用者中途取消",
    body: "若主要流程已開始後主動終止，通常不適用全額退款。",
  },
  {
    code: "3",
    title: "個案爭議與第三方異常",
    body: "會依可核查紀錄釐清，不用模糊承諾取代處理結果。",
  },
] as const;

const supportLinks = [
  {
    href: "/contact",
    title: "聯絡客服",
    body: "附上訂單、付款紀錄與問題描述。",
  },
  {
    href: "/pricing",
    title: "查看方案 / 價格",
    body: "先確認方案適用條件與目前公開說明。",
  },
  {
    href: "/service-delivery",
    title: "查看服務交付",
    body: "理解服務何時開始、何時算完成。",
  },
] as const;

const lowerCards = [
  {
    title: "申請前先整理",
    body: "訂單資訊、付款資訊、錯誤畫面與發生時間。",
  },
  {
    title: "判定依實際紀錄",
    body: "客服會先確認交付狀態與補救方式，再回覆結果。",
  },
  {
    title: "退款不是黑箱",
    body: "我們會用可說明的方式處理，不用話術帶過。",
  },
] as const;

export default function RefundPolicyPage() {
  return (
    <main className={styles.editorialPage} data-image20-dom-page="refund-policy-template-v13">
      <section className={styles.darkHero}>
        <div className={styles.darkHeroMedia} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.heroInner}>
          <article className={styles.heroCopy}>
            <span className="i20-kicker">Refund Policy</span>
            <h1 className="i20-serif">退款與支持，先把邊界說清楚。</h1>
            <p>
              安感島重視信任，也重視判定方式是否清楚。付款後若遇到方案、
              服務交付或第三方異常，退款處理會先回到事實與紀錄，而不是模糊承諾。
            </p>
          </article>

          <aside className={styles.heroNotice}>
            <span className="i20-kicker">Support First</span>
            <h2>先確認是否可補救，再判斷退款方向。</h2>
            <p>
              若你遇到無法進房、服務中斷或方案理解落差，
              先保留資訊並聯絡客服，處理會更快。
            </p>
            <div className={styles.heroNoticeLinks}>
              <Link className="i20-btn peach" href="/contact">
                聯絡客服
              </Link>
              <Link className="i20-btn ghost" href="/service-delivery">
                查看服務交付
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.summaryRibbon}>
        <div className={styles.ribbonIntro}>
          <span className="i20-kicker">Refund Summary</span>
          <h2 className="i20-serif">退款重點摘要</h2>
          <p>先知道判定方式，再做付款與申請決定。</p>
        </div>

        <div className={styles.summaryRail}>
          {summaryItems.map((item) => (
            <article className={styles.summaryRailItem} key={item.title}>
              <b>{item.title}</b>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.refundMain}>
        <article className={`${styles.refundPolicyCard} ${styles.isTinted}`}>
          <div className={styles.refundCardHead}>
            <span className={styles.refundSeal}>VIP</span>
            <div>
              <h3 className="i20-serif">方案與數位服務退款原則</h3>
              <p>適用於會員方案、Rooms 使用與相關數位服務情境。</p>
            </div>
          </div>

          <div className={styles.refundRows}>
            {digitalPolicyRows.map((item) => (
              <div className={styles.refundRow} key={item.title}>
                <em>{item.code}</em>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
              </div>
            ))}
          </div>

          <Link className={styles.inlineTextLink} href="/pricing">
            查看方案說明 →
          </Link>
        </article>

        <article className={styles.refundPolicyCard}>
          <div className={styles.refundCardHead}>
            <span className={styles.refundSeal}>服務</span>
            <div>
              <h3 className="i20-serif">例外與個案處理方式</h3>
              <p>把「已經開始」與「仍可補救」分開處理。</p>
            </div>
          </div>

          <div className={styles.refundRows}>
            {exceptionRows.map((item) => (
              <div className={styles.refundRow} key={item.title}>
                <em>{item.code}</em>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
              </div>
            ))}
          </div>

          <Link className={styles.inlineTextLink} href="/contact">
            需要個案協助 →
          </Link>
        </article>

        <aside className={styles.refundSupport}>
          <span className="i20-kicker">Need Help</span>
          <h3 className="i20-serif">遇到問題，從這裡開始。</h3>
          <p>
            客服會依服務範圍、訂單狀態與實際紀錄協助判斷，
            讓你知道接下來怎麼處理。
          </p>

          <div className={styles.refundSupportList}>
            {supportLinks.map((item) => (
              <Link className={styles.refundSupportLink} href={item.href} key={item.title}>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
                <strong>›</strong>
              </Link>
            ))}
          </div>

          <div className={styles.refundAssistant}>
            <b>處理前的小提醒</b>
            <span>若有付款截圖、錯誤畫面與發生時間，請一併提供。</span>
          </div>
        </aside>
      </section>

      <section className={styles.refundLower}>
        {lowerCards.map((item) => (
          <article className={styles.refundMiniCard} key={item.title}>
            <b>{item.title}</b>
            <span>{item.body}</span>
          </article>
        ))}

        <article className={styles.refundTrustBanner}>
          <b>信任不是一句保證，而是一套能被說清楚的處理流程。</b>
          <span>安感島會盡量讓退款、補救與客服判定回到可核對的資訊。</span>
        </article>
      </section>

      <Image20Footer />
    </main>
  );
}
