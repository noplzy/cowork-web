import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const trustItems = [
  {
    title: "透明方案",
    body: "會員、AI 主持、房主贊助分開標示。",
  },
  {
    title: "舒服在場",
    body: "不強迫開鏡頭，可選安靜、音訊、柔焦或開鏡頭。",
  },
  {
    title: "支援排程",
    body: "可依照你的節奏建立好友房、邀請制房與活動房。",
  },
  {
    title: "真人協助",
    body: "方案、退款與房主贊助，都可以先問客服。",
  },
] as const;

const plans = [
  {
    kicker: "FREE",
    icon: "☘",
    title: "免費體驗",
    subtitle: "適合先感受陪伴氛圍的你",
    price: "0",
    cycle: "/ 月",
    benefits: ["每月 4 場 25 分鐘同行房", "每月 1 場 50 分鐘體驗房", "可加入公開、好友與邀請制房", "1 點 AI 主持體驗額度"],
    href: "/rooms",
    cta: "立即開始",
    featured: false,
    pale: false,
  },
  {
    kicker: "MEMBER",
    icon: "♡",
    title: "安心同行",
    subtitle: "日常陪伴的好選擇",
    price: "299",
    cycle: "/ 月",
    benefits: ["可使用 25 / 50 / 75 分鐘一般房", "可建立好友房與邀請制房", "2 人房任一方 VIP 可延長", "每月 8 點 AI 主持額度"],
    href: "/contact",
    cta: "選擇此方案",
    featured: false,
    pale: false,
  },
  {
    kicker: "最受歡迎",
    icon: "☆",
    title: "常駐同行",
    subtitle: "穩定陪伴，讓每週更順",
    price: "599",
    cycle: "/ 月",
    benefits: ["包含安心同行主要權益", "每月 2 場 90 分鐘活動房", "每月 32 點 AI 主持額度", "文字救援、語音陪跑與房後摘要"],
    href: "/contact",
    cta: "選擇此方案",
    featured: true,
    pale: false,
  },
  {
    kicker: "HOST",
    icon: "♕",
    title: "主持島民",
    subtitle: "成為陪伴的引導者",
    price: "1,299",
    cycle: "/ 月",
    benefits: ["每月 8 場 90 分鐘活動房", "每月 100 點 AI 主持額度", "好友延長券與活動摘要", "房主主持控制台與贊助標籤"],
    href: "/contact",
    cta: "選擇此方案",
    featured: false,
    pale: true,
  },
] as const;

const helperItems = [
  {
    icon: "›",
    title: "怎麼開始",
    body: "註冊後可先從免費體驗開始，幾秒鐘就能加入第一個空間。",
    href: "/rooms",
  },
  {
    icon: "≋",
    title: "方案怎麼選",
    body: "固定進房看安心同行；高頻使用看常駐同行；常開房看主持島民。",
    href: "/contact",
  },
  {
    icon: "×",
    title: "可以取消嗎",
    body: "方案、AI 加購與活動包規則，以正式公告與客服確認為準。",
    href: "/refund-policy",
  },
  {
    icon: "♧",
    title: "需要幫忙嗎",
    body: "有任何問題都可以聯絡我們，包含活動房、房主贊助與退款協助。",
    href: "/contact",
  },
] as const;

const notes = [
  "25 / 50 / 75 為一般房；90 分鐘主要給活動房、主題房與 Studio 使用。",
  "Global Guide 不做昂貴 LLM 陪聊；AI 價值集中在房內 Shared Host。",
  "1 點 Host Credit = 25 分鐘 AI 主持；Personal Room AI 只做開始、卡住與收尾救援。",
  "安感夥伴真人服務交易方案另行定義，不與本頁會員方案混在一起。",
] as const;

