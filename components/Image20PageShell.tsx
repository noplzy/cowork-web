import type { ReactNode } from "react";
import { Image20SiteNav } from "@/components/Image20SiteNav";
import Link from "next/link";

type Action = { href: string; label: string; secondary?: boolean };

export function Image20PageShell({
  pageName,
  eyebrow,
  title,
  lead,
  heroImage,
  actions = [],
  children,
  bottomLinks,
}: {
  pageName: string;
  eyebrow: string;
  title: string;
  lead: string;
  heroImage: string;
  actions?: Action[];
  children: ReactNode;
  bottomLinks?: { href: string; label: string }[];
}) {
  return (
    <main className="image20-page" data-image20-page={pageName}>
      <section className="image20-page__hero">
        <div className="image20-page__hero-bg" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true" />
        <div className="image20-page__hero-shade" aria-hidden="true" />
        <Image20SiteNav transparent />
        <div className="image20-page__hero-copy">
          <p className="image20-page__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="image20-page__lead">{lead}</p>
          {actions.length ? (
            <div className="image20-page__actions">
              {actions.map((item) => (
                <Link key={item.href} href={item.href} className={item.secondary ? "image20-page__button image20-page__button--secondary" : "image20-page__button"}>
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="image20-page__body">
        <div className="image20-page__surface">{children}</div>
      </section>

      <footer className="image20-page__footer">
        <div>
          <strong>安感島 Calm&amp;Co</strong>
          <p>低壓力同行、安靜陪伴、可信任的數位在場空間。</p>
        </div>
        <div className="image20-page__footer-links">
          {(bottomLinks ?? [
            { href: "/pricing", label: "方案 / 價格" },
            { href: "/contact", label: "客服" },
            { href: "/refund-policy", label: "退款政策" },
            { href: "/terms", label: "服務條款" },
          ]).map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
