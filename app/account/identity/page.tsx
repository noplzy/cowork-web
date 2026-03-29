"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

function normalizeTaiwanPhoneToE164(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    const numeric = cleaned.replace(/[^\d+]/g, "");
    return /^\+\d{8,15}$/.test(numeric) ? numeric : null;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (/^09\d{8}$/.test(digits)) {
    return `+886${digits.slice(1)}`;
  }

  if (/^9\d{8}$/.test(digits)) {
    return `+886${digits}`;
  }

  return null;
}

function mapOtpError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "送出手機驗證碼失敗，請稍後再試。";

  if (/Unable to get SMS provider/i.test(raw)) {
    return "目前簡訊驗證服務尚未完成配置，因此這一步暫時不會阻擋你使用網站。";
  }

  return raw;
}

function IdentityFallback() {
  return (
    <main className="cc-container">
      <TopNav />
      <section className="cc-card cc-empty-state">
        <div className="cc-stack-sm">
          <div className="cc-h3">正在準備身份綁定頁</div>
          <div className="cc-muted">稍後會顯示手機驗證與身份綁定資訊。</div>
        </div>
      </section>
    </main>
  );
}

function IdentityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/account", [searchParams]);

  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [hasSentCode, setHasSentCode] = useState(false);
  const [existingPhone, setExistingPhone] = useState<string | null>(null);
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/auth/login?reason=session-expired");
        return;
      }

      if (cancelled) return;

      setEmail(data.user.email ?? "");
      const currentPhone = data.user.phone ?? null;
      const confirmedAt = (data.user as any).phone_confirmed_at ?? null;

      setExistingPhone(currentPhone);
      if (currentPhone?.startsWith("+8869")) {
        setPhoneInput(`0${currentPhone.slice(4)}`);
      } else {
        setPhoneInput(currentPhone ?? "");
      }
      setPhoneConfirmed(Boolean(currentPhone && confirmedAt));
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function sendCode() {
    const normalizedPhone = normalizeTaiwanPhoneToE164(phoneInput);
    if (!normalizedPhone) {
      setMsg("請輸入台灣手機號碼，例如 0968xxxxxx。系統會自動轉成國際格式。");
      return;
    }

    setSending(true);
    setMsg("");

    try {
      const { error } = await supabase.auth.updateUser({
        phone: normalizedPhone,
      });

      if (error) throw error;

      setHasSentCode(true);
      setMsg("驗證碼已送出。若簡訊服務尚未完成配置，這一步目前不會阻擋你使用網站。");
    } catch (error) {
      setMsg(mapOtpError(error));
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    const normalizedPhone = normalizeTaiwanPhoneToE164(phoneInput);
    if (!normalizedPhone) {
      setMsg("請先輸入正確的手機號碼。");
      return;
    }

    if (!otp.trim()) {
      setMsg("請輸入簡訊中的驗證碼。");
      return;
    }

    setVerifying(true);
    setMsg("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp.trim(),
        type: "phone_change",
      });

      if (error) throw error;

      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();

      setPhoneConfirmed(true);
      setExistingPhone(normalizedPhone);
      setMsg("手機號碼驗證成功。");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "手機驗證失敗，請重新確認驗證碼。");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="cc-container">
      <TopNav email={email} />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-lg">
          <span className="cc-kicker">Identity Binding</span>
          <p className="cc-eyebrow">身份綁定｜風控與免費額度未來會越來越依賴這條線，但目前先不做進站硬阻擋</p>
          <h1 className="cc-h2">手機驗證仍保留，但從帳號中心獨立出來。</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.85 }}>
            這樣帳號中心可以專心處理 profile / friends / schedule / 支付摘要；
            身份綁定則專心處理免費額度、風控與未來更強的身份驗證路徑。
          </p>

          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">目前狀態</span>
              <div className="cc-metric-value" style={{ fontSize: "1.05rem" }}>{phoneConfirmed ? "已驗證" : "可選"}</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">台灣輸入習慣</span>
              <div className="cc-metric-value" style={{ fontSize: "1.05rem" }}>09xxxxxxxx</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">系統格式</span>
              <div className="cc-metric-value" style={{ fontSize: "1.05rem" }}>自動轉 +886</div>
            </div>
          </div>

          <div className="cc-action-row">
            <Link href={next} className="cc-btn-primary">回帳號中心</Link>
            <Link href="/rooms" className="cc-btn">前往 Rooms</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">手機驗證（可選）</p>
            <h2 className="cc-h2">之後這裡會與身份、風控、免費額度更緊密連動</h2>
          </div>

          <label className="cc-field">
            <span className="cc-field-label">台灣手機號碼</span>
            <input
              className="cc-input"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0968730221"
              autoComplete="tel"
              inputMode="tel"
            />
          </label>

          <div className="cc-caption">
            前台輸入請照台灣習慣輸入 <strong>09xxxxxxxx</strong>；系統送出時會自動轉成 <code>+8869xxxxxxxx</code>。
          </div>

          <div className="cc-action-row">
            <button className="cc-btn-primary" onClick={sendCode} disabled={sending || verifying} type="button">
              {sending ? "送出中…" : hasSentCode ? "重新發送驗證碼" : "發送驗證碼"}
            </button>
          </div>

          <label className="cc-field">
            <span className="cc-field-label">簡訊驗證碼</span>
            <input
              className="cc-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="輸入 6 碼驗證碼"
              inputMode="numeric"
            />
          </label>

          <div className="cc-action-row">
            <button className="cc-btn" onClick={verifyCode} disabled={!hasSentCode || verifying || sending} type="button">
              {verifying ? "驗證中…" : "完成驗證"}
            </button>
          </div>

          <div className="cc-note cc-stack-sm">
            <div><strong>Email：</strong>{email || "—"}</div>
            <div><strong>目前帳號上的手機：</strong>{existingPhone ?? "尚未綁定"}</div>
            <div><strong>驗證狀態：</strong>{phoneConfirmed ? "已驗證" : "尚未完成驗證"}</div>
          </div>

          {msg ? (
            <div className={msg.includes("成功") || msg.includes("已送出") || msg.includes("不會阻擋") ? "cc-note" : "cc-alert cc-alert-error"}>
              {msg}
            </div>
          ) : null}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function IdentityPage() {
  return (
    <Suspense fallback={<IdentityFallback />}>
      <IdentityContent />
    </Suspense>
  );
}
