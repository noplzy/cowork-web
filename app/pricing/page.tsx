import Link from "next/link";
import { PricingCheckoutButton } from "@/components/billing/PricingCheckoutButton";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";
import { PRODUCT_PLANS, VALUE_BASED_PRICING_PRINCIPLES, HOST_CREDIT_ADDONS } from "@/lib/productCatalog";

const trustItems = [
  { title: "價格不誤導", body: "目前可付款與下一版規劃分開標示，不把尚未完成的權益寫成已開放。" },
  { title: "舒服在場", body: "不強迫開鏡頭，可選安靜、音訊、柔焦或開鏡頭。" },
  { title: "AI 不吃到飽", body: "安感島不賣無限個人 AI 陪聊，價值集中在 Shared Host AI。" },
  { title: "可營運帳務", body: "付款、發票、退款、客服與 ledger 必須對得起來。" },
] as const;

const helperItems = [
  { icon: "›", title: "怎麼開始", body: "先從目前開放的 VIP 試營運方案或免費房間開始。", href: "/rooms" },
  { icon: "≋", title: "方案怎麼選", body: "正式訂閱方案尚未開放付款，避免前台承諾超過後台能力。", href: "/account/billing" },
  { icon: "×", title: "可以退款嗎", body: "退款會建立正式申請與客服紀錄，由營運審核處理。", href: "/account/refunds" },
  { icon: "♧", title: "需要幫忙嗎", body: "未登入可用公開表單；登入後建議使用站內客服單。", href: "/account/support" },
] as const;

