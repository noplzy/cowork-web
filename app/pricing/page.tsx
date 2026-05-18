import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const freeBenefits = [
  "每月 4 場免費同行額度",
  "25 分鐘房間消耗 1 credit",
  "50 分鐘房間消耗 2 credits",
  "可先熟悉同行空間與基本流程",
] as const;

const vipBenefits = [
  "房間續場不受免費額度限制",
  "適合固定使用 Rooms 的高頻使用者",
  "可搭配更完整的方案與客服協助",
  "實際權益以正式帳號狀態與公告為準",
] as const;

const roomRules = [
  {
    title: "25 分鐘同行",
    body: "消耗 1 credit，適合想先開始、低負擔完成一段節奏的人。",
  },
  {
    title: "50 分鐘同行",
    body: "消耗 2 credits，適合較完整的專注、陪伴或分享時段。",
  },
  {
    title: "VIP 權益",
    body: "VIP 不以免費場次作為主要限制，讓高頻使用者更穩定地續房。",
  },
] as const;

export default function PricingPage() {
  return (
    <main className="i20-root" data-image20-dom-page="pricing-v11-template-aligned">
      <section className={styles.pricingHero}>
        <div className={styles.pricingHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.pricingHeroCopy}>
          <span className="i20-kicker">Pricing</span>
          <h1 className="i20-serif">先知道規則，再選擇適合自己的同行方式。</h1>
          <p>
            安感島目前的核心是 Rooms：免費方案以每月額度體驗為主，
            VIP 則適合需要更穩定使用節奏的人。
          </p>
          <div className={styles.pricingHeroActions}>
            <Link href="/rooms" className="i20-btn">
              先去看房間
            </Link>
            <Link href="/contact" className="i20-btn peach">
              詢問方案
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.pricingBody}>
        <div className={styles.pricingComparison}>
          <article className={styles.pricingPlanCard}>
            <span className="i20-kicker">Free</span>
            <h2 className="i20-serif">免費體驗</h2>
            <p>適合先理解安感島節奏、偶爾進房與試用主要服務的人。</p>
            <ul>
              {freeBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <Link href="/rooms" className="i20-btn light">
              開始體驗
            </Link>
          </article>

          <div className={styles.pricingBadge}>
            <b>選擇</b>
            <span>符合自己的節奏</span>
          </div>

          <article className={`${styles.pricingPlanCard} ${styles.pricingVipCard}`}>
            <span className="i20-kicker">VIP</span>
            <h2 className="i20-serif">VIP 會員</h2>
            <p>適合固定使用同行空間、希望房間節奏更穩定的人。</p>
            <ul>
              {vipBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <Link href="/contact" className="i20-btn peach">
              詢問 VIP 方案
            </Link>
          </article>
        </div>

        <div className={styles.pricingRuleGrid}>
          {roomRules.map((rule) => (
            <article key={rule.title}>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.pricingSupportGrid}>
          <article>
            <span className="i20-kicker">Support</span>
            <h3>付款與方案疑問</h3>
            <p>如果你需要確認方案適合度，可直接從客服入口詢問。</p>
            <Link href="/contact">聯絡客服 →</Link>
          </article>
          <article>
            <span className="i20-kicker">Policy</span>
            <h3>退款政策</h3>
            <p>先看清楚退款原則，再決定是否啟用方案。</p>
            <Link href="/refund-policy">查看退款政策 →</Link>
          </article>
          <article>
            <span className="i20-kicker">Delivery</span>
            <h3>服務交付</h3>
            <p>了解 Rooms、排程與正式服務的交付方式。</p>
            <Link href="/service-delivery">查看服務交付 →</Link>
          </article>
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}
