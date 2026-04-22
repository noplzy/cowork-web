import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SUPPORT_FORM_URL, hasSupportFormUrl } from "@/lib/supportForm";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

type SearchParams = Record<string, string | string[] | undefined>;

function pickParam(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function buildReportPacket(searchParams: SearchParams) {
  const issue = pickParam(searchParams, "issue");
  if (issue !== "report-user") return null;

  const roomId = pickParam(searchParams, "roomId");
  const targetUserId = pickParam(searchParams, "targetUserId");
  const targetLabel = pickParam(searchParams, "targetLabel");

  if (!roomId && !targetUserId) return null;

  const lines = [
    `【檢舉類型】房內使用者檢舉`,
    roomId ? `【Room ID】${roomId}` : "",
    targetUserId ? `【被檢舉 User ID】${targetUserId}` : "",
    targetLabel ? `【被檢舉標籤】${targetLabel}` : "",
    `【補充】請描述具體行為、時間點、是否重複發生、是否影響通話 / 體驗。`,
  ].filter(Boolean);

  return lines.join("\n");
}

export default function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const formReady = hasSupportFormUrl();
  const reportPacket = buildReportPacket(searchParams);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Contact</span>
          <p className="cc-eyebrow">客服、付款異常、退款申請、驗證申訴，都可以從這裡聯絡我們。</p>
          <h1 className="cc-h2">需要協助時，請直接填寫客服表單。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
            你可以透過公開表單提交客服、付款異常、驗證申訴或退款申請資料，
            我們會再用你填寫的聯絡 Email 回覆。
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
            <Link href="/refund-policy" className="cc-btn">
              退款 / 取消政策
            </Link>
            <Link href="/verification-policy" className="cc-btn">
              驗證與安全政策
            </Link>
          </div>

          {!formReady ? (
            <div className="cc-alert cc-alert-error">
              尚未設定 Google Form 連結。請在本機與部署環境加入
              <code> NEXT_PUBLIC_SUPPORT_FORM_URL </code>
              後重新啟動。
            </div>
          ) : null}

          {reportPacket ? (
            <div className="cc-card cc-card-soft cc-stack-sm" style={{ marginTop: 14 }}>
              <div className="cc-h3">檢舉資訊（可直接複製貼到客服表單）</div>
              <div className="cc-caption" style={{ lineHeight: 1.7 }}>
                你可以把下方內容直接貼到表單中，方便我們更快確認情況。
              </div>
              <textarea
                className="cc-textarea"
                readOnly
                value={reportPacket}
                style={{
                  minHeight: 160,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              />
            </div>
          ) : null}
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">適合填表的情況</p>
            <h2 className="cc-h2">以下問題都可以直接填表聯絡。</h2>
          </div>

          <ul className="cc-bullets">
            <li>付款成功但權益未生效</li>
            <li>重複扣款</li>
            <li>退款申請</li>
            <li>登入 / 帳號問題</li>
            <li>驗證失敗 / 驗證申訴 / OTP 問題</li>
            <li>封鎖申訴</li>
            <li>房內使用者檢舉</li>
            <li>其他問題</li>
          </ul>

          <div className="cc-note">
            建議一併提供：聯絡 Email、姓名 / 顯示名稱、安感島帳號 Email、問題類型、問題描述、付款時間、金額、MerchantTradeNo。
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">客服與營運主體資訊</p>
          <div className="cc-note cc-stack-sm">
            <div>品牌：{BUSINESS_PROFILE.brandName}</div>
            <div>商業名稱：{BUSINESS_PROFILE.legalBusinessName}</div>
            <div>統一編號：{BUSINESS_PROFILE.unifiedBusinessNo}</div>
            <div>Email：{BUSINESS_PROFILE.supportEmail}</div>
            <div>電話：{BUSINESS_PROFILE.supportPhone}</div>
            <div>客服時段：{BUSINESS_PROFILE.supportHours}</div>
            <div>{BUSINESS_PROFILE.publicAddressNote}</div>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">說明</p>
          <ul className="cc-bullets">
            <li>目前沒有自動續扣，所以不需要申請取消下期續費。</li>
            <li>目前沒有年方案，相關規則未開放。</li>
            <li>若未來導入 OTP 或身分驗證，本頁會同步更新相關申訴入口。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
