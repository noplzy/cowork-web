"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { fetchSecurityStatus, formatBlockTime, type SecurityStatus } from "@/lib/securityStatusClient";

export default function BlockedPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [msg, setMsg] = useState("");

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
        <div className="cc-card cc-hero-main cc-stack-lg">
          <span className="cc-kicker">Account Restricted</span>
          <p className="cc-eyebrow">帳號已限制使用</p>
          <h1 className="cc-h1">這個帳號目前無法繼續使用安感島。</h1>
          <p className="cc-lead" style={{ marginTop: 0 }}>
            目前先採最小封鎖方案：只要帳號出現在封鎖名單中，登入後就直接導到這一頁。
            若你認為這是誤判，請透過客服資訊聯絡我們。
          </p>

          <div className="cc-action-row">
            <button className="cc-btn-primary" type="button" onClick={signOut}>登出</button>
            <Link href="/contact" className="cc-btn">聯絡客服</Link>
          </div>
        </div>

        <div className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">封鎖資訊</p>
            <h2 className="cc-h2">目前可顯示的資料</h2>
          </div>

          {loading ? (
            <div className="cc-note">正在讀取封鎖資訊…</div>
          ) : status?.blocked ? (
            <>
              <div className="cc-note">
                <strong>封鎖時間：</strong> {formatBlockTime(status.created_at)}
              </div>
              <div className="cc-alert cc-alert-error">
                <strong>封鎖原因：</strong> {status.reason || "未提供"}
              </div>
              <div className="cc-note">
                <strong>封鎖範圍：</strong> {status.block_scope || "site"}
              </div>
              <div className="cc-note">
                若你認為這是錯誤封鎖，請提供帳號 Email、封鎖頁截圖與相關說明，我們再人工確認。
              </div>
            </>
          ) : (
            <div className="cc-note">
              {msg || "目前查不到有效封鎖紀錄。若你是手動進到這頁，可以直接返回網站。"}
            </div>
          )}

          <div className="cc-caption">
            客服 Email：noccs75@gmail.com ｜ 客服電話：0968730221
          </div>
        </div>
      </section>
    </main>
  );
}
