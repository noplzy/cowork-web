import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { Image20Hero } from "@/components/image20/Image20Shared";
import styles from "@/components/image20/Image20Auxiliary.module.css";

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

export function Image20LegalPage({
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
      className="i20-root i20-legal-root"
      data-image20-dom-page={`legal-${eyebrow.toLowerCase().replaceAll(" ", "-")}-v9`}
    >
      <Image20TopNav dark />
      <Image20Hero small eyebrow={eyebrow} title={title} lead={lead} />

      <section className={`i20-legal-body ${styles.contentBand}`}>
        <div className={styles.legalSummaryGrid}>
          {highlights.map((item) => (
            <article className={`i20-card ${styles.legalSummaryCard}`} key={item.title}>
              <span>{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.legalLayout}>
          <div className={styles.legalArticleGrid}>
            {sections.map((section) => (
              <article className={`i20-card ${styles.legalArticle}`} key={section.title}>
                <span className="i20-kicker">Policy</span>
                <h3>{section.title}</h3>
                <ul>
                  {section.body.map((paragraph, index) => (
                    <li key={`${section.title}-${index}`}>{paragraph}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <aside className={`i20-panel dark ${styles.legalAsideStack}`}>
            <span className="i20-kicker">Support</span>
            <h3>{asideTitle}</h3>
            <p>{asideBody}</p>
            <div className={styles.legalAsideLinks}>
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
        </div>

        <div className={`i20-softbar ${styles.legalBottomBar}`}>
          <span>政策內容會隨服務範圍與正式營運版本調整；頁面公開後，以當下網站公告為準。</span>
          <Link href="/contact" className="i20-btn light">
            對內容有疑問
          </Link>
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}
