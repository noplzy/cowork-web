"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";
import { IdentityRequirementPanel } from "@/components/auth/IdentityRequirementPanel";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildRequestHeaders(token?: string | null, initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders);
  const safeToken = String(token || "").trim();
  if (safeToken) headers.set("Authorization", `Bearer ${safeToken}`);
  return headers;
}

async function readPayload(res: Response, fallbackMessage: string) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || fallbackMessage || `Request failed: ${res.status}`);
  return body;
}

export default function BuddyServiceDetailPage() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = String(params?.serviceId || "");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [payload, setPayload] = useState<any>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [buyerNote, setBuyerNote] = useState("");
  const [message, setMessage] = useState("正在讀取服務詳情…");

  async function readJson(path: string, init: RequestInit = {}) {
    const headers = buildRequestHeaders(token, init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await fetch(path, { ...init, headers, cache: "no-store" });
    return readPayload(res, `Request failed: ${res.status}`);
  }

  async function load(currentToken = token) {
    const authHeaders = buildRequestHeaders(currentToken);
    const [servicePayload, identityPayload] = await Promise.all([
      fetch(`/api/buddies/services/${encodeURIComponent(serviceId)}`, {
        headers: authHeaders,
        cache: "no-store",
      }).then((res) => readPayload(res, "讀取服務失敗。")),
      currentToken
        ? fetch("/api/account/identity/status", {
            headers: buildRequestHeaders(currentToken),
            cache: "no-store",
          })
            .then((res) => res.json().catch(() => null))
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    setPayload(servicePayload);
    setIdentity(identityPayload?.identity ?? null);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;

      const accessToken = session?.accessToken ?? "";
      setToken(accessToken);
      setEmail(session?.email ?? "");

      await load(accessToken);
      if (!cancelled) setMessage("");
    })().catch((error) => {
      if (!cancelled) setMessage(error?.message || "讀取服務詳情失敗。");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  async function book(slotId: string) {
    if (!token) return setMessage("請先登入後再預約。");
    setMessage("正在送出預約…");

    try {
      await readJson("/api/buddies/bookings", {
        method: "POST",
        body: JSON.stringify({ service_id: serviceId, slot_id: slotId, buyer_note: buyerNote }),
      });
      setBuyerNote("");
      await load(token);
      setMessage("已送出預約。請到 Buddies / 預約查看狀態。");
    } catch (error: any) {
      setMessage(error?.message || "送出預約失敗。");
    }
  }

  const service = payload?.service;
  const profile = payload?.provider_profile;
  const trust = payload?.provider_trust;
  const slots = payload?.slots || [];
  const reviewSummary = payload?.review_summary || {};

  return (
    <Image20SidebarShell
      title="安感夥伴服務"
      email={email}
      lead="正式服務頁會先說清楚服務內容、身份狀態、邊界與預約條件，避免把 Buddies 做成模糊陪聊。"
    >
      <div className="i20-page" data-image20-dom-page="buddy-service-detail-v1182">
        {message ? <div className="i20-panel">{message}</div> : null}
        {service ? (
          <>
            <section
              className="i20-panel dark"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,rgba(7,21,29,.95),rgba(7,21,29,.52)),url(/site-assets/image20/hero/brand-hero-evening-shared-presence.png)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: 290,
              }}
            >
              <span className="i20-kicker">Buddies Service</span>
              <h2 className="i20-serif" style={{ fontSize: 44 }}>
                {service.title}
              </h2>
              <p>{service.summary}</p>
              <div className="i20-chip-row">
                <span className="i20-chip">NT${service.price_per_hour_twd}/hr</span>
                <span className="i20-chip">{service.buddy_category}</span>
                <span className="i20-chip">{service.interaction_style}</span>
                <span className="i20-chip">{service.delivery_mode}</span>
                {trust?.professional_buddy ? <span className="i20-chip">Professional Buddy</span> : null}
                {trust?.real_name_verified ? <span className="i20-chip">實名已審核</span> : null}
              </div>
              <div className="i20-actions-row" style={{ marginTop: 18 }}>
                {profile?.handle ? (
                  <Link className="i20-btn ghost" href={`/u/${profile.handle}`}>
                    查看公開檔案
                  </Link>
                ) : null}
                <Link className="i20-btn ghost" href="/buddies">
                  回服務列表
                </Link>
              </div>
            </section>

            <section className="i20-room-layout" style={{ marginTop: 18 }}>
              <article className="i20-panel">
                <span className="i20-kicker">Service Detail</span>
                <h3>服務內容與邊界</h3>
                <p>{service.description || service.summary}</p>
                <div className="i20-list">
                  <div className="i20-card">
                    <b>提供者</b>
                    <p>{profile?.display_name || profile?.handle || "安感夥伴"}</p>
                  </div>
                  <div className="i20-card">
                    <b>評價摘要</b>
                    <p>{reviewSummary.count ? `${reviewSummary.average_rating} / 5，共 ${reviewSummary.count} 則` : "尚無公開評價"}</p>
                  </div>
                  <div className="i20-card">
                    <b>可預約條件</b>
                    <p>必須完成手機綁定；Buddies 預約需完成實名審核。</p>
                  </div>
                </div>
              </article>

              <aside className="i20-panel">
                <span className="i20-kicker">Booking</span>
                <h3>選擇可預約時段</h3>
                <IdentityRequirementPanel identity={identity} requireRealName compact />
                {!token ? (
                  <div className="i20-card">
                    <b>請先登入</b>
                    <p>登入後才能預約 Buddies 服務。</p>
                    <Link className="i20-btn peach" href={`/auth/login?next=${encodeURIComponent(`/buddies/services/${serviceId}`)}`}>
                      登入
                    </Link>
                  </div>
                ) : null}
                <textarea
                  className="i20-textarea"
                  value={buyerNote}
                  onChange={(event) => setBuyerNote(event.target.value)}
                  placeholder="想先讓對方知道的需求、目標或界線。"
                />
                <div className="i20-list" style={{ marginTop: 14 }}>
                  {slots.length ? (
                    slots.map((slot: any) => (
                      <div className="i20-card" key={slot.id}>
                        <b>
                          {formatDateTime(slot.starts_at)} ～ {formatDateTime(slot.ends_at)}
                        </b>
                        <p>{slot.note || "可預約時段"}</p>
                        <button className="i20-btn peach" onClick={() => book(slot.id)}>
                          送出預約
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="i20-card">
                      <b>目前沒有開放時段</b>
                      <p>可以稍後再回來查看，或從公開檔案了解這位安感夥伴。</p>
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </div>
    </Image20SidebarShell>
  );
}
