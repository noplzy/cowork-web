// components/TopNav.tsx
"use client";

import Link from "next/link";

type Props = {
  email?: string;
  onSignOut?: () => void;
};

export function TopNav({ email, onSignOut }: Props) {
  return (
    <header className="cc-nav" style={{ marginBottom: 14 }}>
      <div className="cc-row" style={{ flexWrap: "wrap" }}>
        <Link className="cc-navlink" href="/">
          安感島
        </Link>
        <Link className="cc-navlink" href="/rooms">
          共工 Rooms
        </Link>
        <Link className="cc-navlink" href="/buddies">
          搭子
        </Link>
        <Link className="cc-navlink" href="/account">
          方案/額度
        </Link>
      </div>

      <div className="cc-row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        {email ? <span className="cc-muted" style={{ fontSize: 13 }}>{email}</span> : null}
        {onSignOut ? (
          <button className="cc-btn" onClick={onSignOut} type="button">
            登出
          </button>
        ) : null}
      </div>
    </header>
  );
}
