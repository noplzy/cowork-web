import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { PricingCheckoutButton } from "@/components/billing/PricingCheckoutButton";
import styles from "@/components/image20/Image20Auxiliary.module.css";
import {
  ACTIVE_PURCHASABLE_PLAN,
  AI_PRICING_POLICY,
  PRICING_V2_POLICY,
  PRODUCT_ADD_ONS,
  PRODUCT_PLANS,
  ROOM_DURATION_POLICY,
  VALUE_BASED_PRICING_PRINCIPLES,
  type ProductPlan,
} from "@/lib/productCatalog";

const finalPlans = PRODUCT_PLANS.filter((plan) =>
  [
    "rooms_unlimited_299",
    "buddies_pro_399",
    "whole_site_599",
    "host_999",
  ].includes(plan.code),
);

const freePlan = PRODUCT_PLANS.find((plan) => plan.code === "free")!;

const comparisonRows: Array<{
  label: string;
  values: Record<string, string>;
}> = [
  {
    label: "個人 Rooms 總時間",
    values: {
      free: "有限體驗",
      rooms_unlimited_299: "無限",
      buddies_pro_399: "Free 等級",
      whole_site_599: "無限",
      host_999: "無限",
    },
  },
  {
    label: "安靜／純音訊",
    values: {
      free: "有限體驗",
      rooms_unlimited_299: "無限",
      buddies_pro_399: "Free 等級",
      whole_site_599: "無限",
      host_999: "無限",
    },
  },
  {
    label: "視覺同行額度",
    values: {
      free: "有限體驗",
      rooms_unlimited_299: "1,200 分鐘",
      buddies_pro_399: "Free 等級",
      whole_site_599: "1,800 分鐘",
      host_999: "3,000 分鐘",
    },
  },
  {
    label: "可建立一般房",
    values: {
      free: "否／有限",
      rooms_unlimited_299: "25／50／75",
      buddies_pro_399: "否／有限",
      whole_site_599: "25／50／75",
      host_999: "25／50／75",
    },
  },
  {
    label: "可建立 90 分鐘活動房",
    values: {
      free: "否",
      rooms_unlimited_299: "否",
      buddies_pro_399: "否",
      whole_site_599: "否",
      host_999: "是",
    },
  },
  {
    label: "同行延長點／月",
    values: {
      free: "0",
      rooms_unlimited_299: "12",
      buddies_pro_399: "0",
      whole_site_599: "24",
      host_999: "120",
    },
  },
  {
    label: "優先候補／月",
    values: {
      free: "0",
      rooms_unlimited_299: "0",
      buddies_pro_399: "5 次",
      whole_site_599: "6 次",
      host_999: "10 次",
    },
  },
  {
    label: "重點追蹤 Buddy",
    values: {
      free: "0",
      rooms_unlimited_299: "0",
      buddies_pro_399: "3 位",
      whole_site_599: "5 位",
      host_999: "10 位",
    },
  },
  {
    label: "同時上架服務",
    values: {
      free: "2 項",
      rooms_unlimited_299: "2 項",
      buddies_pro_399: "10 項",
      whole_site_599: "10 項",
      host_999: "25 項",
    },
  },
  {
    label: "Buddies 經營數據",
    values: {
      free: "基本",
      rooms_unlimited_299: "基本",
      buddies_pro_399: "近 90 天",
      whole_site_599: "近 90 天",
      host_999: "完整年度",
    },
  },
  {
    label: "曝光點數／月",
    values: {
      free: "0",
      rooms_unlimited_299: "0",
      buddies_pro_399: "1",
      whole_site_599: "1",
      host_999: "3",
    },
  },
  {
    label: "房主控制台",
    values: {
      free: "否",
      rooms_unlimited_299: "否",
      buddies_pro_399: "否",
      whole_site_599: "否",
      host_999: "是",
    },
  },
];

