"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
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
    ? "手機驗證服務暫時無法完成，請稍後再試或聯絡客服。"
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

  const progress = confirmed ? 33 : hasSent ? 22 : normalizedPhone ? 12 : 0;
  const progressLabel = confirmed
    ? "已完成第 1 階段"
    : hasSent
      ? "等待驗證碼"
      : "尚未開始";
  const progressStyle = {
    background: `conic-gradient(#e8a181 ${progress}%, rgba(255,255,255,.14) ${progress}% 100%)`,
  } as CSSProperties;

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

  return (
    <main className="i20-root" data-image20-dom-page="identity-v10-template-aligned">
      <section className={styles.identityLanding}>
        <div className={styles.identityLandingBackdrop} aria-hidden="true" />
        <Image20TopNav dark email={email} />

        <div className={styles.identityLandingGrid}>
          <article className={styles.identityIntro}>
            <span className="i20-kicker">Identity</span>
            <h1 className="i20-serif">身份驗證，讓陪伴更安心。</h1>
            <p>
              在安感島，陪伴來自真實與尊重。完整驗證會逐步包含聯絡驗證、
              證件確認與最終審核，讓服務信任建立得更清楚。
            </p>
            <a className="i20-btn peach" href="#identity-phone-step">
              繼續驗證
            </a>
          </article>

          <aside className={styles.identityOverviewCard}>
            <div className={styles.identityProgressRing} style={progressStyle}>
              <div>
                <strong>{progress}%</strong>
                <span>{progressLabel}</span>
              </div>
            </div>

            <div>
              <span className="i20-kicker">Current Status</span>
              <h2 className="i20-serif">目前驗證進度</h2>
              <p>
                {confirmed
                  ? "手機聯絡驗證已完成；證件驗證與審核步驟會在後續正式服務中接續。"
                  : "先完成手機聯絡驗證，之後會接續證件資料與審核流程。"}
              </p>
              <div className={styles.identityOverviewMeta}>
                <span>完整流程：3 階段</span>
                <span>已完成：{confirmed ? "1 / 3" : "0 / 3"}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.identityBoard}>
        <div className={styles.identityStageGrid}>
          <article className={styles.identityStageCard} data-state={confirmed ? "done" : "active"}>
            <span>01</span>
            <h3>手機聯絡驗證</h3>
            <p>確認聯絡方式可用，作為帳號安全與後續服務聯繫基礎。</p>
            <ul>
              <li>{confirmed ? "已完成手機號碼確認" : "等待完成手機號碼確認"}</li>
              <li>保留帳號與客服聯繫通道</li>
            </ul>
          </article>

          <article className={styles.identityStageCard} data-state="planned">
            <span>02</span>
            <h3>證件資料確認</h3>
            <p>正式驗證流程將包含必要的身分文件與第二證明文件。</p>
            <ul>
              <li>身分證件資料</li>
              <li>第二證明文件</li>
            </ul>
            <button type="button" disabled>
              待開放
            </button>
          </article>

          <article className={styles.identityStageCard} data-state="planned">
            <span>03</span>
            <h3>完成與審核</h3>
            <p>資料齊備後，進入平台審核與正式驗證完成狀態。</p>
            <ul>
              <li>資料審核</li>
              <li>驗證完成</li>
            </ul>
            <button type="button" disabled>
              等待前置步驟
            </button>
          </article>
        </div>

        <div className={styles.identityWorkGrid}>
          <article id="identity-phone-step" className={styles.identityPhonePanel}>
            <div>
              <span className="i20-kicker">Verify</span>
              <h2 className="i20-serif">先完成手機驗證</h2>
              <p>
                請輸入台灣手機號碼，收到簡訊後填入驗證碼。這是目前已可操作的身份驗證步驟。
              </p>
            </div>

            <div className={styles.identityFormGrid}>
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
            </div>

            <div className={styles.identityMessageStack}>
              {pendingPhoneE164 ? <div>本次驗證目標：{pendingPhoneE164}</div> : null}
              {msg ? <div>{msg}</div> : null}
            </div>
          </article>

          <aside className={styles.identitySupportColumn}>
            <article>
              <span className="i20-kicker">Privacy</span>
              <h3>我們如何保護驗證資料</h3>
              <p>驗證資訊會用於身份確認、安全維護與未來服務資格判定。</p>
              <Link href="/privacy">查看隱私權政策 →</Link>
            </article>

            <article>
              <span className="i20-kicker">Support</span>
              <h3>驗證遇到問題？</h3>
              <p>手機驗證、帳號狀態或後續證件流程有疑問，可直接聯絡客服。</p>
              <Link href="/contact">聯絡客服 →</Link>
            </article>

            <article className={styles.identitySupportDark}>
              <span className="i20-kicker">Next</span>
              <h3>返回我的島</h3>
              <p>完成現有步驟後，可回帳號中心查看方案、排程與下一步。</p>
              <Link className="i20-btn ghost" href={next}>
                回帳號中心
              </Link>
            </article>
          </aside>
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}

export default function IdentityPage() {
  return (
    <Suspense fallback={<main className="i20-root">讀取中…</main>}>
      <IdentityContent />
    </Suspense>
  );
}
