// app/buddies/page.tsx
// ✅ Milestone 3: 搭子頁（先放骨架，下一個里程碑再做資料表 + 搜尋/上架/抽成）
//
// 你的決策（目前版本）：
// - 搭子可自由開價（平台代收代付、抽成）
// - 實名認證即可；信用分 < 92 不能上架
// - 允許職業角色（教練、陪跑、讀書搭子、工程陪寫…等）
// - 隨機配對可作為 VIP 功能（但 MVP 先不做隨機）
//
// MVP 策略：
// - 先把共工（Rooms）跑穩：登入、扣場、Daily 私房間 token 短效
// - 搭子先做「展示 + 候補名單」即可，避免一開始就碰金流/糾紛/審核風險

"use client";

import Link from "next/link";
import { TopNav } from "@/components/TopNav";

export default function BuddiesPage() {
  return (
    <main className="cc-container" style={{ maxWidth: 920 }}>
      <TopNav />

      <h1 className="cc-h1">搭子（Buddies）</h1>
      <p className="cc-muted" style={{ lineHeight: 1.7 }}>
        這一頁目前先保留骨架：讓使用者理解「搭子」會是什麼，但不先把功能做死。
        你現在最缺的是<strong>能上線、能收錢、能穩定運作</strong>的閉環，所以先把 Rooms 做到可商用。
      </p>

      <div className="cc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>下一步（不做就會爆雷的那種）</div>
        <ol className="cc-muted" style={{ lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
          <li>搭子資料表與 RLS（上架者/管理員/一般訪客的可見性切清楚）</li>
          <li>「候補名單」：先收 Email/Line（用來驗證需求，不先做上架/抽成）</li>
          <li>規範頁面：服務條款、退款/取消政策、客服申訴流程（PSP 審核會看）</li>
        </ol>
      </div>

      <div style={{ marginTop: 14 }}>
        <Link className="cc-btn" href="/rooms" style={{ textDecoration: "none" }}>
          先去共工 Rooms →
        </Link>
      </div>
    </main>
  );
}
