import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20EditorialPages.module.css";

const summaryItems = [
  {
    title: "尊重每個人的節奏",
    body: "安感島的互動，建立在不施壓與不打擾。",
  },
  {
    title: "安全先於熱鬧",
    body: "房間規則與互動邊界，優先於表面活躍。",
  },
  {
    title: "帳號與身份要可信",
    body: "登入、驗證與資料使用都需要可追溯。",
  },
  {
    title: "服務會持續調整",
    body: "功能與方案以正式公告與當下頁面為準。",
  },
] as const;

const termCards = [
  {
    code: "01",
    title: "平台定位",
    meta: "Purpose",
    items: [
      "安感島提供低壓力同行、陪伴與可信任互動。",
      "核心服務包含同行空間、排程與安感夥伴。",
      "平台不是直播牆，也不是無邊界社交場域。",
    ],
    href: "/rooms",
    cta: "前往同行空間",
  },
  {
    code: "02",
    title: "可接受的使用",
    meta: "Acceptable Use",
    items: [
      "尊重他人的在場方式與房間規則。",
      "依照公開說明使用邀請、排程與房間功能。",
      "需要協助時，優先回到客服與正式政策頁。",
    ],
    href: "/contact",
    cta: "查看客服入口",
  },
  {
    code: "03",
    title: "禁止行為",
    meta: "Prohibited Behavior",
    items: [
      "禁止色情、詐騙、灰產與剝削型互動。",
      "禁止騷擾、威脅、冒用身份或惡意規避規則。",
      "禁止用服務引導不安全或不被允許的交易。",
    ],
    href: "/contact",
    cta: "回報疑慮",
  },
  {
    code: "04",
    title: "房間與陪伴服務規範",
    meta: "Rooms & Services",
    items: [
      "公開與私密房間的可見性，以介面說明為準。",
      "進入房間後，應遵守當下設定與參與方式。",
      "安感夥伴相關服務會依公開頁面與後續規範進行。",
    ],
    href: "/service-delivery",
    cta: "查看服務交付",
  },
  {
    code: "05",
    title: "帳號與安全",
    meta: "Account Security",
    items: [
      "使用者應妥善維護登入資訊與帳號安全。",
      "必要時需配合手機或身份驗證流程。",
      "異常使用情況可能觸發限制或進一步核對。",
    ],
    href: "/account/identity",
    cta: "前往身份驗證",
  },
  {
    code: "06",
    title: "方案與服務變更",
    meta: "Plans & Updates",
    items: [
      "方案、價格與功能可能依營運調整。",
      "已公開頁面與正式公告會作為最新依據。",
      "涉及已購買服務時，依適用政策與說明處理。",
    ],
    href: "/pricing",
    cta: "查看方案 / 價格",
  },
  {
    code: "07",
    title: "客服與處理",
    meta: "Support",
    items: [
      "若對規則、付款、服務判定有疑問，可聯絡客服。",
      "客服會依可核對資訊協助釐清，不以口號代替處理。",
      "退款、隱私與交付頁會提供對應補充。",
    ],
    href: "/contact",
    cta: "聯絡客服",
  },
  {
    code: "08",
    title: "後續功能與公告",
    meta: "Future Features",
    items: [
      "尚未正式開放的功能，不會以模糊文案假裝已落地。",
      "新功能會在公開前補充用途、規則與資料邊界。",
      "正式版本以網站當下公告與產品頁面為準。",
    ],
    href: "/privacy",
    cta: "查看隱私權政策",
  },
] as const;

export default function TermsPage() {
  return (
    <main className={styles.editorialPage} data-image20-dom-page="terms-template-v118-ecpay-review-safe">
      <section className={styles.darkHero}>
        <div className={styles.termsHeroMedia} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.heroInner}>
          <article className={styles.heroCopy}>
            <span className="i20-kicker">Terms</span>
            <h1 className="i20-serif">服務條款，先把信任的邊界說清楚。</h1>
            <p>
              安感島重視低壓力與被尊重的互動。這份條款不是冷冰冰的限制，
              而是把平台定位、可接受使用方式與違規處理講明白。
            </p>
          </article>

          <aside className={styles.heroNotice}>
            <span className="i20-kicker">Important</span>
            <h2>規則不是阻擋，而是服務品質的一部分。</h2>
            <p>
              若平台要長期維持安心與可信任，就不能等問題發生後才補一句提醒。
            </p>
            <div className={styles.heroNoticeLinks}>
              <Link className="i20-btn peach" href="/contact">
                有疑問先聯絡客服
              </Link>
              <Link className="i20-btn ghost" href="/privacy">
                查看隱私權政策
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.termsSummaryRibbon}>
        <div className={styles.ribbonIntro}>
          <span className="i20-kicker">Key Summary</span>
          <h2 className="i20-serif">條款重點摘要</h2>
          <p>用更容易理解的方式，先掌握這個平台的核心原則。</p>
        </div>

        <div className={styles.termsSummaryRail}>
          {summaryItems.map((item) => (
            <article className={styles.termsSummaryItem} key={item.title}>
              <b>{item.title}</b>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.termsGrid}>
        {termCards.map((card) => (
          <article className={styles.termsCard} key={card.title}>
            <div className={styles.termsCardHead}>
              <span className={styles.policySeal}>{card.code}</span>
              <div>
                <h3 className="i20-serif">{card.title}</h3>
                <small>{card.meta}</small>
              </div>
            </div>

            <ul>
              {card.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <Link href={card.href}>{card.cta} →</Link>
          </article>
        ))}
      </section>

      <Image20Footer />
    </main>
  );
}
