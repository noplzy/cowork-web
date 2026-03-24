"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("付款 / 權益問題");
  const [message, setMessage] = useState("");

  const mailtoHref = useMemo(() => {
    const body = [
      `姓名：${name || ""}`,
      `聯絡 Email：${email || ""}`,
      "",
      message || "",
    ].join("\n");
    return `mailto:noccs75@gmail.com?subject=${encodeURIComponent(`安感島客服｜${subject}`)}&body=${encodeURIComponent(body)}`;
  }, [email, message, name, subject]);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Contact</span>
          <p className="cc-eyebrow">客服與聯絡｜付款、續訂、權益異常都可以直接找我們</p>
          <h1 className="cc-h1">有問題時，知道要找誰，會安心很多。</h1>
          <p className="cc-lead">
            若你遇到付款成功但權益未更新、重複扣款、取消續訂、帳號登入或方案問題，請透過以下客服資訊聯絡我們。
          </p>
          <div className="cc-grid-metrics cc-section">
            <div className="cc-metric">
              <span className="cc-metric-label">客服 Email</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>noccs75@gmail.com</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">客服電話</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>0968730221</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">客服時段</span>
              <div className="cc-metric-value" style={{ fontSize: "1rem" }}>10:00~00:00</div>
            </div>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">營業資訊</p>
            <div className="cc-note cc-stack-sm">
              <div>品牌名稱：安感島</div>
              <div>地址：高雄市前鎮區廣東三街89號</div>
              <div>客服回覆目標：半天內</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">聯絡表單</p>
            <h2 className="cc-h2">會幫你帶入 Email 草稿</h2>
          </div>

          <label className="cc-field">
            <span className="cc-field-label">姓名</span>
            <input className="cc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" />
          </label>
          <label className="cc-field">
            <span className="cc-field-label">聯絡 Email</span>
            <input className="cc-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="cc-field">
            <span className="cc-field-label">問題類型</span>
            <select className="cc-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option>付款 / 權益問題</option>
              <option>取消續訂</option>
              <option>退款申請</option>
              <option>登入 / 帳號問題</option>
              <option>其他問題</option>
            </select>
          </label>
          <label className="cc-field">
            <span className="cc-field-label">訊息內容</span>
            <textarea className="cc-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="請描述你的問題，若是付款問題可附上付款時間、金額與帳號 Email。" />
          </label>

          <div className="cc-action-row">
            <a href={mailtoHref} className="cc-btn-primary">送出 Email</a>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">常見情況</p>
            <h2 className="cc-h2">你可以怎麼提供資訊</h2>
          </div>
          <ul className="cc-bullets">
            <li>付款成功但權益未更新：請提供付款時間、金額與帳號 Email。</li>
            <li>重複扣款：請提供兩筆以上付款紀錄或金額資訊。</li>
            <li>取消續訂：請提供帳號 Email 與希望停止續訂的方案名稱。</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
