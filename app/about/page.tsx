import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

const roadmap = [
  { title: "共工港口", desc: "先把 Rooms、額度、VIP 與基本規則做穩。" },
  { title: "陪伴港口", desc: "之後再加入更多低壓力陪伴與支持型入口。" },
  { title: "服務群島", desc: "把孤獨經濟相關服務收斂在同一座島上，而不是做成彼此斷裂的工具。" },
];

export default function AboutPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">About AnganDao</span>
          <p className="cc-eyebrow">安感島不是單一功能，而是一座會慢慢長出不同港口的島。</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}>
            所有孤獨經濟相關服務，都會在島上找到位置。
          </h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.9 }}>
            安感島的方向不是做成一個很吵、很滿、什麼都塞的入口。
            它比較像一座有秩序的島：先把第一個港口修好，再慢慢把其他服務接上。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">前往第一個港口：Rooms</Link>
            <Link href="/pricing" className="cc-btn">查看方案</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">核心感受</p>
            <h2 className="cc-h2">安靜、低壓力、可預期。</h2>
          </div>

          <ul className="cc-bullets">
            <li>不把使用者丟進複雜、吵雜、資訊過量的介面。</li>
            <li>讓公開資訊、客服、規則與權益能直接查到。</li>
            <li>先把基本體驗做穩，再擴充新的港口。</li>
          </ul>
        </article>
      </section>

      <section className="cc-section cc-grid-3">
        {roadmap.map((item) => (
          <article key={item.title} className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">Roadmap</p>
            <h3 className="cc-h3">{item.title}</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>{item.desc}</p>
          </article>
        ))}
      </section>

      <SiteFooter />
    </main>
  );
}
