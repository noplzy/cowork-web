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
          <p className="cc-eyebrow">客服、付款異常、人工退款審核，現在統一走公開表單。</p>
          <h1 className="cc-h2">客服入口先求穩，不再依賴 mailto。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
            這一版先不做站內私訊客服。
            你可以直接透過公開 Google Form 送出客服、付款異常或人工退款審核資料，
            我們再用你填寫的聯絡 Email 回覆。
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
            <Link href="/service-delivery" className="cc-btn">
              服務交付
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
                這一輪先不做假自動帶入，避免填錯欄位造成誤判。你只要把下方內容貼到表單即可。
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
            <h2 className="cc-h2">先把問題分流，處理起來才不會亂。</h2>
          </div>

          <ul className="cc-bullets">
            <li>付款成功但權益未生效</li>
            <li>重複扣款</li>
            <li>人工退款審核申請</li>
            <li>登入 / 帳號問題</li>
            <li>封鎖申訴</li>
            <li>房內使用者檢舉</li>
            <li>其他問題</li>
          </ul>

          <div className="cc-note">
            建議表單必填：聯絡 Email、姓名 / 顯示名稱、安感島帳號 Email、問題類型、問題描述、付款時間、金額、MerchantTradeNo。
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
            <div>地址：{BUSINESS_PROFILE.businessAddress}</div>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">這一版不用處理的事</p>
          <ul className="cc-bullets">
            <li>目前沒有自動續扣，所以不用申請取消下期續費。</li>
            <li>目前也沒有年方案，所以不用處理年約解約。</li>
            <li>先把付款、查單、權益入帳、人工退款審核這條路線跑穩更重要。</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
