# 安感島 / Calm&Co Web Platform

安感島（Calm&Co）是一個仍在開發中的 **coworking / focus platform**。  
目前目標是提供：

- 線上共工房間（Rooms）
- 25 / 50 分鐘時間盒專注流程
- 使用者帳號系統
- 免費額度與 VIP 權益
- 後續的身份綁定、反濫用與內容安全底座

目前專案處於 **pre-launch / early build stage**，不是行銷簡訊工具，也不是 bulk messaging 平台。

## 產品定位

這個專案不是把專注做成吵鬧競賽，而是提供一個：

- 安靜
- 低壓力
- 可預期
- 可久待

的數位空間。

使用者可以：
- 進入 Rooms 做短時間專注
- 查看方案 / 額度
- 聯繫客服
- 閱讀公開政策頁與服務交付資訊

## SMS / Phone Verification 用途說明

本專案未來若使用 SMS，**用途僅限於：**

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

## Public Links

- Website: https://getcalmandco.com
- Repository: https://github.com/noplzy/cowork-web

## 目前公開頁面

網站目前以公開透明為原則，包含以下資訊頁：

- 首頁
- About / 關於安感島
- Contact / 客服與聯絡
- Pricing / 方案與價格
- Privacy Policy / 隱私權政策
- Terms of Service / 服務條款
- Service Delivery / 服務交付說明
- Refund / Cancellation Policy / 退款與取消政策

## Tech Stack

- **Frontend:** Next.js (App Router) + React
- **Auth / DB:** Supabase
- **Realtime Video:** Daily
- **Hosting / Deploy:** Vercel
- **Styling:** project-local UI system / global styles

## Current Status

目前已完成或正在進行中的方向：

- Rooms 基本流程
- 帳號登入 / 註冊
- 免費額度與 VIP 權益邏輯
- 客服 / 政策頁
- M5.5 身份綁定與 anti-abuse 底座
- Daily token 安全補強
- 公開信任頁補強

目前仍在持續調整中的方向：

- 手機驗證供應商整合
- 更完整的身份綁定策略
- 風控與封鎖鏈
- AI 導師後續規劃
- 上線前文案與流程收斂

## Local Development

先安裝依賴：

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

## Important Notes for Testing

如果目前 SMS provider / Twilio 尚未完成審核，  
請確認測試環境不要被手機驗證硬性阻擋。

建議測試時使用：

```env
REQUIRE_PHONE_VERIFICATION=false
```

等 provider 審核與驗證流程穩定後，再切回：

```env
REQUIRE_PHONE_VERIFICATION=true
```

## Product Guardrails

這個專案的產品決策原則是：

- 工程正確不等於產品正確
- 不把工程格式直接丟給終端使用者
- 系統能自動吸收的複雜度，就不要交給使用者承擔
- 前台輸入與文案應遵守目標市場習慣
- 驗證、付款、風控、配額、AI 等流程都應優先做產品轉譯

例如：
- 台灣使用者前台輸入手機時，應支援 `09xxxxxxxx`
- 系統內部再自動轉成 `+8869xxxxxxxx`
- 不應要求一般使用者理解 E.164、provider error、token 術語

## Support / Contact

- Email: noccs75@gmail.com
- Phone: 0968730221

## Disclaimer

本專案目前仍在建置中。  
公開頁面、權益邏輯、身份綁定與風控流程會持續調整，但用途與方向以合法、透明、可驗證為原則。
