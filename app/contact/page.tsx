import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SUPPORT_FORM_URL, hasSupportFormUrl } from "@/lib/supportForm";

export default function ContactPage() {
  const formReady = hasSupportFormUrl();

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Contact</span>
          <p className="cc-eyebrow">客服、付款異常、封鎖申訴，現在統一走公開表單。</p>
          <h1 className="cc-h2">客服入口先求穩，不再依賴 mailto。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
            這一版先不做站內私訊客服。
            你可以直接透過公開 Google Form 送出客服或申訴資料，我們再用你填寫的聯絡 Email 回覆。
          </p>

          <div className="cc-action-row">
            {formReady ? (
              <a href={SUPPORT_FORM_URL} target="_blank" rel="noreferrer" className="cc-btn-primary">
                前往客服表單
              </a>
            ) : (
              <button className="cc-btn-primary" type="button" disabled>
                尚未設定客服表單
              </button>
            )}
            <Link href="/refund-policy" className="cc-btn">退款 / 取消政策</Link>
          </div>

          {!formReady ? (
            <div className="cc-alert cc-alert-error">
              尚未設定 Google Form 連結。請在本機與部署環境加入
              <code> NEXT_PUBLIC_SUPPORT_FORM_URL </code>
              後重新啟動。
            </div>
          ) : null}
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">適合填表的情況</p>
            <h2 className="cc-h2">先把問題分流，處理起來才不會亂。</h2>
          </div>

          <ul className="cc-bullets">
            <li>封鎖申訴</li>
            <li>付款 / 權益問題</li>
            <li>重複扣款</li>
            <li>取消續訂</li>
            <li>登入 / 帳號問題</li>
            <li>其他問題</li>
          </ul>

          <div className="cc-note">
            建議表單必填：聯絡 Email、姓名 / 顯示名稱、安感島帳號 Email、問題類型、問題描述。
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">客服資訊</p>
          <div className="cc-note cc-stack-sm">
            <div>Email：noccs75@gmail.com</div>
            <div>電話：0968730221</div>
            <div>客服時段：每日 10:00~00:00</div>
            <div>地址：高雄市前鎮區廣東三街89號</div>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">為什麼不用 mailto</p>
          <ul className="cc-bullets">
            <li>很多使用者根本沒有設定預設郵件客戶端。</li>
            <li>被封鎖帳號也需要一個不受站內導流影響的申訴入口。</li>
            <li>Google Form + Google Sheets 對現在這個階段更穩、更好管理。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
