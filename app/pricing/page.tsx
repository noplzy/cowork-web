import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { PricingCheckoutButton } from "@/components/billing/PricingCheckoutButton";
import styles from "@/components/image20/Image20Auxiliary.module.css";
import {
  PRODUCT_ADD_ONS,
  PRODUCT_PLANS,
  ROOM_DURATION_POLICY,
  VALUE_BASED_PRICING_PRINCIPLES,
} from "@/lib/productCatalog";

type PricingPlanCard = {
  code: string;
  title: string;
  shortTitle: string;
  priceLabel: string;
  stageLabel: string;
  isPurchasable: boolean;
  isFeatured: boolean;
  isPale: boolean;
  icon: string;
  positioning: string;
  jobToBeDone: string;
  upgradeTrigger: string;
  disabledReason: string;
  highlights: string[];
};

const trustItems = [
  {
    title: "價格不誤導",
    body: "目前可付款與下一版規劃分開標示，不把尚未完成的權益寫成已開放。",
  },
  {
    title: "舒服在場",
    body: "不強迫開鏡頭，Presence 是信任與成本模型，不是監考。",
  },
  {
    title: "AI 不吃到飽",
    body: "安感島不賣無限個人 AI 陪聊，價值集中在 Shared Host AI。",
  },
  {
    title: "可營運帳務",
    body: "付款、發票、退款、客服與 ledger 必須對得起來。",
  },
] as const;

const notes = [
  "目前正式可付款：VIP 月方案（試營運）NT$199 / 30 天，一次性付款，不自動續扣。",
  "NT$299 / 599 / 1299 是 Pricing v2 next-spec，等訂閱、發票、退款、Host Credit 與 AI cost cap 對齊後才開放。",
  "一般房間正式規格為 25 / 50 / 75 分鐘；90 分鐘保留給活動房、Studio、Buddies 或主持島民能力。",
  "Host Credit 是 AI 主持權，不是 AI 整場持續講話時間；Personal AI 只做開始、卡住與收尾救援。",
] as const;

function normalizePlan(rawPlan: unknown): PricingPlanCard {
  const plan = rawPlan as Record<string, any>;
  const code = String(plan.code || "");
  const purchaseStatus = String(plan.purchaseStatus || plan.availability || "");
  const stage = String(plan.stage || "");

  const isPurchasable =
    Boolean(plan.purchaseEnabled) ||
    purchaseStatus === "active" ||
    Boolean(plan.checkoutPlanCode && plan.amountTwd !== null && plan.amountTwd !== undefined);

  const stageLabel = isPurchasable
    ? "目前開放"
    : stage === "pricing_v2_next_spec"
      ? "下一版規劃"
      : "尚未開放";

  const fallbackTitle = String(plan.title || plan.shortTitle || code || "方案");
  const fallbackHighlights = Array.isArray(plan.highlights)
    ? plan.highlights.map((item: unknown) => String(item))
    : Array.isArray(plan.benefits)
      ? plan.benefits.map((item: unknown) => String(item))
      : [];

  return {
    code,
    title: fallbackTitle,
    shortTitle: String(plan.shortTitle || fallbackTitle),
    priceLabel:
      typeof plan.priceLabel === "string"
        ? plan.priceLabel
        : plan.amountTwd === 0
          ? "NT$0"
          : plan.amountTwd
            ? `NT$${Number(plan.amountTwd).toLocaleString("zh-TW")} / 月`
            : "尚未定價",
    stageLabel,
    isPurchasable,
    isFeatured: code === "companion_regular_599",
    isPale: code === "host_islander_1299",
    icon: code === "vip_month" ? "♡" : code === "companion_regular_599" ? "☆" : code === "host_islander_1299" ? "♕" : "☘",
    positioning: String(plan.positioning || plan.description || "依照使用深度分層，避免把高成本能力塞進低價方案。"),
    jobToBeDone: String(plan.jobToBeDone || "選擇適合目前使用節奏的陪伴方式。"),
    upgradeTrigger: String(plan.upgradeTrigger || "需要更多房間能力、Shared Host AI 或房主工具時再升級。"),
    disabledReason: String(plan.disabledReason || plan.userFriendlyNotice || "這個方案尚未開放付款。"),
    highlights: fallbackHighlights,
  };
}

