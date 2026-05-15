"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { Image20Hero } from "@/components/image20/Image20Shared";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type ContactDraft = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

const initialDraft: ContactDraft = {
  name: "",
  email: "",
  topic: "同行空間 / 使用問題",
  message: "",
};

export default function ContactPage() {
  const [draft, setDraft] = useState<ContactDraft>(initialDraft);

  const mailtoHref = useMemo(() => {
    const subject = `安感島客服｜${draft.topic.trim() || "一般詢問"}`;
    const body = [
      `姓名：${draft.name.trim() || "未填"}`,
      `Email：${draft.email.trim() || "未填"}`,
      `主題：${draft.topic.trim() || "一般詢問"}`,
      "",
      draft.message.trim() || "請在這裡補充問題內容。",
    ].join("\n");

    return `mailto:support@getcalmandco.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [draft]);

  const canOpenDraft = Boolean(draft.email.trim() && draft.message.trim());

  function update<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="i20-root" data-image20-dom-page="contact-v9-extra9">
      <Image20TopNav dark />
      <Image20Hero
        small
        eyebrow="Contact"
        title="有需要時，我們都在這裡。"
        lead="客服不是網站角落的一個信箱，而是讓使用者知道：遇到房間、方案、付款或帳號問題時，有清楚的入口可以找到人。"
        actions={[
          { href: "/rooms", label: "前往同行空間" },
          { href: "/pricing", label: "查看方案 / 價格", peach: true },
        ]}
      />

      <section className={styles.contentBand}>
        <div className={styles.editorialSplit}>
          <article className={`i20-panel dark ${styles.sideStack}`}>
            <div>
              <span className="i20-kicker">Support</span>
              <h2 className="i20-serif">先找到對的支援入口。</h2>
              <p>公開服務、付款、帳號與房內互動，都應該有對應的回答方式。</p>
            </div>

            <div className={styles.supportList}>
              <a className={styles.supportItem} href="mailto:support@getcalmandco.com">
                <b>客服信箱</b>
                <span>support@getcalmandco.com</span>
              </a>
              <div className={styles.supportItem}>
                <b>客服時段</b>
                <span>平日 10:00–18:00，非即時事件會依序回覆。</span>
              </div>
              <div className={styles.supportItem}>
                <b>營運資訊</b>
                <span>安感島資訊服務工作室｜統一編號 61136243</span>
              </div>
            </div>

            <div className="i20-softbar" style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.14)" }}>
              <span>需要先看規則？</span>
              <Link href="/terms" className="i20-btn ghost">
                平台規則
              </Link>
            </div>
          </article>

          <article className={`i20-panel ${styles.formStack}`}>
            <div>
              <span className="i20-kicker">Message</span>
              <h2 className="i20-serif">整理問題，直接寄給客服。</h2>
              <p className="i20-muted">
                先把必要資訊整理好，客服會更快理解你遇到的狀況。
              </p>
            </div>

            <div className="i20-form-grid">
              <div className="i20-field">
                <label>你的稱呼</label>
                <input
                  className="i20-input"
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="例如：Wade"
                />
              </div>
              <div className="i20-field">
                <label>可回覆 Email</label>
                <input
                  className="i20-input"
                  value={draft.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="name@example.com"
                  inputMode="email"
                />
              </div>
            </div>

            <div className="i20-field">
              <label>詢問主題</label>
              <select
                className="i20-select"
                value={draft.topic}
                onChange={(event) => update("topic", event.target.value)}
              >
                <option>同行空間 / 使用問題</option>
                <option>方案 / 付款問題</option>
                <option>身份驗證 / 帳號問題</option>
                <option>退款 / 服務交付</option>
                <option>其他詢問</option>
              </select>
            </div>

            <div className="i20-field">
              <label>問題內容</label>
              <textarea
                className="i20-textarea"
                value={draft.message}
                onChange={(event) => update("message", event.target.value)}
                placeholder="請描述遇到的情況、發生時間，以及你希望客服協助確認的重點。"
              />
            </div>

            <a
              className={`i20-btn peach${canOpenDraft ? "" : " is-disabled"}`}
              href={canOpenDraft ? mailtoHref : undefined}
              aria-disabled={!canOpenDraft}
              onClick={(event) => {
                if (!canOpenDraft) {
                  event.preventDefault();
                }
              }}
            >
              開啟客服信件草稿
            </a>

            <p className={styles.mailHint}>
              點擊後會開啟你的郵件程式，並帶入已整理好的客服信件內容。
            </p>
          </article>
        </div>

        <div className={styles.quickGrid}>
          <article className="i20-card">
            <span className="i20-kicker">Rooms</span>
            <h3>房間使用</h3>
            <p>進房、排程、入場憑證與視訊效果相關問題。</p>
          </article>
          <article className="i20-card">
            <span className="i20-kicker">Billing</span>
            <h3>方案與退款</h3>
            <p>付款、方案差異、退款政策與交付說明。</p>
          </article>
          <article className="i20-card">
            <span className="i20-kicker">Account</span>
            <h3>帳號與安全</h3>
            <p>登入、身份驗證、資料更新與安全疑慮。</p>
          </article>
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}