export default function PricingPage() {
  const visiblePlans = PRODUCT_PLANS.filter((plan) => plan.code !== "free");

  return (
    <main className="i20-root" data-image20-dom-page="pricing-v107-value-based-catalog">
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
          {trustItems.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}
        </div>

        <div className="pricing-v16-plan-row">
          {visiblePlans.map((plan) => (
            <article key={plan.code} className={["pricing-v16-plan-card", plan.purchaseEnabled ? "pricing-v16-plan-featured" : "", plan.stage === "coming_soon" ? "pricing-v16-plan-pale" : ""].filter(Boolean).join(" ")}>
              <span className="pricing-v16-kicker">{plan.purchaseEnabled ? "目前開放" : "正式規劃"}</span>
              <div className="pricing-v16-icon" aria-hidden="true">{plan.purchaseEnabled ? "♡" : "☆"}</div>
              <h2>{plan.title}</h2>
              <p className="pricing-v16-subtitle">{plan.subtitle}</p>
              <div className="pricing-v16-price"><span>{plan.amountTwd ? "NT$" : ""}</span><strong>{plan.amountTwd ? plan.amountTwd.toLocaleString("zh-TW") : "—"}</strong><em>{plan.billingMode === "subscription" ? " / 月" : ""}</em></div>
              <ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
              <Link href="/account/support" className="pricing-v16-support-link">詢問方案</Link>
              <PricingCheckoutButton planCode={plan.code} disabled={!plan.purchaseEnabled} disabledReason={plan.disabledReason}>
                {plan.purchaseEnabled ? "購買此方案" : "尚未開放付款"}
              </PricingCheckoutButton>
              {!plan.purchaseEnabled && plan.disabledReason ? <p className="pricing-v106-disabled">{plan.disabledReason}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-v16-ivory" aria-label="方案協助">
        <div className="pricing-v16-helper-row">{helperItems.map((item) => <Link href={item.href} key={item.title} className="pricing-v16-helper-card"><span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></Link>)}</div>
        <div className="pricing-v16-note-bar">
          <p>一般即時同行空間正式規格為 25 / 50 / 75 分鐘；90 分鐘保留給活動房，100 分鐘不再作為正式規格。</p>
          <p>正式訂閱方案會等自動續扣、取消、退款、發票與客服流程完成後再開放。</p>
          <p>AI 相關 Host Credit 屬於正式規劃，不代表目前已開放商業使用。</p>
        </div>
        <div className="pricing-v107-principles">{VALUE_BASED_PRICING_PRINCIPLES.map((item) => <p key={item}>{item}</p>)}</div>
        <div className="pricing-v107-addon-row">{HOST_CREDIT_ADDONS.map((addon) => <article key={addon.code}><span className="i20-kicker">Host Credit</span><h3>{addon.title}</h3><b>{addon.priceLabel}</b><p>AI active cap：{addon.activeCapSeconds} 秒</p></article>)}</div>
      </section>

      <Image20Footer />

      <style>{`
        .pricing-v16-stage{position:relative;z-index:4;margin-top:-98px;padding:0 clamp(28px,6vw,110px) 16px;background:linear-gradient(180deg,rgba(6,24,32,0) 0,rgba(6,24,32,0) 86px,#071b23 86px,#071b23 360px,#f3ede3 360px)}
        .pricing-v16-trust-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid rgba(255,229,201,.16);overflow:hidden;background:rgba(12,31,39,.72);color:#fff2df;backdrop-filter:blur(18px);box-shadow:0 22px 70px rgba(0,0,0,.22)}
        .pricing-v16-trust-strip article{min-height:88px;padding:20px 28px 18px;border-right:1px solid rgba(255,229,201,.18)}.pricing-v16-trust-strip article:last-child{border-right:0}.pricing-v16-trust-strip h3{margin:0 0 5px;font-family:Georgia,"Noto Serif TC",serif;font-size:18px;font-weight:500;letter-spacing:.08em}.pricing-v16-trust-strip p{margin:0;color:rgba(255,242,223,.7);font-size:13px;line-height:1.62}
        .pricing-v16-plan-row{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;margin:36px auto 0;max-width:1600px}.pricing-v16-plan-card{position:relative;min-width:0;min-height:430px;display:flex;flex-direction:column;align-items:center;padding:26px 30px 28px;border-radius:20px;border:1px solid rgba(45,34,26,.18);background:#fffaf2;color:#2e2119;box-shadow:0 18px 46px rgba(38,24,14,.12)}.pricing-v16-plan-featured{background:#fff3e1;transform:translateY(-12px)}.pricing-v16-plan-pale{opacity:.82}.pricing-v16-kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9b674c}.pricing-v16-icon{margin:12px 0;font-size:34px}.pricing-v16-plan-card h2{margin:0;font-family:Georgia,"Noto Serif TC",serif;font-size:25px}.pricing-v16-subtitle{min-height:44px;margin:8px 0 12px;color:rgba(46,33,25,.66);text-align:center}.pricing-v16-price{display:flex;align-items:baseline;gap:5px;margin:6px 0 18px}.pricing-v16-price strong{font-size:40px;font-family:Georgia,"Noto Serif TC",serif}.pricing-v16-price em{font-style:normal;color:rgba(46,33,25,.6)}.pricing-v16-plan-card ul{width:100%;margin:0 0 20px;padding-left:18px;line-height:1.75;color:rgba(46,33,25,.75)}.pricing-v16-cta{width:100%;padding:13px 16px;text-align:center;border-radius:999px;background:#0f3038;color:#fff7ed;text-decoration:none;border:0;cursor:pointer}.pricing-v16-cta[aria-disabled="true"]{background:rgba(46,33,25,.22);color:rgba(46,33,25,.62)}.pricing-v16-action-wrap{margin-top:auto;width:100%;display:grid;gap:8px}.pricing-v107-action-note{margin:0;font-size:12px;color:rgba(46,33,25,.62);line-height:1.5}.pricing-v16-support-link{display:block;margin:8px 0 10px;text-align:center;color:#9b674c;text-decoration:none;font-size:13px}.pricing-v106-disabled{margin:14px 0 0;font-size:12px;line-height:1.6;color:rgba(46,33,25,.58);text-align:center}
        .pricing-v16-ivory{padding:44px clamp(28px,6vw,110px) 70px;background:#f3ede3}.pricing-v16-helper-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.pricing-v16-helper-card{display:flex;gap:14px;padding:22px;border:1px solid rgba(45,34,26,.13);border-radius:18px;background:rgba(255,250,242,.72);text-decoration:none;color:#2e2119}.pricing-v16-helper-card span{font-size:26px}.pricing-v16-helper-card h3{margin:0 0 6px;font-family:Georgia,"Noto Serif TC",serif}.pricing-v16-helper-card p{margin:0;color:rgba(46,33,25,.66);line-height:1.62}.pricing-v16-note-bar,.pricing-v107-principles{margin-top:26px;padding:20px 24px;border-radius:18px;background:rgba(255,250,242,.66);color:rgba(46,33,25,.68);line-height:1.7}.pricing-v107-addon-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:26px}.pricing-v107-addon-row article{padding:20px;border:1px solid rgba(45,34,26,.13);border-radius:18px;background:rgba(255,250,242,.72);color:#2e2119}.pricing-v107-addon-row h3{margin:8px 0;font-family:Georgia,"Noto Serif TC",serif}.pricing-v107-addon-row b{font-size:24px;font-family:Georgia,"Noto Serif TC",serif}.pricing-v107-addon-row p{color:rgba(46,33,25,.62);line-height:1.6}
        @media(max-width:1100px){.pricing-v16-trust-strip,.pricing-v16-plan-row,.pricing-v16-helper-row,.pricing-v107-addon-row{grid-template-columns:1fr 1fr}}@media(max-width:720px){.pricing-v16-trust-strip,.pricing-v16-plan-row,.pricing-v16-helper-row,.pricing-v107-addon-row{grid-template-columns:1fr}.pricing-v16-plan-featured{transform:none}}
      `}</style>
    </main>
  );
}
