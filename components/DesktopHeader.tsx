"use client";

import Link from "next/link";

type DesktopHeaderProps = {
  pathname: string;
  headerVersion: string;
  resolved: boolean;
  isLoggedIn: boolean;
  currentEmail: string;
  onSignOut: () => Promise<void>;
};

const DESKTOP_NAV_ITEMS = [
  { href: "/", label: "首頁" },
  { href: "/rooms", label: "同行空間" },
  { href: "/buddies", label: "安感夥伴" },
  { href: "/pricing", label: "方案 / 價格" },
  { href: "/contact", label: "客服" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopHeader({
  pathname,
  headerVersion,
  resolved,
  isLoggedIn,
  currentEmail,
  onSignOut,
}: DesktopHeaderProps) {
  return (
    <>
      <header
        className="cc-desktop-only releaseDesktopHeader"
        aria-label="Desktop navigation"
        data-header-version={headerVersion}
      >
        <div className="releaseDesktopHeader__shell">
          <div className="cc-navshell releaseDesktopHeader__innerShell">
            <div className="cc-navshell__glow" />
            <div className="cc-nav cc-nav--desktop">
              <div className="cc-nav__brandrail">
                <Link className="cc-navbrand" href="/">
                  <span className="cc-brandmark">島</span>
                  <span className="cc-navbrandtext">
                    <span className="cc-brandtitle">安感島</span>
                    <span className="cc-brandsubtitle">不用一個人撐著，也能開始</span>
                  </span>
                </Link>
              </div>

              <nav className="cc-navlinks" aria-label="Primary">
                {DESKTOP_NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link key={item.href} className={`cc-navlink${active ? " is-active" : ""}`} href={item.href}>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="cc-navmeta cc-navmeta--desktop">
                {!resolved ? null : isLoggedIn ? (
                  <>
                    <span className="cc-navemail" title={currentEmail}>
                      {currentEmail}
                    </span>
                    <Link className="cc-btn" href="/account">
                      我的島
                    </Link>
                    <button className="cc-btn cc-navsignout" onClick={onSignOut} type="button">
                      登出
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="cc-btn-link" href="/auth/login">
                      登入
                    </Link>
                    <Link className="cc-btn" href="/auth/signup">
                      註冊
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <style jsx>{`
        .releaseDesktopHeader {
          position: sticky;
          top: 14px;
          z-index: 30;
          margin-bottom: 12px;
          background: transparent;
        }

        .releaseDesktopHeader__shell {
          width: min(100%, 1320px);
          margin: 0 auto;
          padding: 0 10px;
        }

        .releaseDesktopHeader__innerShell {
          min-height: 76px;
          padding: 12px 20px;
          border-radius: 24px;
          border: 1px solid rgba(255, 242, 232, 0.12);
          background: linear-gradient(180deg, rgba(43, 44, 48, 0.78), rgba(30, 32, 37, 0.76));
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px) saturate(1.04);
          -webkit-backdrop-filter: blur(16px) saturate(1.04);
        }

        :global(.releaseDesktopHeader__innerShell.cc-navshell) {
          margin-bottom: 0;
        }

        :global(.releaseDesktopHeader__innerShell .cc-nav) {
          min-height: 50px;
        }

        :global(.releaseDesktopHeader__innerShell .cc-nav__brandrail) {
          min-width: 0;
        }

        :global(.releaseDesktopHeader__innerShell .cc-navbrand) {
          min-width: 0;
        }

        :global(.releaseDesktopHeader__innerShell .cc-navlinks) {
          justify-content: center;
        }

        :global(.releaseDesktopHeader__innerShell .cc-navmeta--desktop) {
          justify-content: flex-end;
        }

        @media (max-width: 1260px) {
          .releaseDesktopHeader__shell {
            width: min(100%, 1240px);
            padding: 0 8px;
          }

          .releaseDesktopHeader__innerShell {
            padding: 11px 16px;
          }
        }

        @media (max-width: 1120px) {
          .releaseDesktopHeader__shell {
            width: min(100%, 1120px);
            padding: 0 6px;
          }

          .releaseDesktopHeader__innerShell {
            padding: 10px 14px;
            border-radius: 22px;
          }
        }

        @media (max-width: 1024px) {
          .releaseDesktopHeader__shell {
            width: min(100%, 1024px);
            padding: 0 4px;
          }

          .releaseDesktopHeader__innerShell {
            padding: 9px 12px;
            border-radius: 20px;
          }
        }
      `}</style>
    </>
  );
}