export default function PricingPage() {
  return (
    <main className="i20-root" data-image20-dom-page="pricing-v16-cinematic-pricing">
      <section className={styles.pricingHero}>
        <div className={styles.pricingHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.pricingHeroCopy}>
          <span className="i20-kicker">Pricing</span>
          <h1 className="i20-serif">方案 / 價格</h1>
          <p>選擇適合你的陪伴方式。先輕鬆開始，再依照你的節奏慢慢延伸。</p>
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

        <div className="pricing-v16-plan-row">
          {plans.map((plan) => (
            <article
              key={plan.title}
              className={[
                "pricing-v16-plan-card",
                plan.featured ? "pricing-v16-plan-featured" : "",
                plan.pale ? "pricing-v16-plan-pale" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="pricing-v16-kicker">{plan.kicker}</span>
              <div className="pricing-v16-icon" aria-hidden="true">
                {plan.icon}
              </div>
              <h2>{plan.title}</h2>
              <p className="pricing-v16-subtitle">{plan.subtitle}</p>
              <div className="pricing-v16-price">
                <span>NT$</span>
                <strong>{plan.price}</strong>
                <em>{plan.cycle}</em>
              </div>
              <ul>
                {plan.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <Link href={plan.href} className="pricing-v16-cta">
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-v16-ivory" aria-label="方案協助">
        <div className="pricing-v16-helper-row">
          {helperItems.map((item) => (
            <Link href={item.href} key={item.title} className="pricing-v16-helper-card">
              <span aria-hidden="true">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Link>
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
          padding: 0 clamp(28px, 6vw, 110px) 16px;
          background: linear-gradient(180deg, rgba(6, 24, 32, 0) 0, rgba(6, 24, 32, 0) 86px, #071b23 86px, #071b23 360px, #f3ede3 360px);
        }

        .pricing-v16-trust-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border: 1px solid rgba(255, 229, 201, 0.16);
          border-radius: 0;
          overflow: hidden;
          background: rgba(12, 31, 39, 0.72);
          color: #fff2df;
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
        }

        .pricing-v16-trust-strip article {
          min-height: 88px;
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
          position: relative;
          min-width: 0;
          min-height: 356px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 26px 30px 28px;
          border-radius: 20px;
          border: 1px solid rgba(45, 34, 26, 0.18);
          background: linear-gradient(180deg, #fbf3e8 0%, #efe3d4 100%);
          color: #2f2923;
          text-align: center;
          box-shadow: 0 28px 68px rgba(0, 0, 0, 0.22);
        }

        .pricing-v16-plan-pale {
          background: linear-gradient(180deg, #fbf1e7 0%, #efdfce 100%);
        }

        .pricing-v16-plan-featured {
          transform: translateY(-14px);
          background: radial-gradient(circle at 50% 0%, rgba(255, 214, 170, 0.16), transparent 42%), linear-gradient(180deg, #544b41 0%, #1f2728 100%);
          color: #fff0dc;
          border-color: rgba(229, 158, 111, 0.78);
          box-shadow: 0 0 0 1px rgba(248, 199, 138, 0.34), 0 32px 82px rgba(0, 0, 0, 0.34);
        }

        .pricing-v16-plan-featured::before {
          content: "最受歡迎";
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 26px 6px;
          border-radius: 0 0 16px 16px;
          background: linear-gradient(180deg, rgba(236, 174, 123, 0.96), rgba(218, 133, 92, 0.96));
          color: #fff8ef;
          font-size: 13px;
          letter-spacing: 0.16em;
        }

        .pricing-v16-kicker {
          display: block;
          min-height: 16px;
          color: #db956e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .pricing-v16-icon {
          margin: 10px 0 6px;
          color: rgba(143, 106, 79, 0.68);
          font-size: 34px;
          line-height: 1;
        }

        .pricing-v16-plan-featured .pricing-v16-icon {
          color: #f0c48d;
        }

        .pricing-v16-plan-card h2 {
          margin: 0;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: clamp(27px, 1.75vw, 36px);
          line-height: 1.15;
          font-weight: 500;
          letter-spacing: 0.12em;
        }

        .pricing-v16-subtitle {
          min-height: 42px;
          margin: 8px 0 16px;
          color: #7b6b5d;
          font-size: 15px;
          line-height: 1.6;
        }

        .pricing-v16-plan-featured .pricing-v16-subtitle {
          color: rgba(255, 240, 220, 0.76);
        }

        .pricing-v16-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 5px;
          margin: 0 0 18px;
          white-space: nowrap;
        }

        .pricing-v16-price span,
        .pricing-v16-price em {
          color: inherit;
          opacity: 0.82;
          font-size: 15px;
          font-style: normal;
        }

        .pricing-v16-price strong {
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: clamp(38px, 2.6vw, 52px);
          line-height: 1;
          font-weight: 500;
          letter-spacing: 0.03em;
        }

        .pricing-v16-plan-card ul {
          display: grid;
          gap: 8px;
          width: 100%;
          margin: 0 0 22px;
          padding: 0;
          list-style: none;
          color: #665a50;
          text-align: left;
          font-size: 14px;
          line-height: 1.55;
        }

        .pricing-v16-plan-featured ul {
          color: rgba(255, 240, 220, 0.82);
        }

        .pricing-v16-plan-card li {
          position: relative;
          padding-left: 20px;
        }

        .pricing-v16-plan-card li::before {
          content: "✓";
          position: absolute;
          left: 0;
          top: 0;
          color: #d98f67;
          font-weight: 900;
        }

        .pricing-v16-cta {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-width: 168px;
          margin-top: auto;
          padding: 13px 22px;
          border-radius: 12px;
          background: linear-gradient(180deg, #eea07b, #dd7f5b);
          color: #fffaf3;
          text-decoration: none;
          font-weight: 700;
          letter-spacing: 0.08em;
          box-shadow: 0 15px 30px rgba(201, 111, 77, 0.25);
        }

        .pricing-v16-plan-card:not(.pricing-v16-plan-featured) .pricing-v16-cta {
          background: #e38e69;
          color: #fff8ef;
          box-shadow: none;
        }

        .pricing-v16-ivory {
          margin-top: -1px;
          padding: 36px clamp(28px, 6vw, 110px) 50px;
          background: #f3ede3;
        }

        .pricing-v16-helper-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          max-width: 1600px;
          margin: 0 auto 22px;
          border-top: 1px solid rgba(84, 64, 48, 0.16);
          border-bottom: 1px solid rgba(84, 64, 48, 0.16);
        }

        .pricing-v16-helper-card {
          display: grid;
          grid-template-columns: 62px 1fr;
          gap: 18px;
          min-height: 116px;
          padding: 24px 26px;
          border-right: 1px solid rgba(84, 64, 48, 0.16);
          color: #3a2f27;
          text-decoration: none;
        }

        .pricing-v16-helper-card:last-child {
          border-right: 0;
        }

        .pricing-v16-helper-card > span {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(111, 84, 62, 0.09);
          color: #2e2a25;
          font-size: 28px;
          font-family: Georgia, serif;
        }

        .pricing-v16-helper-card h3 {
          margin: 0 0 8px;
          font-family: Georgia, "Noto Serif TC", serif;
          font-size: 23px;
          line-height: 1.25;
          font-weight: 500;
          letter-spacing: 0.06em;
        }

        .pricing-v16-helper-card p {
          margin: 0;
          color: #7a6f65;
          font-size: 14px;
          line-height: 1.68;
        }

        .pricing-v16-note-bar {
          max-width: 1600px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          color: #6f655d;
          font-size: 13px;
          line-height: 1.62;
        }

        .pricing-v16-note-bar p {
          margin: 0;
          padding: 0 22px;
          border-right: 1px solid rgba(84, 64, 48, 0.14);
        }

        .pricing-v16-note-bar p:first-child {
          padding-left: 0;
        }

        .pricing-v16-note-bar p:last-child {
          border-right: 0;
        }

        @media (max-width: 1220px) {
          .pricing-v16-plan-row,
          .pricing-v16-trust-strip,
          .pricing-v16-helper-row,
          .pricing-v16-note-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pricing-v16-stage {
            background: linear-gradient(180deg, rgba(6, 24, 32, 0) 0, rgba(6, 24, 32, 0) 86px, #071b23 86px, #071b23 640px, #f3ede3 640px);
          }

          .pricing-v16-plan-featured {
            transform: none;
          }

          .pricing-v16-trust-strip article:nth-child(2),
          .pricing-v16-helper-card:nth-child(2),
          .pricing-v16-note-bar p:nth-child(2) {
            border-right: 0;
          }

          .pricing-v16-trust-strip article:nth-child(-n + 2),
          .pricing-v16-helper-card:nth-child(-n + 2) {
            border-bottom: 1px solid rgba(255, 229, 201, 0.14);
          }

          .pricing-v16-note-bar p {
            padding: 12px 22px;
            border-bottom: 1px solid rgba(84, 64, 48, 0.12);
          }
        }

        @media (max-width: 720px) {
          .pricing-v16-stage {
            margin-top: -48px;
            padding-inline: 18px;
            background: linear-gradient(180deg, rgba(6, 24, 32, 0) 0, rgba(6, 24, 32, 0) 48px, #071b23 48px, #071b23 1520px, #f3ede3 1520px);
          }

          .pricing-v16-plan-row,
          .pricing-v16-trust-strip,
          .pricing-v16-helper-row,
          .pricing-v16-note-bar {
            grid-template-columns: 1fr;
          }

          .pricing-v16-trust-strip article,
          .pricing-v16-helper-card,
          .pricing-v16-note-bar p {
            border-right: 0;
          }

          .pricing-v16-plan-card {
            min-height: auto;
          }

          .pricing-v16-ivory {
            padding-inline: 18px;
          }

          .pricing-v16-helper-card {
            grid-template-columns: 52px 1fr;
          }
        }
      `}</style>
    </main>
  );
}
