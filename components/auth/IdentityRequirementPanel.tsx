"use client";

import Link from "next/link";

export type IdentityRequirementState = {
  phone_verified?: boolean;
  real_name_verified?: boolean;
  email_verified?: boolean;
};

export function IdentityRequirementPanel({ identity, requireRealName = false, compact = false }: { identity?: IdentityRequirementState | null; requireRealName?: boolean; compact?: boolean }) {
  const phoneOk = Boolean(identity?.phone_verified);
  const realOk = Boolean(identity?.real_name_verified);
  const blocked = !phoneOk || (requireRealName && !realOk);
  if (!blocked) return null;

  return (
    <section className="i20-panel" style={{ marginTop: compact ? 0 : 18 }}>
      <span className="i20-kicker">Identity Gate</span>
      <h3>{!phoneOk ? "請先完成手機號碼綁定" : "請先完成實名審核"}</h3>
      <p>
        安感島的正式規則是：Email 是登入身份、手機號碼是平台功能使用門檻；Buddies 因為涉及付費陪伴與服務邊界，還需要實名審核。
      </p>
      <div className="i20-chip-row">
        <span className="i20-chip">Email {identity?.email_verified ? "已驗證" : "登入中"}</span>
        <span className="i20-chip">手機 {phoneOk ? "已綁定" : "待綁定"}</span>
        <span className="i20-chip">實名 {realOk ? "已審核" : "Buddies 前必須完成"}</span>
      </div>
      <div className="i20-actions-row" style={{ marginTop: 14 }}>
        {!phoneOk ? <Link className="i20-btn peach" href="/account/identity">綁定手機</Link> : null}
        {phoneOk && requireRealName && !realOk ? <Link className="i20-btn peach" href="/account/identity/bindings">申請實名審核</Link> : null}
        <Link className="i20-btn ghost" href="/account">回我的中心</Link>
      </div>
    </section>
  );
}
