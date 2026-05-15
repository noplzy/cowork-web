"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const PENDING_PHONE_KEY = "identity_pending_phone_e164";
const PENDING_PHONE_SENT_KEY = "identity_pending_phone_sent";

function normalizeTaiwanPhoneToE164(input: string) {
  const cleaned = input.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return /^\+\d{8,15}$/.test(cleaned) ? cleaned : null;
  const d = cleaned.replace(/\D/g, "");
  if (/^09\d{8}$/.test(d)) return `+886${d.slice(1)}`;
  if (/^9\d{8}$/.test(d)) return `+886${d}`;
  return null;
}

function e164ToTaiwanInput(phone: string | null | undefined) {
  const p = (phone ?? "").trim();
  if (!p) return "";
  if (p.startsWith("+8869") && p.length === 12) return `0${p.slice(4)}`;
  return p;
}

function mapOtpError(error: unknown) {
  const raw = error instanceof Error ? error.message : "送出手機驗證碼失敗";
  return /Unable to get SMS provider/i.test(raw)
    ? "目前簡訊驗證服務尚未完成配置，因此這一步暫時不會阻擋你使用網站。"
    : raw;
}

function readPendingPhoneState() {
  if (typeof window === "undefined") {
    return { pendingPhone: "", pendingSent: false };
  }
  return {
    pendingPhone: window.sessionStorage.getItem(PENDING_PHONE_KEY) || "",
    pendingSent: window.sessionStorage.getItem(PENDING_PHONE_SENT_KEY) === "1",
  };
}

function writePendingPhoneState(phone: string, sent: boolean) {
  if (typeof window === "undefined") return;
  if (phone) {
    window.sessionStorage.setItem(PENDING_PHONE_KEY, phone);
  } else {
    window.sessionStorage.removeItem(PENDING_PHONE_KEY);
  }
  if (sent) {
    window.sessionStorage.setItem(PENDING_PHONE_SENT_KEY, "1");
  } else {
    window.sessionStorage.removeItem(PENDING_PHONE_SENT_KEY);
  }
}

function IdentityContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/account", [sp]);

  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [pendingPhoneE164, setPendingPhoneE164] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const normalizedPhone = useMemo(
    () => normalizeTaiwanPhoneToE164(phoneInput),
    [phoneInput]
  );

  const verifyTargetPhone = pendingPhoneE164 || normalizedPhone || "";
  const canSend = Boolean(normalizedPhone) && !sending && !verifying;
  const canVerify = Boolean(verifyTargetPhone && otp.trim()) && !sending && !verifying;
  const progress = confirmed ? 100 : hasSent ? 76 : normalizedPhone ? 58 : 42;

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

      const saved = readPendingPhoneState();
      const confirmedPhone = data.user.phone ?? "";
      const pendingFromUser =
        String((data.user as any)?.new_phone ?? "").trim() ||
        String((data.user as any)?.phone_change ?? "").trim();

      const preferredInputPhone = confirmedPhone || pendingFromUser || saved.pendingPhone;
      setPhoneInput(e164ToTaiwanInput(preferredInputPhone));

      const pendingPhone = pendingFromUser || saved.pendingPhone;
      const pendingPhoneChange =
        Boolean(pendingPhone) &&
        Boolean((data.user as any)?.phone_change_sent_at || saved.pendingSent);

      setPendingPhoneE164(pendingPhone);
      setHasSent(pendingPhoneChange);
      setConfirmed(Boolean(confirmedPhone && (data.user as any).phone_confirmed_at));

      writePendingPhoneState(pendingPhone, pendingPhoneChange);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function send() {
    if (!normalizedPhone) {
      setMsg("請輸入台灣手機號碼，例如 0968xxxxxx。");
      return;
    }

    setSending(true);
    setMsg("");

    try {
      const { error } = await supabase.auth.updateUser({ phone: normalizedPhone });
      if (error) throw error;

      setPendingPhoneE164(normalizedPhone);
      setHasSent(true);
      writePendingPhoneState(normalizedPhone, true);
      setMsg("驗證碼已送出。");
    } catch (e) {
      setMsg(mapOtpError(e));
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (!verifyTargetPhone) {
      setMsg("請先輸入正確手機號碼。");
      return;
    }

    if (!otp.trim()) {
      setMsg("請輸入驗證碼。");
      return;
    }

    setVerifying(true);
    setMsg("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: verifyTargetPhone,
        token: otp.trim(),
        type: "phone_change",
      });
      if (error) throw error;

      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();
      setConfirmed(true);
      setHasSent(false);
      setPendingPhoneE164("");
      writePendingPhoneState("", false);
      setMsg("手機號碼驗證成功。");
    } catch (e: any) {
      setMsg(e?.message || "手機驗證失敗。");
    } finally {
      setVerifying(false);
    }
  }

  const ringStyle = {
    background: `conic-gradient(#e8a181 ${progress}%, rgba(255,255,255,.12) ${progress}% 100%)`,
  } as CSSProperties;

  return (
    <Image20SidebarShell
      title="身份驗證"
      email={email}
      lead="讓帳號信任、風控與未來服務流程有更清楚的基礎，同時不把新使用者擋在門外。"
    >
      <div className="i20-page" data-image20-dom-page="identity-v9-extra9">
        <section className={styles.identityHeroGrid}>
          <article className={`i20-panel dark ${styles.identityProgressCard}`}>
            <div className={styles.progressRing} style={ringStyle}>
              <div className={styles.progressRingInner}>
                <span>目前</span>
                <strong>{progress}%</strong>
              </div>
            </div>

            <div>
              <span className="i20-kicker">Identity</span>
              <h2 className="i20-serif">信任，是可以被看懂的進度。</h2>
              <p>
                手機驗證讓後續額度、風控與安感夥伴流程更有依據；現階段仍維持可選，不影響你使用主要 Rooms 功能。
              </p>
            </div>
          </article>

          <article className={`i20-panel ${styles.identityMetrics}`}>
            <div className={styles.identityMetric}>
              <span>驗證狀態</span>
              <b>{confirmed ? "已完成" : hasSent ? "等待輸入驗證碼" : "尚未完成"}</b>
            </div>
            <div className={styles.identityMetric}>
              <span>輸入習慣</span>
              <b>09xxxxxxxx</b>
            </div>
            <div className={styles.identityMetric}>
              <span>系統格式</span>
              <b>+886</b>
            </div>
          </article>
        </section>

        <section className={styles.identityMainGrid}>
          <article className={`i20-panel ${styles.identityFormStack}`}>
            <div>
              <span className="i20-kicker">Verify</span>
              <h3>手機號碼驗證</h3>
              <p className="i20-muted">
                請先輸入台灣手機號碼，收到簡訊後再填入驗證碼完成確認。
              </p>
            </div>

            <div className="i20-field">
              <label>台灣手機號碼</label>
              <input
                className="i20-input"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                inputMode="tel"
                placeholder="0968xxxxxx"
              />
            </div>

            <button className="i20-btn peach" onClick={send} disabled={!canSend}>
              {sending ? "送出中…" : hasSent ? "重新發送驗證碼" : "發送驗證碼"}
            </button>

            <div className="i20-field">
              <label>簡訊驗證碼</label>
              <input
                className="i20-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                placeholder="輸入收到的驗證碼"
              />
            </div>

            <button className="i20-btn" onClick={verify} disabled={!canVerify}>
              {verifying ? "驗證中…" : "完成驗證"}
            </button>

            {pendingPhoneE164 ? <div className="i20-card">本次驗證目標：{pendingPhoneE164}</div> : null}
            {msg ? <div className="i20-card">{msg}</div> : null}
          </article>

          <aside className={styles.identityStatusGrid}>
            <article className={styles.identityStatus}>
              <span className="i20-kicker">Why</span>
              <h3>讓服務更穩</h3>
              <p>身份資料能支援風控、額度與客服查核，不只是多一道表單。</p>
            </article>
            <article className={styles.identityStatus}>
              <span className="i20-kicker">Boundary</span>
              <h3>不強迫打斷使用</h3>
              <p>現階段手機驗證不做進站硬阻擋，讓你先進 Rooms，再依需要補齊。</p>
            </article>
            <article className={`i20-panel dark ${styles.sideStack}`}>
              <span className="i20-kicker">Next</span>
              <h3>返回帳號中心</h3>
              <p>完成或略過後，都可以回到我的島查看方案、排程與下一步。</p>
              <Link className="i20-btn ghost" href={next}>
                回帳號中心
              </Link>
            </article>
          </aside>
        </section>
      </div>
    </Image20SidebarShell>
  );
}

export default function IdentityPage() {
  return (
    <Suspense fallback={<main className="i20-root">讀取中…</main>}>
      <IdentityContent />
    </Suspense>
  );
}
