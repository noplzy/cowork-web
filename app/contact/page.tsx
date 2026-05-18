import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const CONTACT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSePIg1i9YDIxPWeWnaxTjJ2a-NTrAGp1qhwINFN63KZYtMkYw/viewform?usp=dialog";
const SUPPORT_EMAIL = "unmixed@getcalmandco.com";

const supportCards = [
  {
    eyebrow: "Form",
    title: "客服表單",
    body: "房間、付款、帳號與合作問題，都可以透過表單留下完整資訊。",
    href: CONTACT_FORM_URL,
    external: true,
    cta: "前往填寫",
  },
  {
    eyebrow: "Email",
    title: "官方信箱",
    body: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    external: false,
    cta: "寄信給我們",
  },
  {
    eyebrow: "Policy",
    title: "退款與交付",
    body: "需要先確認退款、服務交付與處理範圍，可先查看公開說明。",
    href: "/refund-policy",
    external: false,
    cta: "查看政策",
  },
  {
    eyebrow: "Safety",
    title: "安全與支援",
    body: "遇到房內異常、騷擾或安全疑慮，請優先留下完整事件資訊。",
    href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("安感島安全與支援協助")}`,
    external: false,
    cta: "立即聯絡",
  },
] as const;

export default function ContactPage() {
  return (
    <main className="i20-root" data-image20-dom-page="contact-v10-template-aligned">
      <section className={styles.contactHero}>
        <div className={styles.contactHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.contactHeroGrid}>
          <article className={styles.contactIntro}>
            <span className="i20-kicker">Contact</span>
            <h1 className="i20-serif">有需要時，我們都在這裡。</h1>
            <p>
              不論是房間使用、方案付款、帳號安全，或服務上的疑問，
              安感島會把支援入口放在清楚的位置，讓你不用猜要找誰。
            </p>

            <div className={styles.contactResponseCard}>
              <b>回覆節奏</b>
              <span>一般詢問會依序回覆；付款、房間或帳號異常請附上時間與關鍵資訊。</span>
            </div>
          </article>

          <section className={styles.contactSupportColumn} aria-label="客服入口">
            <div className={styles.contactColumnTitle}>聯繫安感島團隊</div>

            {supportCards.map((card) => {
              const content = (
                <>
                  <div>
                    <span>{card.eyebrow}</span>
                    <strong>{card.title}</strong>
                    <p>{card.body}</p>
                  </div>
                  <b>{card.cta} →</b>
                </>
              );

              return card.external ? (
                <a
                  className={styles.contactSupportCard}
                  href={card.href}
                  key={card.title}
                  target="_blank"
                  rel="noreferrer"
                >
                  {content}
                </a>
              ) : (
                <Link className={styles.contactSupportCard} href={card.href} key={card.title}>
                  {content}
                </Link>
              );
            })}
          </section>

          <aside className={styles.contactActionPanel}>
            <span className="i20-kicker">Help Desk</span>
            <h2 className="i20-serif">需要協助，直接選擇最順手的方式。</h2>
            <p>
              已經準備好問題內容時，使用客服表單最完整；需要補充檔案或長訊息時，
              可直接寄信至官方客服信箱。
            </p>

            <div className={styles.contactActionButtons}>
              <a
                className="i20-btn peach"
                href={CONTACT_FORM_URL}
                target="_blank"
                rel="noreferrer"
              >
                填寫客服表單
              </a>
              <a className="i20-btn ghost" href={`mailto:${SUPPORT_EMAIL}`}>
                寄信給客服
              </a>
            </div>

            <div className={styles.contactActionMeta}>
              <div>
                <span>官方 Email</span>
                <b>{SUPPORT_EMAIL}</b>
              </div>
              <div>
                <span>營運單位</span>
                <b>安感島資訊服務工作室</b>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}
