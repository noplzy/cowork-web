import { Image20LegalPage } from "@/components/image20/Image20Legal";

export default function PrivacyPage() {
  return (
    <Image20LegalPage
      eyebrow="Privacy Policy"
      title="隱私權政策"
      lead="安感島的前提，是你可以安心出現；資料用途、房內互動與 AI 邊界都應被清楚說明。"
      highlights={[
        { label: "01", title: "只為服務所需", body: "帳號、聯絡、付款與安全驗證資料會依服務情境使用。" },
        { label: "02", title: "房內互動有邊界", body: "不以公開錄音、公開監控或強迫開鏡頭作為預設。" },
        { label: "03", title: "AI 需額外說清楚", body: "若後續啟用 AI 記錄或建議，會再明示用途與範圍。" },
        { label: "04", title: "可提出查詢與刪除", body: "使用者可透過客服確認資料處理需求。" },
      ]}
      sections={[
        {
          title: "蒐集哪些資料",
          body: [
            "帳號資料、聯絡資訊、必要的身份驗證資料與使用紀錄。",
            "付款流程所需資訊會依第三方支付規格處理。",
          ],
        },
        {
          title: "資料如何使用",
          body: [
            "用於提供服務、維護帳號安全、處理付款與客服回覆。",
            "也可能用於改善產品體驗與偵測濫用行為。",
          ],
        },
        {
          title: "房間與互動安全",
          body: [
            "安感島不把公開錄音、公開監控或強迫開鏡頭作為預設。",
            "房內互動功能會以當下公開頁面與產品介面說明為準。",
          ],
        },
        {
          title: "AI Companion 的資料邊界",
          body: [
            "若未來啟用 AI Companion 或房內 AI 模式，會明確說明是否保存、保存多久與用途。",
            "尚未正式開放的功能，不會以模糊描述替代實際告知。",
          ],
        },
        {
          title: "第三方服務",
          body: [
            "登入、付款、視訊與雲端基礎設施可能涉及第三方服務。",
            "第三方的資料處理方式，仍以其自身條款與本平台實際整合情境為準。",
          ],
        },
        {
          title: "查詢、更新與刪除",
          body: [
            "你可透過客服聯絡，查詢、更新或申請刪除可處理的個人資料。",
            "若涉及法令、交易留存或安全調查，會依法令與必要性處理。",
          ],
        },
      ]}
      asideTitle="隱私不是裝飾，而是信任的一部分。"
      asideBody="若你對房內互動、AI 使用或資料處理有疑問，客服頁會是最清楚的起點。"
      asideLinks={[
        { href: "/contact", label: "聯絡客服" },
        { href: "/terms", label: "查看服務條款" },
        { href: "/service-delivery", label: "查看服務交付" },
      ]}
    />
  );
}
