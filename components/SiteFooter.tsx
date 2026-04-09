import Link from "next/link";

const footerLinks = [
  { href: "/rooms", label: "同行空間" },
  { href: "/buddies", label: "安感夥伴" },
  { href: "/pricing", label: "方案與價格" },
  { href: "/contact", label: "客服" },
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
        margin: "32px auto 0",
        padding: "0 22px 36px",
      }}
    >
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 18,
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <div
              style={{
                color: "rgba(255,245,238,0.92)",
                fontSize: "0.98rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              安感島 <span style={{ color: "rgba(255,245,238,0.58)", fontWeight: 600 }}>by Calm&Co</span>
            </div>
            <p
              style={{
                margin: "8px 0 0",
                color: "rgba(255,245,238,0.68)",
                lineHeight: 1.75,
                fontSize: "0.95rem",
              }}
            >
              給想找人一起開始、一起撐過一段時間、一起把事情做完的人。先把同行空間做穩，再把安感夥伴、
              信任機制與服務體驗慢慢補齊。
            </p>
          </div>

          <div
            style={{
              minWidth: 240,
              color: "rgba(255,245,238,0.78)",
              lineHeight: 1.9,
              fontSize: "0.95rem",
            }}
          >
            <div style={{ fontWeight: 700, color: "rgba(255,245,238,0.92)" }}>客服資訊</div>
            <div>Email：noccs75@gmail.com</div>
            <div>電話：0968730221</div>
            <div>客服時段：每日 10:00–00:00</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: "rgba(255,245,238,0.66)",
                textDecoration: "none",
                fontSize: "0.9rem",
                padding: "4px 0",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
