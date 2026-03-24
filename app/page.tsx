"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const highlights = [
  "25 分鐘與 50 分鐘時間盒，進房規則清楚好懂。",
  "低壓力陪伴感，不把專注做成吵鬧競賽。",
  "方案、客服與政策資訊公開透明，付款前可先看清楚。",
];

const trustNotes = [
  { label: "專注共工", value: "25m / 50m 時間盒" },
  { label: "安感夥伴", value: "陪伴與同行" },
  { label: "整體感受", value: "安靜、低壓力、可預期" },
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled) {
        setIsLoggedIn(Boolean(session));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜安靜、高質感、低壓力的數位避風港</p>
          <h1 className="cc-h1">一個人撐著的時候，也能有地方安靜靠岸。</h1>
          <p className="cc-lead">
            安感島是一個讓你安穩開始、好好待住的數位空間。你可以進來專注完成眼前的一段時間，
            也可以在需要陪伴的時候，看看是否有適合自己的同行方式。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">
              {isLoggedIn ? "進入專注共工" : "開始使用 Rooms"}
            </Link>
            <Link href="/buddies" className="cc-btn">
              看看安感夥伴
            </Link>
            {isLoggedIn ? (
              <Link href="/account" className="cc-btn-link">
                查看方案 / 額度 →
              </Link>
            ) : (
              <Link href="/auth/login" className="cc-btn-link">
                登入 / 註冊 →
              </Link>
            )}
          </div>

          <div className="cc-grid-metrics cc-section">
            {trustNotes.map((item) => (
              <div key={item.label} className="cc-metric">
                <span className="cc-metric-label">{item.label}</span>
                <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-feature-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">使用感受</p>
                <h2 className="cc-h2">安靜、溫柔、可久待</h2>
              </div>
              <span className="cc-pill-accent">Calm Premium</span>
            </div>
            <ul className="cc-bullets">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">開始方式</p>
                <h3 className="cc-h3">先選一條適合現在狀態的入口。</h3>
              </div>
              <span className="cc-pill-success">清楚好上手</span>
            </div>
            <p className="cc-muted" style={{ lineHeight: 1.75, margin: 0 }}>
              想馬上開始做事，就進 Rooms；想先看看陪伴方式與整體服務內容，就去安感夥伴與公開說明頁。
            </p>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-card-link">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">入口一</p>
              <h2 className="cc-h2">🎯 專注共工</h2>
            </div>
            <span className="cc-pill-soft">25m / 50m</span>
          </div>
          <p className="cc-lead" style={{ marginTop: 12, maxWidth: "unset" }}>
            給現在就想開始的人。選一個房間、看清本場規則，讓自己在一段明確的時間裡穩穩待住。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-soft">VIP 可無限續場</span>
          </div>
          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">前往 Rooms</Link>
          </div>
        </article>

        <article className="cc-card cc-card-link">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">入口二</p>
              <h2 className="cc-h2">🤝 安感夥伴</h2>
            </div>
            <span className="cc-pill-soft">陪伴服務</span>
          </div>
          <p className="cc-lead" style={{ marginTop: 12, maxWidth: "unset" }}>
            給想找陪跑感、同行感或溫和支持的人。這裡會說明安感夥伴能提供的感受與使用方式。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-accent">低壓力陪伴</span>
            <span className="cc-pill-soft">公開說明頁</span>
          </div>
          <div className="cc-action-row">
            <Link href="/buddies" className="cc-btn">前往安感夥伴</Link>
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-3">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">方案與價格</p>
          <h3 className="cc-h3">付款前先把價格與權益看清楚</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            公開查看免費方案、VIP 月費與年費、續訂方式與生效說明。
          </p>
          <Link href="/pricing" className="cc-btn-link">查看方案 →</Link>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">客服與聯絡</p>
          <h3 className="cc-h3">付款、權益、登入問題都找得到人</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            客服 Email、電話、時段與聯絡表單公開可見，避免付款前後找不到窗口。
          </p>
          <Link href="/contact" className="cc-btn-link">聯絡客服 →</Link>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">政策與交付</p>
          <h3 className="cc-h3">退款、隱私、條款與服務交付一次看清楚</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            讓使用者在付款前就能理解服務規則，也讓金流審核能看見完整公開資訊。
          </p>
          <Link href="/service-delivery" className="cc-btn-link">查看說明 →</Link>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
