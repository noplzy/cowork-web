"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";

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
    <Image20SidebarShell title="身份驗證" email={email}>
      <div className="i20-page" data-image20-dom-page="identity-v8">
        <section className="i20-panel dark">
          <span className="i20-kicker">Identity</span>
          <h2 className="i20-serif" style={{ fontSize: 44 }}>
            身份驗證，讓信任慢慢建立。
          </h2>
          <p>目前先保留手機驗證，不做進站硬阻擋；未來可連動風控、免費額度與 Buddies 審核。</p>
        </section>

        <section className="i20-room-layout" style={{ marginTop: 18 }}>
          <article className="i20-panel">
            <div className="i20-grid three">
              <div className="i20-card">
                <span className="i20-kicker">狀態</span>
                <h3>{confirmed ? "已驗證" : "可選"}</h3>
              </div>
              <div className="i20-card">
                <span className="i20-kicker">輸入習慣</span>
                <h3>09xxxxxxxx</h3>
              </div>
              <div className="i20-card">
                <span className="i20-kicker">系統格式</span>
                <h3>+886</h3>
              </div>
            </div>

            <div className="i20-list" style={{ marginTop: 18 }}>
              <div className="i20-field">
                <label>台灣手機號碼</label>
                <input
                  className="i20-input"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  inputMode="tel"
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
                />
              </div>

              <button className="i20-btn" onClick={verify} disabled={!canVerify}>
                {verifying ? "驗證中…" : "完成驗證"}
              </button>

              {pendingPhoneE164 ? <div className="i20-card">本次驗證目標：{pendingPhoneE164}</div> : null}

              {msg ? <div className="i20-card">{msg}</div> : null}
            </div>
          </article>

          <aside className="i20-panel dark">
            <h3>安全邊界</h3>
            <p>身份驗證服務於信任與風控，不是把新使用者擋在門外。</p>
            <Link className="i20-btn ghost" href={next}>
              回帳號中心
            </Link>
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
