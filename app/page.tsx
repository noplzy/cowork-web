// app/page.tsx
// ✅ Milestone 3: 首頁分流（共工 / 搭子）
// 注意：/rooms 仍需登入；這裡只做入口與說明。

import Link from "next/link";

export default function Home() {
  return (
    <main className="cc-container">
      <h1 className="cc-h1">安感島｜共工（MVP）</h1>
      <p className="cc-muted" style={{ lineHeight: 1.7 }}>
        這個站點有兩條主線：<b>共工</b>（一起專注工作）與 <b>搭子</b>（找固定/專業夥伴）。
        兩個功能都屬於「孤獨經濟」的延伸，但入口要分清楚，避免四不像。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 18 }}>
        <div className="cc-card">
          <h2 className="cc-h2">🎯 共工（Rooms）</h2>
          <p className="cc-muted" style={{ lineHeight: 1.7 }}>
            25m / 50m 時間盒。免費每月 4 場；50m 會消耗 2 場。VIP 可無限續場。
          </p>
          <Link href="/rooms" className="cc-btn cc-btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>前往共工</Link>
        </div>

        <div className="cc-card">
          <h2 className="cc-h2">🤝 搭子（Buddies）</h2>
          <p className="cc-muted" style={{ lineHeight: 1.7 }}>
            MVP 先做框架：職業角色、自由開價、平台代收代付（之後串金流與抽成）。
          </p>
          <Link href="/buddies" className="cc-btn" style={{ display: "inline-block", textDecoration: "none" }}>前往搭子</Link>
        </div>

        <div className="cc-card">
          <h2 style={{ marginTop: 0 }}>🧾 方案 / 額度</h2>
          <p className="cc-muted" style={{ lineHeight: 1.7 }}>
            檢視本月剩餘場次、VIP 狀態與續命規則（MVP 先用後台手動改 plan 測試）。
          </p>
          <Link href="/account" style={{ textDecoration: "underline" }}>查看方案</Link>
        </div>
      </div>

      <p style={{ marginTop: 18, opacity: 0.7 }}>
        如果你用無痕模式打開會看到登入頁面，是正常的：無痕沒有保存 Supabase session。
      </p>

      <p style={{ marginTop: 6, opacity: 0.7 }}>
        MVP 的重點不是「功能多」，是「規則清楚、能收錢、能防濫用」。
      </p>

      <div style={{ marginTop: 18 }}>
        <Link href="/auth/login" style={{ textDecoration: "underline" }}>登入 / 註冊</Link>
      </div>
    </main>
  );
}
