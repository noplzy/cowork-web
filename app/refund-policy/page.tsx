import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

export default function RefundPolicyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Refund & Cancellation Policy</span>
          <p className="cc-eyebrow">退款 / 取消政策</p>
          <h1 className="cc-h2">這一版走人工退款審核，不做前台秒退。</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 目前適用範圍</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            本頁目前適用於試營運期間的 VIP 月方案一次性付款版本。
            這一版不做自動續扣，因此目前不存在「取消下期續訂」這件事。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 申請入口與必備資訊</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            請透過客服表單提交退款審核申請，並提供以下資訊：
          </p>
          <ul className="cc-bullets">
            <li>安感島帳號 Email</li>
            <li>付款時間與金額</li>
            <li>綠界或系統訂單編號（MerchantTradeNo）</li>
            <li>退款原因與實際遇到的問題</li>
          </ul>

          <div className="cc-action-row">
            <Link href="/contact" className="cc-btn-primary">
              前往客服表單
            </Link>
            <Link href="/service-delivery" className="cc-btn">
              服務交付說明
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 可退款情況</h2>
          <ul className="cc-bullets">
            <li>付款成功後，VIP 權益在合理時間內仍未生效</li>
            <li>因系統異常導致重複扣款</li>
            <li>首次訂購後尚未實際使用主要 VIP 權益，且於付款後 7 天內提出申請</li>
            <li>經人工查單後，確認安感島最終無法正常提供本次已付款權益</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 不可退款情況</h2>
          <ul className="cc-bullets">
            <li>已超過付款後 7 天才提出申請</li>
            <li>VIP 權益已正常生效且已明顯使用</li>
            <li>因帳號共享、違反服務條款或使用規範導致停權或限制</li>
            <li>僅因個人改變主意，但服務已正常提供且主要權益已有明顯使用</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 什麼叫「已明顯使用主要 VIP 權益」</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            例如已使用 VIP 權益進入房間、持續使用無限續場能力、或其他足以判定主要付費功能已被實際消耗的情況。
            這類情況原則上不屬於可退款範圍。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">6. 審核通過後會怎麼處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若退款審核通過，我們會以實際付款與查單結果為準進行退款處理，並可能同步調整或撤回本次訂單對應的 VIP 權益。
            若審核不通過，客服也會告知主要判定原因。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">7. 營運主體與聯絡方式</h2>
          <div className="cc-note cc-stack-sm">
            <div>商業名稱：{BUSINESS_PROFILE.legalBusinessName}</div>
            <div>統一編號：{BUSINESS_PROFILE.unifiedBusinessNo}</div>
            <div>地址：{BUSINESS_PROFILE.businessAddress}</div>
            <div>客服 Email：{BUSINESS_PROFILE.supportEmail}</div>
            <div>客服電話：{BUSINESS_PROFILE.supportPhone}</div>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">8. 正式上線後的方案另行公告</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            未來若開放月訂閱、自動續扣或年方案，退款、取消、終止與續約規則會另外公開。
            不同方案可能有不同的適用條件，不能直接套用本頁的試營運規則。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
