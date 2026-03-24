import Link from "next/link";

const footerLinks = [
  { href: "/buddies", label: "安感夥伴" },
  { href: "/pricing", label: "方案與價格" },
  { href: "/contact", label: "客服與聯絡" },
  { href: "/service-delivery", label: "服務交付說明" },
  { href: "/refund-policy", label: "退款 / 取消政策" },
  { href: "/privacy", label: "隱私權政策" },
  { href: "/terms", label: "服務條款" },
];

export function SiteFooter() {
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "0 22px 40px",
      }}
    >
      <div className="cc-card cc-stack-md" style={{ padding: 22 }}>
        <div className="cc-card-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="cc-stack-sm" style={{ maxWidth: 560 }}>
            <div>
              <div className="cc-card-kicker">安感島 ANGANDAO</div>
              <h2 className="cc-h3" style={{ marginTop: 6 }}>安靜、高質感、低壓力的專注共工與陪伴型數位空間</h2>
            </div>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
              提供專注房間、陪伴服務、方案權益與客服支援。付款、續訂、退款、權益生效與登入問題，都可透過公開頁找到對應資訊。
            </p>
          </div>

          <div className="cc-stack-sm" style={{ minWidth: 260 }}>
            <div className="cc-card-kicker">客服資訊</div>
            <div className="cc-muted-strong">Email：noccs75@gmail.com</div>
            <div className="cc-muted-strong">電話：0968730221</div>
            <div className="cc-muted">客服時段：每日 10:00~00:00</div>
            <div className="cc-muted">地址：高雄市前鎮區廣東三街89號</div>
          </div>
        </div>

        <div className="cc-soft-divider" style={{ margin: "8px 0 0" }} />

        <div className="cc-row" style={{ flexWrap: "wrap", gap: 10 }}>
          {footerLinks.map((item) => (
            <Link key={item.href} href={item.href} className="cc-pill-soft" style={{ textDecoration: "none" }}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
