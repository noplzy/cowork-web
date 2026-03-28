"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { fetchSecurityStatus, formatBlockTime, type SecurityStatus } from "@/lib/securityStatusClient";
import { SUPPORT_FORM_URL, hasSupportFormUrl } from "@/lib/supportForm";

export default function BlockedPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [msg, setMsg] = useState("");
  const formReady = hasSupportFormUrl();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        if (!cancelled) {
          setLoading(false);
          setMsg("你目前沒有登入。若你想查看帳號狀態，請先登入。");
        }
        return;
      }

      const nextStatus = await fetchSecurityStatus(accessToken).catch((error) => {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "無法取得封鎖資訊。");
        }
        return null;
      });

      if (!cancelled) {
        setStatus(nextStatus);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    window.location.href = "/auth/login";
  }

  return (
    <main className="cc-login-shell">
      <section className="cc-login-grid">
        <div className="cc-card cc-stack-md">
          <span className="cc-kicker">Account Restricted</span>
          <p className="cc-eyebrow">帳號已限制使用</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}>
            這個帳號目前無法繼續使用安感島。
          </h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
            若你認為這是誤判，請改用公開客服表單提出申訴。
          </p>

          <div className="cc-action-row">
            <button className="cc-btn-primary" type="button" onClick={signOut}>登出</button>
            {formReady ? (
              <a href={SUPPORT_FORM_URL} target="_blank" rel="noreferrer" className="cc-btn">
                前往客服表單
              </a>
            ) : (
              <Link href="/contact" className="cc-btn">查看客服資訊</Link>
            )}
          </div>
        </div>

        <div className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">封鎖資訊</p>

          {loading ? (
            <div className="cc-note">正在讀取封鎖資訊…</div>
          ) : status?.blocked ? (
            <>
              <div className="cc-note"><strong>封鎖時間：</strong> {formatBlockTime(status.created_at)}</div>
              <div className="cc-alert cc-alert-error"><strong>封鎖原因：</strong> {status.reason || "未提供"}</div>
              <div className="cc-note"><strong>封鎖範圍：</strong> {status.block_scope || "site"}</div>
              <div className="cc-note">申訴時請提供帳號 Email、封鎖頁截圖與補充說明。</div>
            </>
          ) : (
            <div className="cc-note">
              {msg || "目前查不到有效封鎖紀錄。若你是手動進到這頁，可以直接返回網站。"}
            </div>
          )}

          <div className="cc-caption">客服 Email：noccs75@gmail.com ｜ 客服電話：0968730221</div>
        </div>
      </section>
    </main>
  );
}
