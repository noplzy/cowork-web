"use client";

import Link from "next/link";
import { TopNav } from "@/components/TopNav";

const nextSteps = [
  "搭子資料表與 RLS：上架者 / 管理員 / 一般訪客的可見性要先切清楚。",
  "先做候補名單與需求驗證，再決定上架、抽成與金流路徑。",
  "服務條款、退款 / 取消政策、客服申訴流程必須先準備，否則 PSP 會盯你。",
];

export default function BuddiesPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Companion Track</span>
          <p className="cc-eyebrow">安感夥伴｜陪你一起撐住，不把需求粗暴社交化</p>
          <h1 className="cc-h1">不是隨便配人，而是找到你此刻需要的同行方式。</h1>
          <p className="cc-lead">
            搭子這條線會做，但不會現在就把它做成高風險拼裝車。對安感島來說，陪伴必須是低壓力、可定價、可申訴、可被信任的，
            所以先做展示骨架與需求驗證，才不會一上來就踩到金流與糾紛地雷。
          </p>
          <div className="cc-action-row">
            <Link className="cc-btn-primary" href="/rooms">
              先回到共工主線
            </Link>
            <Link className="cc-btn" href="/account">
              看目前方案規則
            </Link>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">目前定位</p>
                <h2 className="cc-h2">展示 / 候補 / 驗證需求</h2>
              </div>
              <span className="cc-pill-accent">MVP 後段</span>
            </div>
            <ul className="cc-bullets">
              <li>允許職業角色：教練、陪跑、讀書搭子、工程陪寫。</li>
              <li>可自由開價，但正式交易流程要等平台代收代付與爭議處理一起完成。</li>
              <li>隨機配對可當 VIP 功能，但不是目前主線。</li>
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">品牌提醒</p>
            <h3 className="cc-h3">陪伴感不是黏膩，不是把孤獨包裝成表演。</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              安感夥伴頁要保留未來想像，但不能讓人誤會你現在已經完成所有配對與服務保障流程。
            </p>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">接下來真正要做的事</p>
            <h2 className="cc-h2">不做就會爆雷的三步</h2>
          </div>
          <ul className="cc-bullets">
            {nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="cc-card cc-card-outline cc-stack-md">
          <div>
            <p className="cc-card-kicker">現階段不是目標</p>
            <h2 className="cc-h2">先不要急著把這頁做滿</h2>
          </div>
          <div className="cc-note">
            <div className="cc-stack-sm">
              <div className="cc-h3">非目標</div>
              <div className="cc-muted">金流抽成細節、完整爭議處理、隨機配對、職人檔案上架流、信用分演算法。</div>
            </div>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
            這不是保守，是避免你在共工主線尚未完成商業閉環前，把資源先燒在最容易出糾紛的區塊。
          </p>
        </article>
      </section>
    </main>
  );
}
