import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function TermsPage() {
  return (
    <main className="cc-container">
      <TopNav />
      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Terms of Service</span>
          <p className="cc-eyebrow">服務條款</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)" }}>安感島服務條款</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 服務內容</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            安感島提供專注共工房間、帳號方案權益、陪伴型服務與相關客服支援。實際服務內容以網站當下公開顯示的頁面與方案說明為準。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 帳號責任</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            你應妥善保管自己的登入資訊，不得將帳號權限提供他人共用。若因帳號外洩、共用或不當使用導致權益異常，安感島有權暫停或限制服務。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 付款與續訂</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            VIP 方案採自動續訂。若你不希望下一期自動續費，請於下一次扣款前聯繫客服辦理取消。付款、退款與取消規則以網站公開政策頁為準。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 禁止行為</h2>
          <ul className="cc-bullets">
            <li>不得濫用服務、惡意干擾房間或嘗試繞過方案權限。</li>
            <li>不得以任何方式分享或轉售帳號權益。</li>
            <li>不得從事違法、侵權、騷擾或其他損害他人權益之行為。</li>
          </ul>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
