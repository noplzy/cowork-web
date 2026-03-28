import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function PrivacyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Privacy Policy</span>
          <p className="cc-eyebrow">隱私權政策</p>
          <h1 className="cc-h2">安感島隱私權政策</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            這一頁只保留使用者最需要知道的核心內容，不做不必要的品牌式長文。
          </p>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 我們會蒐集哪些資料</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            當你註冊、登入、聯繫客服、使用房間或購買方案時，我們可能蒐集 Email、聯絡資訊、帳號識別資料、付款相關資料與服務使用紀錄。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 這些資料拿來做什麼</h2>
          <ul className="cc-bullets">
            <li>維護你的帳號與方案權益</li>
            <li>處理付款、退款、續訂與客服需求</li>
            <li>維持房間服務、系統安全與異常排查</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 第三方服務</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            為了提供帳號、資料儲存、視訊與付款服務，我們可能委託第三方合作服務商處理部分資料，但只限於提供服務所需範圍。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 資料查詢與修改</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你希望查詢、修改或刪除與你相關的資料，請透過客服頁或客服表單聯絡我們。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
