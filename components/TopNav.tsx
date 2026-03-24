"use client";

import Link from "next/link";

type Props = {
  email?: string;
  onSignOut?: () => void;
};

export function TopNav({ email, onSignOut }: Props) {
  return (
    <header className="cc-navshell">
      <div className="cc-nav">
        <div className="cc-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Link className="cc-navbrand" href="/">
            <span className="cc-brandmark">島</span>
            <span>
              <span className="cc-brandtitle">安感島</span>
              <span className="cc-brandsubtitle">給獨自撐著的你，一個安靜靠岸的地方</span>
            </span>
          </Link>

          <nav className="cc-navlinks" aria-label="Primary">
            <Link className="cc-navlink" href="/rooms">
              共工 Rooms
            </Link>
            <Link className="cc-navlink" href="/buddies">
              安感夥伴
            </Link>
            <Link className="cc-navlink" href="/account">
              方案 / 額度
            </Link>
          </nav>
        </div>

        <div className="cc-navmeta">
          {email ? <span className="cc-pill-soft">{email}</span> : <Link className="cc-btn-link" href="/auth/login">登入 / 註冊</Link>}
          {onSignOut ? (
            <button className="cc-btn" onClick={onSignOut} type="button">
              登出
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
