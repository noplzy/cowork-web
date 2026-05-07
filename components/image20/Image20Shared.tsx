import Link from "next/link";

export const roomScenes = [
  { key: "focus", title: "專注任務", body: "讀書、工作、寫作、整理資料，有人一起開始。", image: "/site-assets/image20/rooms/scene-focus-task-evening-desk.png" },
  { key: "life", title: "生活陪伴", body: "家務、煮飯、下班整理，普通日常也能有人在。", image: "/site-assets/image20/rooms/scene-life-companionship-warm-lounge.png" },
  { key: "share", title: "主題分享", body: "把一場交流收束在一個清楚主題裡。", image: "/site-assets/image20/rooms/scene-topic-sharing-notebook-tea.png" },
  { key: "hobby", title: "興趣同好", body: "音樂、手作、閱讀、畫圖，找到同頻的人。", image: "/site-assets/image20/rooms/scene-hobby-room-watercolor-guitar.png" },
] as const;

export function Image20Hero({ title, eyebrow, lead, actions, image = "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", small = false }: { title: string; eyebrow: string; lead: string; image?: string; small?: boolean; actions?: Array<{ href: string; label: string; peach?: boolean }> }) {
  return (
    <section className={`i20-hero${small ? " small" : ""}`}>
      <div className="i20-hero-media" style={{ backgroundImage: `url(${image})` }} />
      <div className="i20-hero-content">
        <span className="i20-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{lead}</p>
        {actions?.length ? <div className="i20-actions-row">{actions.map((a) => <Link key={a.href} href={a.href} className={`i20-btn ${a.peach ? "peach" : ""}`}>{a.label}</Link>)}</div> : null}
      </div>
    </section>
  );
}

export function Image20SceneCards() {
  return (
    <div className="i20-grid four">
      {roomScenes.map((scene) => (
        <Link href={`/rooms?scene=${scene.key}#rooms-board`} className="i20-media-card" key={scene.key}>
          <img src={scene.image} alt="" loading="lazy" />
          <div><h3>{scene.title}</h3><p>{scene.body}</p></div>
        </Link>
      ))}
    </div>
  );
}

export function Image20MobileDock() {
  return (
    <nav className="i20-mobile-dock" aria-label="手機快捷列">
      <Link href="/">首頁</Link>
      <Link href="/rooms">Rooms</Link>
      <Link href="/buddies">Buddies</Link>
      <Link href="/account">我的島</Link>
    </nav>
  );
}
