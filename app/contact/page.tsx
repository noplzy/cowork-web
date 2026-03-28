import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SUPPORT_FORM_URL, hasSupportFormUrl } from "@/lib/supportForm";

export default function ContactPage() {
  const formReady = hasSupportFormUrl();

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Contact</span>
          <p className="cc-eyebrow">客服與聯絡｜付款、續訂、權益異常與封鎖申訴都改走表單</p>
          <h1 className="cc-h1">先把客服入口做穩，再談站內訊息。</h1>
          <p className="cc-lead">
            這一版不再使用 <code>mailto:</code> 當主要聯絡方式。
            客服與申訴改成 Google Form，避免使用者沒有預設郵件客戶端時根本送不出去。
          </p>

          <div className="cc-grid-metrics cc-section">
            <div className="cc-metric">
              <span className="cc-metric-label">主要入口</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>Google Form 客服表單</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">適用情境</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>客服 / 申訴 / 封鎖申覆</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">備援方式</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>Email / 電話</div>
            </div>
          </div>

          <div className="cc-action-row">
            {formReady ? (
              <a
                href={SUPPORT_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="cc-btn-primary"
              >
                前往客服表單
              </a>
            ) : (
              <button className="cc-btn-primary" type="button" disabled>
                尚未設定客服表單
              </button>
            )}
            <Link href="/refund-policy" className="cc-btn">查看退款 / 取消政策</Link>
          </div>

          {!formReady ? (
            <div className="cc-alert cc-alert-error" style={{ marginTop: 16 }}>
              尚未設定 Google Form 連結。請在部署環境加入
              <code> NEXT_PUBLIC_SUPPORT_FORM_URL </code>
              後重新部署。
            </div>
          ) : null}
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">客服資訊</p>
            <div className="cc-note cc-stack-sm">
              <div>Email：noccs75@gmail.com</div>
              <div>電話：0968730221</div>
              <div>客服時段：每日 10:00~00:00</div>
              <div>地址：高雄市前鎮區廣東三街89號</div>
            </div>
          </div>

          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">建議表單欄位</p>
            <ul className="cc-bullets">
              <li>帳號 Email</li>
              <li>姓名 / 顯示名稱</li>
              <li>問題類型</li>
              <li>問題描述</li>
              <li>付款資訊或申訴補充</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">為什麼改成表單</p>
            <h2 className="cc-h2">現在比 mailto 更可靠</h2>
          </div>

          <ul className="cc-bullets">
            <li><code>mailto:</code> 會依賴使用者本機的預設郵件客戶端，很多人根本沒設。</li>
            <li>Google Form 不需要登入安感島，也不會被站內封鎖導流干擾。</li>
            <li>被封鎖帳號仍可透過公開表單申訴，不需要先解除封鎖才能聯絡客服。</li>
            <li>你之後若要整理客服案件，也比收零散 Email 更好管理。</li>
          </ul>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">常見情況</p>
            <h2 className="cc-h2">你可以怎麼提供資訊</h2>
          </div>
          <ul className="cc-bullets">
            <li>付款成功但權益未更新：請提供付款時間、金額與帳號 Email。</li>
            <li>重複扣款：請提供兩筆以上付款紀錄或金額資訊。</li>
            <li>取消續訂：請提供帳號 Email 與希望停止續訂的方案名稱。</li>
            <li>封鎖申訴：請提供帳號 Email、封鎖頁截圖與補充說明。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