const visiblePlans = (PRODUCT_PLANS as unknown[])
  .map(normalizePlan)
  .filter((plan) => plan.code !== "free");

export default function PricingPage() {
  return (
    <main className="i20-root" data-image20-dom-page="pricing-v1082-type-safe-catalog">
      <section className={styles.pricingHero}>
        <div className={styles.pricingHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.pricingHeroCopy}>
          <span className="i20-kicker">Pricing</span>
          <h1 className="i20-serif">方案 / 價格</h1>
          <p>先誠實標示目前能買什麼，再清楚說明下一版會如何用 Rooms、Presence、Host Credit 與房主贊助分層。</p>
        </div>
      </section>

      <section className="pricing-v16-stage" aria-label="方案比較">
        <div className="pricing-v16-trust-strip">
          {trustItems.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="pricing-v16-production-banner">
          <span className="i20-kicker">Production Fact</span>
          <h2 className="i20-serif">目前 production 只開放 NT$199 / 30 天一次性 VIP 試營運。</h2>
          <p>這不是降級，而是避免把尚未完成的訂閱、AI 主持包、房主贊助與發票退款流程提前賣給使用者。</p>
        </div>

        <div className="pricing-v16-plan-row">
          {visiblePlans.map((plan) => (
            <article
              key={plan.code || plan.title}
              className={[
                "pricing-v16-plan-card",
                plan.isFeatured ? "pricing-v16-plan-featured" : "",
                plan.isPale ? "pricing-v16-plan-pale" : "",
                plan.isPurchasable ? "pricing-v16-plan-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="pricing-v16-kicker">{plan.stageLabel}</span>
              <div className="pricing-v16-icon" aria-hidden="true">
                {plan.icon}
              </div>
              <h2>{plan.title}</h2>
              <p className="pricing-v16-subtitle">{plan.positioning}</p>
              <div className="pricing-v16-price">
                <strong>{plan.priceLabel}</strong>
              </div>
              <p className="pricing-v16-job">{plan.jobToBeDone}</p>
              <ul>
                {plan.highlights.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <div className="pricing-v16-fence">
                <b>升級誘因</b>
                <span>{plan.upgradeTrigger}</span>
              </div>
              <PricingCheckoutButton
                planCode={plan.code}
                disabled={!plan.isPurchasable}
                disabledReason={plan.disabledReason}
              >
                {plan.isPurchasable ? "購買此方案" : "尚未開放付款"}
              </PricingCheckoutButton>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-v16-ivory" aria-label="商業邏輯與加購">
        <div className="pricing-v16-two-col">
          <article className="pricing-v16-decision-card">
            <span className="i20-kicker">Value-based Tiering</span>
            <h2 className="i20-serif">方案分層不是逼人升級，而是把高成本能力放在正確的位置。</h2>
            <div className="pricing-v16-principles">
              {VALUE_BASED_PRICING_PRINCIPLES.map((item) => (
                <p key={String(item)}>{String(item)}</p>
              ))}
            </div>
          </article>

          <article className="pricing-v16-decision-card">
            <span className="i20-kicker">Room Policy</span>
            <h2 className="i20-serif">Rooms 時長要有清楚語意。</h2>
            <div className="pricing-v16-duration-grid">
              {ROOM_DURATION_POLICY.generalDurations.map((duration) => (
                <div key={duration}>
                  <b>{duration}</b>
                  <span>{ROOM_DURATION_POLICY.durationLabels[duration]}</span>
                </div>
              ))}
              <div>
                <b>{ROOM_DURATION_POLICY.activityDuration}</b>
                <span>{ROOM_DURATION_POLICY.durationLabels[ROOM_DURATION_POLICY.activityDuration]}</span>
              </div>
            </div>
          </article>
        </div>

        <div className="pricing-v16-addon-row">
          {PRODUCT_ADD_ONS.filter((item) => item.code !== "whole_room_extension").map((addon) => (
            <article key={addon.code}>
              <span className="i20-kicker">Host Credit</span>
              <h3>{addon.title}</h3>
              <b>{addon.priceLabel}</b>
              <p>{addon.positioning}</p>
              <small>{addon.disabledReason}</small>
            </article>
          ))}
        </div>

        <div className="pricing-v16-note-bar">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </section>

      <Image20Footer />

      <style>{`
        .pricing-v16-stage {
          position: relative;
          z-index: 4;
          margin-top: -98px;
          padding: 0 clamp(28px, 6vw, 110px) 44px;
          background: linear-gradient(180deg, rgba(6, 24, 32, 0) 0, rgba(6, 24, 32, 0) 86px, #071b23 86px, #071b23 420px, #f3ede3 420px);
        }

        .pricing-v16-trust-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border: 1px solid rgba(255, 229, 201, 0.16);
          overflow: hidden;
          background: rgba(12, 31, 39, 0.72);
          color: #fff2df;
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
        }

        .pricing-v16-trust-strip article {
          min-height: 96px;
          padding: 20px 28px 18px;
          border-right: 1px solid rgba(255, 229, 201, 0.18);
        }

        .pricing-v16-trust-strip article:last-child {
          border-right: 0;
        }

        .pricing-v16-trust-strip h3 {
          margin: 0 0 5px;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 18px;
          font-weight: 500;
          letter-spacing: 0.08em;
        }

        .pricing-v16-trust-strip p {
          margin: 0;
          color: rgba(255, 242, 223, 0.7);
          font-size: 13px;
          line-height: 1.62;
        }

        .pricing-v16-production-banner {
          max-width: 1440px;
          margin: 32px auto 0;
          padding: 26px 30px;
          border: 1px solid rgba(255, 229, 201, 0.18);
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(244, 216, 181, 0.18), rgba(16, 48, 58, 0.72));
          color: #fff2df;
        }

        .pricing-v16-production-banner h2 {
          margin: 8px 0;
          font-weight: 500;
        }

        .pricing-v16-production-banner p {
          max-width: 860px;
          margin: 0;
          color: rgba(255, 242, 223, 0.75);
          line-height: 1.8;
        }

        .pricing-v16-plan-row {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
          margin: 36px auto 0;
          max-width: 1600px;
        }

        .pricing-v16-plan-card {
          min-width: 0;
          min-height: 560px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 28px 28px 26px;
          border-radius: 24px;
          border: 1px solid rgba(45, 34, 26, 0.16);
          background: rgba(255, 249, 240, 0.94);
          box-shadow: 0 26px 70px rgba(22, 15, 9, 0.16);
          color: #2c2019;
        }

        .pricing-v16-plan-featured {
          background: #fff4df;
          border-color: rgba(190, 123, 76, 0.34);
          box-shadow: 0 32px 90px rgba(122, 75, 41, 0.22);
        }

        .pricing-v16-plan-active {
          outline: 3px solid rgba(218, 154, 92, 0.34);
        }

        .pricing-v16-plan-pale {
          background: #f7efe2;
        }

        .pricing-v16-kicker {
          width: fit-content;
          border: 1px solid rgba(45, 34, 26, 0.16);
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(45, 34, 26, 0.68);
        }

        .pricing-v16-icon {
          margin-top: 18px;
          font-size: 26px;
        }

        .pricing-v16-plan-card h2 {
          margin: 16px 0 8px;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 26px;
          font-weight: 500;
        }

        .pricing-v16-subtitle,
        .pricing-v16-job,
        .pricing-v16-fence span,
        .pricing-v17-action-note {
          color: rgba(45, 34, 26, 0.68);
          line-height: 1.7;
          font-size: 14px;
        }

        .pricing-v16-price strong {
          display: block;
          margin: 16px 0;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 30px;
          font-weight: 500;
        }

        .pricing-v16-plan-card ul {
          flex: 1;
          margin: 18px 0;
          padding: 0;
          list-style: none;
        }

        .pricing-v16-plan-card li {
          padding: 8px 0;
          border-top: 1px solid rgba(45, 34, 26, 0.1);
          font-size: 14px;
          line-height: 1.55;
        }

        .pricing-v16-fence {
          display: grid;
          gap: 6px;
          margin: 0 0 18px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(45, 34, 26, 0.055);
        }

        .pricing-v17-action-wrap {
          display: grid;
          gap: 8px;
        }

        .pricing-v17-action-note {
          margin: 0;
        }

        .pricing-v17-cta,
        .pricing-v16-cta {
          width: 100%;
          border: 0;
          border-radius: 999px;
          padding: 13px 16px;
          background: #172f36;
          color: #fff2df;
          cursor: pointer;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-decoration: none;
          text-align: center;
        }

        .pricing-v17-cta[aria-disabled="true"] {
          background: rgba(45, 34, 26, 0.2);
          color: rgba(45, 34, 26, 0.62);
        }

        .pricing-v16-ivory {
          padding: 58px clamp(28px, 6vw, 110px) 80px;
          background: #f3ede3;
        }

        .pricing-v16-two-col {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
          max-width: 1480px;
          margin: 0 auto;
        }

        .pricing-v16-decision-card,
        .pricing-v16-addon-row article,
        .pricing-v16-note-bar {
          border: 1px solid rgba(45, 34, 26, 0.12);
          border-radius: 24px;
          background: rgba(255, 250, 242, 0.82);
          box-shadow: 0 18px 50px rgba(40, 26, 14, 0.08);
        }

        .pricing-v16-decision-card {
          padding: 30px;
        }

        .pricing-v16-decision-card h2 {
          margin: 8px 0 18px;
          font-weight: 500;
        }

        .pricing-v16-principles p,
        .pricing-v16-note-bar p {
          margin: 0;
          padding: 14px 0;
          border-top: 1px solid rgba(45, 34, 26, 0.1);
          line-height: 1.75;
          color: rgba(45, 34, 26, 0.72);
        }

        .pricing-v16-duration-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .pricing-v16-duration-grid div {
          padding: 18px;
          border-radius: 18px;
          background: rgba(23, 47, 54, 0.08);
        }

        .pricing-v16-duration-grid b {
          display: block;
          font-size: 24px;
          font-family: Georgia, "Noto Serif TC", serif;
        }

        .pricing-v16-duration-grid span {
          color: rgba(45, 34, 26, 0.65);
          font-size: 13px;
          line-height: 1.6;
        }

        .pricing-v16-addon-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          max-width: 1480px;
          margin: 28px auto 0;
        }

        .pricing-v16-addon-row article {
          padding: 22px;
        }

        .pricing-v16-addon-row h3 {
          margin: 10px 0 8px;
          font-size: 18px;
        }

        .pricing-v16-addon-row b {
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 24px;
        }

        .pricing-v16-addon-row p,
        .pricing-v16-addon-row small {
          display: block;
          color: rgba(45, 34, 26, 0.64);
          line-height: 1.65;
        }

        .pricing-v16-note-bar {
          max-width: 1480px;
          margin: 28px auto 0;
          padding: 10px 24px;
        }

        @media (max-width: 1180px) {
          .pricing-v16-plan-row,
          .pricing-v16-trust-strip,
          .pricing-v16-addon-row,
          .pricing-v16-two-col {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .pricing-v16-stage {
            padding: 0 18px 32px;
          }

          .pricing-v16-ivory {
            padding: 42px 18px 58px;
          }

          .pricing-v16-plan-row,
          .pricing-v16-trust-strip,
          .pricing-v16-addon-row,
          .pricing-v16-two-col {
            grid-template-columns: 1fr;
          }

          .pricing-v16-trust-strip article {
            border-right: 0;
            border-bottom: 1px solid rgba(255, 229, 201, 0.18);
          }
        }
      `}</style>
    </main>
  );
}
