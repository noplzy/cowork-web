# 安感島 / Calm&Co Web Platform

安感島（Calm&Co）不是單純的 coworking / focus tool。  
它更準確的定位是：

**一個以低壓力陪伴、同行與可理解的場景為核心的數位平台。**

目前最成熟的產品主線是：
- **Rooms / 同行空間**：即時進房、排程、邀請碼、短時間同行
- **Buddies / 安感夥伴**：陪伴服務、上架、預約與後續交易骨架

這代表：
- **安感島是品牌母體**
- **Rooms 是目前最成熟的主線產品**
- **Buddies 是第二條正在成形的服務模組**

目前專案處於 **pre-launch / early product stage**，不是 bulk messaging 平台，也不是灰色陪聊產品。

---

## 產品定位

安感島想解決的不是「怎麼把人留在網站上」，而是：

- 不想一個人開始時，有地方可以進去
- 想要有人一起時，不需要承受高社交壓力
- 想先用最簡單的方式理解平台，而不是先讀一堆規則

核心原則：
- 低壓力
- 有邊界
- 有規則
- 先把主線做穩
- 不用低俗流量來換成長

---

## 目前網站的主要入口

- `/`：首頁，讓使用者快速理解下一步
- `/rooms`：同行空間主線，承接即時房與排程
- `/buddies`：安感夥伴，承接服務列表、我的服務、我的預約
- `/pricing`：方案與價格
- `/contact`：客服與聯絡
- `/account`：帳號中心
- `/friends`：好友骨架
- `/u/[handle]`：公開個人檔案

---

## 當前功能狀態

### 已有主線
- 登入 / 註冊 / Google OAuth / callback
- Rooms 列表、進房、邀請碼流程
- Daily private room + token gate
- 免費額度與 VIP 規則
- Pricing / Contact / Privacy / Terms / Refund Policy / Service Delivery
- 公開 profile / account / friends / identity 基礎骨架

### 正在成形
- Buddies 正式頁面骨架
- 服務上架 / 我的服務 / 我的預約
- 預約狀態流
- 更成熟的 UI / UX 收斂
- 身份綁定 / anti-abuse / content safety

### 已定方向但尚未正式 merge 主線
- AI Companion
  - Global AI
  - Personal Room AI
  - Shared Host AI
  - 全站右下角單一入口 + 房內 Room Mode

---

## SMS / Phone Verification 用途說明

未來若使用 SMS，**用途僅限於：**
- 手機號碼驗證
- 帳號綁定
- 反濫用保護
- 基本帳號安全流程

**不會用於：**
- spam
- bulk unsolicited messaging
- gambling
- adult content
- deceptive activity
- mass marketing blasts

目前手機驗證流程仍在整合階段；在 Twilio / provider 審核完成前，整站測試不會被手機驗證硬性阻擋。

---

## Public Links

- Website: https://getcalmandco.com
- Repository: https://github.com/noplzy/cowork-web

---

## Tech Stack

- **Frontend:** Next.js (App Router) + React
- **Auth / DB:** Supabase
- **Realtime Video:** Daily
- **Payments:** ECPAY
- **Hosting / Deploy:** Vercel
- **Styling:** project-local UI system / global styles

---

## Local Development

安裝依賴：

```bash
npm install
```

啟動開發環境：

```bash
npm run dev
```

Production build：

```bash
npm run build
npm run start
```

---

## Important Notes for Testing

如果 SMS provider / Twilio 尚未完成審核，  
請確認測試環境不要被手機驗證硬性阻擋。

建議測試時使用：

```env
REQUIRE_PHONE_VERIFICATION=false
```

等 provider 審核與驗證流程穩定後，再切回：

```env
REQUIRE_PHONE_VERIFICATION=true
```

---

## Product Guardrails

這個專案的產品決策原則是：

- 工程正確不等於產品正確
- 不把工程格式直接丟給終端使用者
- 系統能吸收的複雜度，就不要交給使用者承擔
- 首頁、Rooms、Buddies、Pricing 都應先讓人一眼看懂下一步
- 驗證、付款、風控、配額、AI 等流程都應優先做產品轉譯

例如：
- 台灣使用者前台輸入手機時，應支援 `09xxxxxxxx`
- 系統內部再轉成 `+8869xxxxxxxx`
- 不應要求一般使用者理解 E.164、provider error、token 術語

---

## Support / Contact

- Email: noccs75@gmail.com
- Phone: 0968730221

---

## Disclaimer

本專案目前仍在建置與收斂中。  
公開頁面、權益邏輯、身份綁定、Buddies 與 AI Companion 會持續調整，但方向以合法、透明、可驗證、低壓力為原則。
