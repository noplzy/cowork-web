import Link from "next/link";
import { TopNav } from "@/components/TopNav";

export default function SchedulePage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-card cc-stack-md">
        <span className="cc-kicker">Schedule moved</span>
        <p className="cc-eyebrow">排程功能已整合進同行空間，不再作為主導航獨立入口</p>
        <h1 className="cc-h2">請從同行空間查看即時加入、排程開房與我的安排。</h1>
        <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
          這個頁面只保留為舊連結的過渡入口，避免之前的連結直接失效。
        </p>
        <div className="cc-action-row">
          <Link href="/rooms" className="cc-btn-primary">前往同行空間</Link>
        </div>
      </section>
    </main>
  );
}
