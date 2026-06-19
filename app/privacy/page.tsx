import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20EditorialPages.module.css";

const privacyColumns = [
  {
    code: "01",
    title: "我們蒐集哪些資料",
    items: [
      {
        title: "帳號資料",
        body: "登入、Email 與基本帳號識別資訊。",
      },
      {
        title: "聯絡與驗證",
        body: "客服聯繫與必要的安全驗證資料。",
      },
      {
        title: "使用紀錄",
        body: "服務運作、異常排查與必要營運紀錄。",
      },
      {
        title: "付款流程資料",
        body: "若涉及付款，會依第三方支付規格處理。",
      },
    ],
  },
  {
    code: "02",
    title: "資料如何幫助服務",
    items: [
      {
        title: "維持帳號安全",
        body: "協助登入判斷、異常處理與帳號保護。",
      },
      {
        title: "提供 Rooms 與排程",
        body: "讓房間、權限與排程流程能正確運作。",
      },
      {
        title: "客服與問題處理",
        body: "回覆詢問、追蹤交付與處理個案。",
      },
      {
        title: "改善產品體驗",
        body: "用於產品優化與濫用偵測。",
      },
    ],
  },
  {
    code: "03",
    title: "我們不會預設做什麼",
    items: [
      {
        title: "不以公開監控為預設",
        body: "安感島不把公開錄音或公開監控當作預設。",
      },
      {
        title: "不強迫開鏡頭",
        body: "你的在場方式，應由產品設定與房間規則決定。",
      },
      {
        title: "不模糊承諾",
        body: "尚未正式開放的功能，不用不精準文案先佔位。",
      },
      {
        title: "不任意擴大用途",
        body: "資料使用會回到當下公開說明與必要性。",
      },
    ],
  },
  {
    code: "04",
    title: "你的權利與控制",
    items: [
      {
        title: "查詢與更正",
        body: "可透過客服確認個人資料處理需求。",
      },
      {
        title: "申請刪除",
        body: "在法令與必要留存範圍內提出處理申請。",
      },
      {
        title: "理解第三方服務",
        body: "登入、視訊與付款可能涉及各自條款。",
      },
      {
        title: "保留選擇權",
        body: "是否公開、是否互動與何時參與，都應清楚可控。",
      },
    ],
  },
] as const;

const servicePrinciples = [
  {
    title: "開放前先說清楚",
    body: "新功能正式上線前，會補充用途、範圍與使用方式。",
  },
  {
    title: "保存與期限需明示",
    body: "若涉及記錄保存，會說明是否保存、保存多久與目的。",
  },
  {
    title: "不以模糊敘事替代政策",
    body: "尚未正式啟用的能力，不會用曖昧話術讓你誤會。",
  },
  {
    title: "有疑問可回到客服",
    body: "若你對資料邊界不確定，客服與政策頁會是起點。",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className={styles.editorialPage} data-image20-dom-page="privacy-policy-template-v118-ecpay-review-safe">
      <section className={styles.darkHero}>
        <div className={styles.privacyHeroMedia} aria-hidden="true" />
        <Image20TopNav dark />

        <div className={styles.heroInner}>
          <article className={styles.heroCopy}>
            <span className="i20-kicker">Privacy Policy</span>
            <h1 className="i20-serif">你的信任，是我們最重視的承諾。</h1>
            <p>
              安感島不是只把隱私寫成條款，而是把資料用途、互動邊界與服務說明
              做成能被理解的公開承諾。
            </p>

            <div className={styles.privacyPrinciples}>
              <span>透明說明</span>
              <span>最小必要</span>
              <span>安心可控</span>
            </div>
          </article>

          <aside className={styles.heroNotice}>
            <span className="i20-kicker">Privacy First</span>
            <h2>先讓你知道資料怎麼被使用，再談服務如何靠近你。</h2>
            <p>
              若你對房內互動、第三方服務或資料邊界有疑問，
              這裡應該先說清楚。
            </p>
            <div className={styles.heroNoticeLinks}>
              <Link className="i20-btn peach" href="/contact">
                聯絡客服
              </Link>
              <Link className="i20-btn ghost" href="/terms">
                查看服務條款
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.privacyMatrix}>
        {privacyColumns.map((column) => (
          <article className={styles.privacyColumn} key={column.title}>
            <div className={styles.privacyColumnHead}>
              <span className={styles.policySeal}>{column.code}</span>
              <h3 className="i20-serif">{column.title}</h3>
            </div>

            <div className={styles.privacyItems}>
              {column.items.map((item, index) => (
                <div className={styles.privacyItem} key={item.title}>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                  <div>
                    <b>{item.title}</b>
                    <span>{item.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.privacyAiBand}>
        <article className={styles.privacyAiLead}>
          <span className="i20-kicker">Service Boundary</span>
          <h2 className="i20-serif">尚未開放的能力，必須另外說明。</h2>
          <p>
            若未來開放新的房內輔助或自動化能力，資料處理方式會以正式公開內容為準。
            在此之前，安感島不會用「好像已經存在」的語氣讓你誤判。
          </p>
        </article>

        <div className={styles.privacyAiPrinciples}>
          {servicePrinciples.map((item) => (
            <article className={styles.privacyAiPrinciple} key={item.title}>
              <b>{item.title}</b>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.privacyHelpBand}>
        <article className={styles.privacyHelpLead}>
          <span className="i20-kicker">Questions</span>
          <h3 className="i20-serif">有資料疑問，需要協助？</h3>
          <p>我們把聯絡入口放在明處，讓你不需要猜。</p>
        </article>

        <div className={styles.privacyHelpLinks}>
          <Link href="/contact">
            <b>客服入口</b>
            <span>提出資料相關疑問</span>
          </Link>
          <a href="mailto:unmixed@getcalmandco.com">
            <b>官方 Email</b>
            <span>unmixed@getcalmandco.com</span>
          </a>
          <Link href="/service-delivery">
            <b>服務交付</b>
            <span>了解服務流程與處理邏輯</span>
          </Link>
        </div>

        <aside className={styles.privacyCommitment}>
          <b>我們持續進步，只為守護你的安心。</b>
          <span>政策內容會隨正式服務調整，但控制權與清楚說明不應退步。</span>
        </aside>
      </section>

      <Image20Footer />
    </main>
  );
}
