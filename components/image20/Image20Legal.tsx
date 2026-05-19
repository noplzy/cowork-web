import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type LegalVariant = "refund" | "terms" | "privacy" | "delivery";

type LegalHighlight = {
  label: string;
  title: string;
  body: string;
};

type LegalSection = {
  title: string;
  body: string[];
};

type LegalAsideLink = {
  href: string;
  label: string;
};

const summaryTitleByVariant: Record<LegalVariant, string> = {
  refund: "退款重點摘要",
  terms: "條款重點摘要",
  privacy: "隱私權重點摘要",
  delivery: "服務交付流程",
};

const summaryLeadByVariant: Record<LegalVariant, string> = {
  refund: "付款、取消與協助範圍先說清楚，才能讓後續處理更一致。",
  terms: "平台定位、互動邊界與使用責任，應該讓每個人都能快速理解。",
  privacy: "資料用途、房內互動與 AI 邊界，必須說得具體而且可查。",
  delivery: "從加入、進房、排程到異常處理，把服務如何開始與完成講明白。",
};

export function Image20LegalPage({
  variant,
  eyebrow,
  title,
  lead,
  sections,
  highlights,
  asideTitle = "需要進一步協助？",
  asideBody = "若你希望確認方案、付款或個資處理方式，可從客服頁與相關政策頁快速找到對應入口。",
  asideLinks = [
    { href: "/contact", label: "聯絡客服" },
    { href: "/pricing", label: "查看方案 / 價格" },
    { href: "/refund-policy", label: "查看退款政策" },
  ],
}: {
  variant: LegalVariant;
  eyebrow: string;
  title: string;
  lead: string;
  sections: LegalSection[];
  highlights: LegalHighlight[];
  asideTitle?: string;
  asideBody?: string;
  asideLinks?: LegalAsideLink[];
}) {
  return (
    <main
      className={`i20-root ${styles.policyRoot}`}
      data-variant={variant}
      data-image20-dom-page={`legal-${variant}-v12`}
    >
      <section className={styles.policyHero}>
        <div className={styles.policyHeroBackdrop} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.policyHeroGrid}>
          <article className={styles.policyHeroCopy}>
            <span className="i20-kicker">{eyebrow}</span>
            <h1 className="i20-serif">{title}</h1>
            <p>{lead}</p>
          </article>

          <aside className={styles.policyHeroNotice}>
            <span className="i20-kicker">Support</span>
            <h2 className="i20-serif">{asideTitle}</h2>
            <p>{asideBody}</p>
            <div className={styles.policyHeroActions}>
              {asideLinks.slice(0, 2).map((item, index) => (
                <Link
                  className={`i20-btn ${index === 0 ? "peach" : "ghost"}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.policySummaryBand}>
        <div className={styles.policySummaryLead}>
          <span className="i20-kicker">Summary</span>
          <h2 className="i20-serif">{summaryTitleByVariant[variant]}</h2>
          <p>{summaryLeadByVariant[variant]}</p>
        </div>

        <div className={styles.policyHighlightGrid}>
          {highlights.map((item) => (
            <article className={styles.policyHighlightCard} key={item.title}>
              <span>{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.policyBody}>
        <div className={styles.policyArticleGrid}>
          {sections.map((section, index) => (
            <article className={styles.policyArticleCard} key={section.title}>
              <span className="i20-kicker">{String(index + 1).padStart(2, "0")}</span>
              <h3>{section.title}</h3>
              <ul>
                {section.body.map((paragraph, paragraphIndex) => (
                  <li key={`${section.title}-${paragraphIndex}`}>{paragraph}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <aside className={styles.policyAside}>
          <span className="i20-kicker">Need Help</span>
          <h3 className="i20-serif">{asideTitle}</h3>
          <p>{asideBody}</p>
          <div className={styles.policyAsideLinks}>
            {asideLinks.map((item, index) => (
              <Link
                className={`i20-btn ${index === 0 ? "peach" : "ghost"}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.policyBottomBand}>
        <div>
          <b>公開政策會隨正式服務內容與營運流程同步調整。</b>
          <span>頁面公開後，以網站當下公告版本為準；有疑問時請直接聯絡客服確認。</span>
        </div>
        <Link href="/contact" className="i20-btn light">
          對內容有疑問
        </Link>
      </section>

      <Image20Footer />
    </main>
  );
}
