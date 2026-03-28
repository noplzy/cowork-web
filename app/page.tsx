"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const quickCards = [
  {
    kicker: "現在想做的事",
    title: "進入專注共工",
    desc: "直接進房，開始 25 / 50 分鐘時間盒。",
    href: "/rooms",
    cta: "前往 Rooms",
    primary: true,
  },
  {
    kicker: "想先了解方向",
    title: "認識安感島",
    desc: "先看定位、公開資訊與目前正在完成的港口。",
    href: "/about",
    cta: "查看 About",
  },
  {
    kicker: "想先看規則",
    title: "方案與價格",
    desc: "先看免費額度、VIP 權益、退款與續訂說明。",
    href: "/pricing",
    cta: "查看方案",
  },
];

const islandPorts = [
  "專注共工：第一個先完成的港口",
  "陪伴服務：後續逐步擴充",
  "帳號與方案：規則清楚、可預期",
  "客服與政策：公開頁可直接查閱",
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

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜所有孤獨經濟相關服務，會逐步在島上找到自己的港口</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(2rem, 4vw, 4rem)" }}>
            共工只是第一個先完成的港口。
          </h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.9 }}>
            安感島不是只做一個功能，而是想把孤獨經濟相關服務放進同一座島上。
            目前先把專注共工做穩，再往陪伴、支持與其他低壓力數位服務擴充。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">
              {isLoggedIn ? "前往 Rooms" : "開始使用"}
            </Link>
            <Link href="/about" className="cc-btn">了解安感島</Link>
            <Link href={isLoggedIn ? "/account" : "/auth/login"} className="cc-btn-link">
              {isLoggedIn ? "查看方案 / 額度 →" : "登入 / 註冊 →"}
            </Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">目前島上的內容</p>
            <h2 className="cc-h2">先把入口收斂，再讓使用者看得懂。</h2>
          </div>

          <ul className="cc-bullets">
            {islandPorts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="cc-note">
            現在的設計方向是：品牌頁可以講感受；功能頁與政策頁則盡量短、清楚、任務導向。
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-3">
        {quickCards.map((card) => (
          <article key={card.title} className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">{card.kicker}</p>
            <h3 className="cc-h3">{card.title}</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>{card.desc}</p>
            <div className="cc-action-row">
              <Link href={card.href} className={card.primary ? "cc-btn-primary" : "cc-btn"}>
                {card.cta}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">目前完成度</p>
          <h2 className="cc-h2">先做穩，不急著把島塞滿。</h2>
          <div className="cc-note cc-stack-sm">
            <div>Rooms：可使用</div>
            <div>客服 / 申訴：改走公開表單</div>
            <div>封鎖頁：最小版已可用</div>
            <div>手機驗證：暫不作為進站硬門檻</div>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">公開資訊</p>
          <h2 className="cc-h2">該讓使用者直接看到的，都放在外面。</h2>
          <div className="cc-action-row">
            <Link href="/pricing" className="cc-btn">方案 / 價格</Link>
            <Link href="/contact" className="cc-btn">客服</Link>
            <Link href="/service-delivery" className="cc-btn">服務交付</Link>
            <Link href="/refund-policy" className="cc-btn">退款政策</Link>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