function PlanCard({ plan }: { plan: ProductPlan }) {
  const featured = plan.code === "whole_site_599";
  const moduleLabel = plan.modules
    .map((module) =>
      module === "rooms" ? "Rooms" : module === "buddies" ? "Buddies" : "Host",
    )
    .join(" ＋ ");

  return (
    <article
      className={`pricing-v128-plan ${featured ? "featured" : ""}`}
      data-plan-code={plan.code}
    >
      <div className="pricing-v128-plan-head">
        <span>{moduleLabel}</span>
        {featured ? <b>組合推薦</b> : null}
      </div>
      <h2>{plan.title}</h2>
      <p className="pricing-v128-positioning">{plan.positioning}</p>
      <div className="pricing-v128-price">{plan.priceLabel}</div>
      {plan.code === "whole_site_599" ? (
        <p className="pricing-v128-saving">分開購買 NT$698，每月省 NT$99</p>
      ) : null}
      <p className="pricing-v128-job">{plan.jobToBeDone}</p>
      <ul>
        {plan.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <div className="pricing-v128-boundary">
        <b>方案邊界</b>
        <span>{plan.antiCannibalizationFence}</span>
      </div>
      <PricingCheckoutButton
        planCode={plan.code}
        disabled={!plan.purchaseEnabled}
        disabledReason={plan.disabledReason}
      >
        {plan.purchaseEnabled ? "購買此方案" : "最終規格・尚未開放"}
      </PricingCheckoutButton>
    </article>
  );
}

export default function PricingPage() {
  return (
    <main className="i20-root" data-image20-dom-page="pricing-v128-final-no-ai-p0">
      <section className={styles.pricingHero}>
        <div className={styles.pricingHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />
        <div className={styles.pricingHeroCopy}>
          <span className="i20-kicker">Pricing</span>
          <h1 className="i20-serif">選擇你真正會用到的陪伴方式</h1>
          <p>
            Rooms 與 Buddies 分開販售；同時需要兩者，再選擇組合。AI 維持長期凍結，不放進任何方案。
          </p>
        </div>
      </section>

      <section className="pricing-v128-stage" aria-label="目前可購買與下一版方案">
        <article className="pricing-v128-production-fact">
          <div>
            <span className="i20-kicker">Production Fact</span>
            <h2>目前正式可付款：{ACTIVE_PURCHASABLE_PLAN.title}</h2>
            <p>
              {ACTIVE_PURCHASABLE_PLAN.priceLabel}，一次性付款、不自動續扣。下方 NT$299／399／599／999
              是已定案的 Pricing v2 規格，但尚未接通正式訂閱與新權益。
            </p>
          </div>
          <PricingCheckoutButton
            planCode={ACTIVE_PURCHASABLE_PLAN.code}
            disabled={!ACTIVE_PURCHASABLE_PLAN.purchaseEnabled}
            disabledReason={ACTIVE_PURCHASABLE_PLAN.disabledReason}
          >
            購買目前 VIP 試營運
          </PricingCheckoutButton>
        </article>

        <div className="pricing-v128-intro">
          <div>
            <span className="i20-kicker">Pricing v2 Final Spec</span>
            <h2 className="i20-serif">四個方案，四種不同工作</h2>
          </div>
          <p>
            NT$599 不是 Rooms 299 的加價版，而是 Rooms 299＋Buddies 399 的組合。主理人販售的是帶人、辦活動與經營能力。
          </p>
        </div>

        <div className="pricing-v128-plan-grid">
          {finalPlans.map((plan) => (
            <PlanCard key={plan.code} plan={plan} />
          ))}
        </div>
      </section>

      <section className="pricing-v128-ivory" aria-label="免費方案與權益比較">
        <div className="pricing-v128-free-card">
          <div>
            <span className="i20-kicker">Free Foundation</span>
            <h2 className="i20-serif">{freePlan.title}｜{freePlan.priceLabel}</h2>
            <p>{freePlan.positioning}</p>
          </div>
          <ul>
            {freePlan.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="pricing-v128-free-note">{freePlan.userFriendlyNotice}</p>
        </div>

        <div className="pricing-v128-comparison-wrap">
          <div className="pricing-v128-section-head">
            <span className="i20-kicker">Compare</span>
            <h2 className="i20-serif">方案比較</h2>
            <p>「無限」只指會員自己的 Rooms 總時間、安靜在場與純音訊，不代表視訊或全房贊助無限。</p>
          </div>
          <div className="pricing-v128-table-scroll">
            <table className="pricing-v128-table">
              <thead>
                <tr>
                  <th>權益</th>
                  <th>Free</th>
                  {finalPlans.map((plan) => (
                    <th key={plan.code}>{plan.shortTitle}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td>{row.values.free}</td>
                    {finalPlans.map((plan) => (
                      <td key={plan.code}>{row.values[plan.code]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pricing-v128-two-col">
          <article className="pricing-v128-info-card">
            <span className="i20-kicker">Extension Points</span>
            <h2 className="i20-serif">同行延長點怎麼算</h2>
            <p>
              1 點只替 1 位沒有 Rooms 付費權益的使用者延長 25 分鐘。會員自己的延長不扣點，只按實際確認留下的人數扣點。
            </p>
            <div className="pricing-v128-addons">
              {PRODUCT_ADD_ONS.filter((item) => item.extensionPoints).map((item) => (
                <div key={item.code}>
                  <b>{item.title}</b>
                  <span>{item.priceLabel}</span>
                  <small>{item.positioning}</small>
                </div>
              ))}
            </div>
            <p className="pricing-v128-warning">延長點尚未開放購買，必須先完成 server wallet、ledger、退款與 idempotency。</p>
          </article>

          <article className="pricing-v128-info-card">
            <span className="i20-kicker">Visual Usage</span>
            <h2 className="i20-serif">視覺額度用完，不會被趕出 Rooms</h2>
            <p>
              鏡頭、柔焦／馬賽克、螢幕分享會進入視覺同行額度。額度用完後，會員仍可無限使用安靜在場與純音訊。
            </p>
            <div className="pricing-v128-duration-grid">
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

        <article className="pricing-v128-principles">
          <span className="i20-kicker">Rules</span>
          <h2 className="i20-serif">正式切換前的商業安全線</h2>
          <div>
            {VALUE_BASED_PRICING_PRINCIPLES.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <footer>
            <b>{PRICING_V2_POLICY.status}</b>
            <span>{PRICING_V2_POLICY.launchRule}</span>
            <span>{AI_PRICING_POLICY.publicMessage}</span>
          </footer>
        </article>
      </section>

      <Image20Footer />

      <style>{`
        .pricing-v128-stage {
          position: relative;
          z-index: 4;
          margin-top: -88px;
          padding: 0 clamp(22px, 5vw, 90px) 58px;
          background: linear-gradient(180deg, transparent 0, transparent 70px, #071b23 70px, #071b23 100%);
          color: #fff4e5;
        }
        .pricing-v128-production-fact {
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px 32px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 28px;
          border: 1px solid rgba(255, 231, 200, .22);
          border-radius: 26px;
          background: linear-gradient(135deg, rgba(245, 211, 169, .2), rgba(11, 41, 50, .9));
          box-shadow: 0 28px 90px rgba(0,0,0,.26);
          backdrop-filter: blur(18px);
        }
        .pricing-v128-production-fact h2 { margin: 8px 0; font-size: clamp(24px, 3vw, 39px); font-weight: 500; }
        .pricing-v128-production-fact p { max-width: 880px; margin: 0; color: rgba(255,244,229,.76); line-height: 1.8; }
        .pricing-v128-intro {
          max-width: 1500px;
          margin: 58px auto 30px;
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(280px, .7fr);
          gap: 40px;
          align-items: end;
        }
        .pricing-v128-intro h2 { margin: 8px 0 0; font-size: clamp(34px, 4vw, 58px); font-weight: 500; }
        .pricing-v128-intro p { margin: 0; color: rgba(255,244,229,.72); line-height: 1.8; }
        .pricing-v128-plan-grid {
          max-width: 1500px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .pricing-v128-plan {
          min-width: 0;
          padding: 26px;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255, 231, 200, .15);
          border-radius: 26px;
          background: rgba(13, 42, 51, .86);
          box-shadow: 0 22px 60px rgba(0,0,0,.18);
        }
        .pricing-v128-plan.featured { border-color: rgba(244, 207, 158, .72); transform: translateY(-10px); background: linear-gradient(180deg, rgba(91,74,50,.78), rgba(13,42,51,.94)); }
        .pricing-v128-plan-head { min-height: 26px; display: flex; justify-content: space-between; gap: 10px; color: rgba(255,244,229,.6); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .pricing-v128-plan-head b { padding: 4px 9px; border-radius: 99px; background: #f1d2aa; color: #183038; font-size: 11px; }
        .pricing-v128-plan h2 { margin: 22px 0 8px; font-family: Georgia, "Noto Serif TC", serif; font-size: 28px; font-weight: 500; }
        .pricing-v128-positioning { min-height: 76px; margin: 0; color: rgba(255,244,229,.68); line-height: 1.7; }
        .pricing-v128-price { margin: 24px 0 4px; font-family: Georgia, serif; font-size: 31px; }
        .pricing-v128-saving { margin: 2px 0 0; color: #f4cf9e; font-size: 13px; }
        .pricing-v128-job { min-height: 84px; margin: 20px 0; padding: 14px 0; border-top: 1px solid rgba(255,255,255,.1); border-bottom: 1px solid rgba(255,255,255,.1); color: rgba(255,244,229,.78); line-height: 1.7; }
        .pricing-v128-plan ul { min-height: 154px; margin: 0; padding: 0; list-style: none; }
        .pricing-v128-plan li { position: relative; margin: 0 0 10px; padding-left: 20px; color: rgba(255,244,229,.8); line-height: 1.55; }
        .pricing-v128-plan li::before { content: "·"; position: absolute; left: 2px; color: #f2c98f; }
        .pricing-v128-boundary { min-height: 112px; margin: 18px 0; padding: 14px; display: grid; gap: 6px; border-radius: 16px; background: rgba(255,255,255,.05); }
        .pricing-v128-boundary b { font-size: 12px; color: #efc792; }
        .pricing-v128-boundary span { color: rgba(255,244,229,.64); font-size: 13px; line-height: 1.6; }
        .pricing-v128-ivory { padding: 74px clamp(22px, 5vw, 90px) 90px; background: #f3ede3; color: #19282d; }
        .pricing-v128-free-card, .pricing-v128-principles, .pricing-v128-info-card, .pricing-v128-comparison-wrap {
          max-width: 1500px;
          margin-left: auto;
          margin-right: auto;
          border: 1px solid rgba(31, 52, 57, .12);
          border-radius: 28px;
          background: rgba(255,255,255,.52);
          box-shadow: 0 22px 70px rgba(38,44,43,.07);
        }
        .pricing-v128-free-card { padding: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px 50px; }
        .pricing-v128-free-card h2, .pricing-v128-section-head h2, .pricing-v128-info-card h2, .pricing-v128-principles h2 { margin: 8px 0 12px; font-weight: 500; }
        .pricing-v128-free-card p { color: rgba(25,40,45,.7); line-height: 1.75; }
        .pricing-v128-free-card ul { margin: 0; padding-left: 20px; line-height: 1.8; }
        .pricing-v128-free-note { grid-column: 1 / -1; margin: 0 !important; padding-top: 18px; border-top: 1px solid rgba(31,52,57,.1); }
        .pricing-v128-comparison-wrap { margin-top: 28px; padding: 30px; }
        .pricing-v128-section-head { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 40px; align-items: end; }
        .pricing-v128-section-head > span { grid-column: 1 / -1; }
        .pricing-v128-section-head p { margin: 0; color: rgba(25,40,45,.68); line-height: 1.75; }
        .pricing-v128-table-scroll { margin-top: 26px; overflow-x: auto; }
        .pricing-v128-table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 14px; }
        .pricing-v128-table th, .pricing-v128-table td { padding: 14px 12px; border-bottom: 1px solid rgba(31,52,57,.1); text-align: center; vertical-align: middle; }
        .pricing-v128-table th:first-child { text-align: left; }
        .pricing-v128-table thead th { color: rgba(25,40,45,.62); font-size: 12px; letter-spacing: .05em; }
        .pricing-v128-table tbody th { font-weight: 600; }
        .pricing-v128-two-col { max-width: 1500px; margin: 28px auto; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .pricing-v128-info-card { margin: 0; padding: 30px; }
        .pricing-v128-info-card > p { color: rgba(25,40,45,.68); line-height: 1.78; }
        .pricing-v128-addons { display: grid; gap: 10px; margin-top: 22px; }
        .pricing-v128-addons > div { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 14px; border-radius: 16px; background: rgba(25,40,45,.05); }
        .pricing-v128-addons small { grid-column: 1 / -1; color: rgba(25,40,45,.6); }
        .pricing-v128-warning { padding: 12px 14px; border-left: 3px solid #967554; background: rgba(150,117,84,.08); }
        .pricing-v128-duration-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 22px; }
        .pricing-v128-duration-grid > div { padding: 15px; display: grid; gap: 4px; border-radius: 16px; background: rgba(25,40,45,.05); }
        .pricing-v128-duration-grid b { font-size: 24px; font-family: Georgia, serif; }
        .pricing-v128-duration-grid span { color: rgba(25,40,45,.62); font-size: 13px; }
        .pricing-v128-principles { padding: 34px; }
        .pricing-v128-principles > div { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 28px; }
        .pricing-v128-principles p { margin: 0; padding: 14px 0; border-bottom: 1px solid rgba(31,52,57,.09); color: rgba(25,40,45,.7); line-height: 1.75; }
        .pricing-v128-principles footer { margin-top: 22px; padding: 18px; display: grid; gap: 7px; border-radius: 18px; background: #102d35; color: #fff0dc; }
        .pricing-v128-principles footer span { color: rgba(255,240,220,.7); line-height: 1.65; }
        .pricing-v16-action-wrap { margin-top: auto; }
        .pricing-v16-cta { width: 100%; border: 0; border-radius: 999px; padding: 13px 18px; background: #f0d0a5; color: #153038; font-weight: 700; cursor: pointer; }
        .pricing-v16-cta:disabled { cursor: not-allowed; opacity: .72; }
        .pricing-v107-action-note { margin: 9px 0 0; color: rgba(255,244,229,.64); font-size: 12px; line-height: 1.55; }
        @media (max-width: 1180px) {
          .pricing-v128-plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pricing-v128-plan.featured { transform: none; }
        }
        @media (max-width: 760px) {
          .pricing-v128-stage { margin-top: -48px; padding-left: 16px; padding-right: 16px; }
          .pricing-v128-production-fact, .pricing-v128-intro, .pricing-v128-free-card, .pricing-v128-section-head, .pricing-v128-two-col { grid-template-columns: 1fr; }
          .pricing-v128-plan-grid { grid-template-columns: 1fr; }
          .pricing-v128-positioning, .pricing-v128-job, .pricing-v128-plan ul, .pricing-v128-boundary { min-height: 0; }
          .pricing-v128-ivory { padding-left: 16px; padding-right: 16px; }
          .pricing-v128-principles > div { grid-template-columns: 1fr; }
          .pricing-v128-duration-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
