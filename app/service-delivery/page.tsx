import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20EditorialPages.module.css";

const flowSteps = [
  {
    code: "1",
    title: "建立帳號",
    body: "先完成登入或註冊，準備進入服務流程。",
  },
  {
    code: "2",
    title: "確認房間或時間",
    body: "依 Rooms 狀態立即加入，或先安排排程。",
  },
  {
    code: "3",
    title: "進入互動與使用",
    body: "視訊、音訊與房內設定，依裝置與當下規則運作。",
  },
  {
    code: "4",
    title: "發生異常時回到支援",
    body: "付款、連線或第三方問題，會回到客服與政策處理。",
  },
] as const;

const serviceTypes = [
  {
    title: "同行空間",
    body: "適合即時加入，在可用房間裡開始一段低壓力在場。",
  },
  {
    title: "排程服務",
    body: "先選時間、看規則，再在預定時段進入對應流程。",
  },
  {
    title: "方案與權益",
    body: "會員方案、額度與服務可見性，會影響你能走到哪一步。",
  },
] as const;

const showcaseRows = [
  {
    label: "即時加入",
    title: "看到可進房狀態後開始",
    body: "使用者可依公開房間條件與方案狀態加入。",
  },
  {
    label: "排程確認",
    title: "時間、房型與可見性先確認",
    body: "預約型互動，會先回到時間與規則。",
  },
  {
    label: "異常處理",
    title: "服務中斷時仍有回應路徑",
    body: "客服、退款與交付頁會承接後續處理。",
  },
] as const;

const supportItems = [
  {
    href: "/rooms",
    title: "前往同行空間",
    body: "查看目前可進入或可安排的房間。",
  },
  {
    href: "/refund-policy",
    title: "查看退款政策",
    body: "理解付款後的補救與判定方式。",
  },
  {
    href: "/contact",
    title: "聯絡客服",
    body: "遇到問題時，回到正式支援入口。",
  },
] as const;

const trustItems = [
  {
    title: "安心隱私",
    body: "互動方式與資料邊界都需要說清楚。",
  },
  {
    title: "公開規則",
    body: "房間、方案與交付判定以正式說明為準。",
  },
  {
    title: "尊重在場",
    body: "安感島追求的是可持續的陪伴，不是壓迫感。",
  },
  {
    title: "真實支援",
    body: "異常發生時，客服與政策頁要能接住你。",
  },
] as const;

export default function ServiceDeliveryPage() {
  return (
    <main className={styles.lightEditorialPage} data-image20-dom-page="service-delivery-template-v13">
      <section className={styles.lightHero}>
        <div className={styles.deliveryHeroMedia} aria-hidden="true" />
        <Image20TopNav />

        <div className={styles.deliveryHeroInner}>
          <article className={styles.deliveryHeroCopy}>
            <span className="i20-kicker">Service Delivery</span>
            <h1 className="i20-serif">服務如何開始，也應該清楚交代如何完成。</h1>
            <p>
              加入、進房、排程與異常處理，是同一條服務流程的一部分。
              安感島把開始條件、使用方式與交付判定分開說清楚。
            </p>
          </article>
        </div>
      </section>

      <section className={styles.deliveryFlow}>
        <div className={styles.deliveryFlowLead}>
          <span className="i20-kicker">Flow</span>
          <h2 className="i20-serif">服務流程</h2>
          <p>從開始到處理，只保留必要的四步。</p>
        </div>

        <div className={styles.deliverySteps}>
          {flowSteps.map((step, index) => (
            <div className={styles.deliveryStepGroup} key={step.title}>
              <article className={styles.deliveryStep}>
                <span className={styles.flowSeal}>{step.code}</span>
                <div>
                  <b>{step.title}</b>
                  <span>{step.body}</span>
                </div>
              </article>
              {index < flowSteps.length - 1 ? (
                <span className={styles.deliveryArrow} aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.deliveryBody}>
        <article className={styles.deliveryPanel}>
          <span className="i20-kicker">Service Types</span>
          <h3 className="i20-serif">服務類型與適用方式</h3>
          <p>不是每一種服務都用同一個判定方式，所以先把類型拆開。</p>

          <div className={styles.deliveryTypeGrid}>
            {serviceTypes.map((item) => (
              <div className={styles.deliveryTypeCard} key={item.title}>
                <b>{item.title}</b>
                <span>{item.body}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.deliveryPanel}>
          <span className="i20-kicker">How It Works</span>
          <h3 className="i20-serif">如何進入房間或參與排程</h3>
          <p>用可理解的流程板，把不同路徑拆出來。</p>

          <div className={styles.deliveryShowcase}>
            {showcaseRows.map((item) => (
              <div className={styles.deliveryShowcaseLane} key={item.title}>
                <strong>{item.label}</strong>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className={styles.deliverySupport}>
          <span className="i20-kicker">Support</span>
          <h3 className="i20-serif">支援與問題處理</h3>
          <p>服務說明不是只為了成交，也要在出問題時能派上用場。</p>

          <div className={styles.deliverySupportList}>
            {supportItems.map((item) => (
              <Link className={styles.deliverySupportItem} href={item.href} key={item.title}>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
                <strong>›</strong>
              </Link>
            ))}
          </div>

          <div className={styles.deliverySupportNote}>
            <b>遇到狀況時</b>
            <span>先保留時間、畫面與訂單資訊，客服才能更快幫你判斷。</span>
          </div>
        </aside>
      </section>

      <section className={styles.deliveryTrustBand}>
        {trustItems.map((item) => (
          <article className={styles.deliveryTrustItem} key={item.title}>
            <b>{item.title}</b>
            <span>{item.body}</span>
          </article>
        ))}

        <Link className={styles.deliveryTrustCta} href="/contact">
          <b>需要協助？</b>
          <span>回到客服入口，讓問題有正式承接。</span>
        </Link>
      </section>

      <Image20Footer />
    </main>
  );
}
