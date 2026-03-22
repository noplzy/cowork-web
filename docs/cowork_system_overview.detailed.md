# Cowork（共工）Rooms 系統總覽（詳細版 v2）

日期：2026-03-11（Asia/Taipei）  
策略：**Prebuilt + Web 最佳化**（MVP 不做 OffscreenCanvas / WebGL）

> 你說得對：舊版 overview 的價值在於「把架構對應到實際檔案路徑」。  
> 這份 v2 是「保留舊版詳細度」＋「加入你最近回饋與現況（桌機穩、手機噴錯、full-blur 遠端不可見）」＋「補齊 repo 實際檔案地圖」。

---

## 0) 先講結論（你現在最需要的決策）

1) **最快、最低風險的 MVP：行動裝置先關掉所有模糊相關功能**  
   - 包含：背景模糊、虛擬背景、全畫面模糊  
   - 原因：你已驗證「桌機正常」「手機噴多個 error」；為了 blur 開 iOS/Android 戰場會拖慢里程碑。

2) **桌機可以保留背景模糊 / 虛擬背景（Daily processor）**  
   - 這兩個你已驗證有效。

3) **全畫面模糊（Canvas 全張 blur）目前要視為「實驗功能」**  
   - 你已驗證：右上角預覽（canvas output）能糊  
   - 但遠端看到的影像仍可能不糊（Prebuilt + wrap 對「自訂 video track 作為 outgoing」在某些組合下不穩）  
   - **MVP：不要把 full-blur 當成必備成功條件**；先以「可用通話＋付費閉環」推進。

4) 你正在等 **ezPay 金流審核**：里程碑優先順序應該是  
   - 先穩定通話（mobile disable effects）→ 再做付費閉環（webhook → entitlements）→ 再回頭打磨特效。

---

## 1) 技術堆疊與角色分工

- 前端/全端：Next.js App Router（`app/**`）
- BFF（server route handlers）：`app/api/**/route.ts`
- DB/Auth：Supabase（Postgres + RLS + SQL function）
- 視訊：Daily Prebuilt + Private rooms + meeting token（server 簽發）
- 金流：ezPay（申請中）

---

## 2) Repo（cowork-web）檔案地圖（以你這次 zip 為準）

> 注意：你上傳的 zip **缺少 repo 根目錄的 package.json**（只看到 `.next/dev/package.json` 和 `node_modules/**/package.json`）。  
> 這不影響我做「檔案地圖」與架構對照，但若要讓 Copilot/CI 做自動化，根 package.json 最好補齊。

### 2.1 app/（頁面）
- `app/account/page.tsx`
- `app/api/account/status/route.ts`
- `app/api/daily/create-room/route.ts`
- `app/api/daily/create-room/route.ts.bak_20260203_015056`
- `app/api/daily/meeting-token/route.ts`
- `app/auth/login/page.tsx`
- `app/buddies/page.tsx`
- `app/favicon.ico`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/rooms/[roomId]/page.tsx`
- `app/rooms/page.tsx`

### 2.2 lib/（Supabase clients）
- `lib/supabaseAdmin.ts`
- `lib/supabaseClient.ts`

---

## 3) 核心流程（用「程式碼位置」對照）

### 3.1 登入 / Auth
- 頁面：`app/auth/login/page.tsx`
- Supabase client：`lib/supabaseClient.ts`（用 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
- 前端只拿 anon key；權限靠 RLS 擋。

### 3.2 Rooms 列表
- `app/rooms/page.tsx`
  - 讀 `public.rooms`（通常用 `supabase.from("rooms")...`）
  - 會顯示房型 pair/group、人數上限等

### 3.3 進房（Room page）→ 先授權/扣場 → 拿 Daily token → 開 Prebuilt
- `app/rooms/[roomId]/page.tsx`
  - 前端進房流程大方向：
    1) 取得使用者登入狀態（Supabase session）
    2) 確認你是 member / 或加入房間（寫入 `room_members`）
    3) 呼叫 server API：`POST /api/daily/meeting-token`
    4) 拿到 meeting token 後，載入 Daily Prebuilt iframe

### 3.4 取得帳號狀態（plan/credits）
- `GET /api/account/status`：`app/api/account/status/route.ts`
  - 回傳：plan、當期剩餘、已用等
  - **已知一致性 bug（見下節 6.1）**

### 3.5 Daily：建立房間 / 簽發 token
- 建房（idempotent）：`POST /api/daily/create-room` → `app/api/daily/create-room/route.ts`
  - Daily REST: `POST /rooms`，若 409 則改 GET 既有 room
  - 重要 room config（你 zip 版本）：
    - `privacy: "private"`
    - `max_participants: 6`
    - `enable_video_processing_ui: true`（背景模糊/虛擬背景 UI）
    - `start_audio_off: true`（避免 No Mic 觸發 NotFoundError）
    - `enable_screenshare: true`, `enable_knocking: false`

- Token：`POST /api/daily/meeting-token` → `app/api/daily/meeting-token/route.ts`
  - 在 server 端用 **service role** 查 Supabase、做扣場/規則後才簽 token
  - token 短效、每次 join/續場都重新拿（避免 tokenized URL 被重用）

---

## 4) Supabase（資料表 / RLS / function）— 規則落地的真正核心

> 你說「Supabase 沒變更」：OK，這裡只把你現有結構與前端/route 對照整理起來，避免未來改壞。

### 4.1 資料表（你已列出且已用到）
- `public.rooms`
- `public.room_members`
- `public.user_entitlements`（`plan: free|vip`）
- `public.cowork_monthly_usage`（每月扣場/使用）

### 4.2 原子扣場 function（競態閉環）
- `cowork_try_consume_credits(...)`
  - 用來做「檢查 + 扣點」的原子操作
  - 重點：任何扣點都應走這個 function，而不是前端自己算

---

## 5) 產品規則（你定案的）→ 對應到程式碼位置

### 5.1 房型 / 時長
- 房型：pair / group（group max 6）
- 時長：25m / 50m

落點：
- Token 發放前的扣點計算：`app/api/daily/meeting-token/route.ts` 的 `creditCostByDuration()`

### 5.2 免費額度（每月重置）
- 每月 4 場
- 25m=1、50m=2
- pair/group 同規則

落點：
- `app/api/daily/meeting-token/route.ts`：取 month start、查 usage、呼叫扣場 function

### 5.3 VIP（單一方案）
- 只保留一種 VIP（暫定月費 299；實際付款串接在 M4B）
- VIP 可續場／規則：以 `meeting-token` route 的 guard 為準

落點：
- `app/api/daily/meeting-token/route.ts`：VIP 判斷與續場護欄

---

## 6) 已知問題（務實版，會影響上線）

### 6.1 「每月」vs「每週」一致性 bug（你 zip 裡仍然存在）
- `app/api/daily/meeting-token/route.ts`：週期起點是「每月 1 號」✅
- 但 `app/api/account/status/route.ts`：函數名叫 `getMonthStart...`，實作卻是「週一」❌  
  → 結果：UI 顯示的剩餘/使用週期可能跟 token 扣場週期不一致，會讓你以為扣場壞掉。

修正建議：
- 把 `account/status` 的週期起點改成「每月 1 號」並與 meeting-token 共用同一個 helper（或抽到 `lib/time.ts`）。

### 6.2 行動裝置報錯（你已驗證）
- 背景處理器（video processors）在手機端常見不支援或不穩：  
  最務實做法就是 **MVP 先禁用所有 effects**（含 blur/image/full-blur）。

### 6.3 全畫面模糊（full-blur）遠端不可見
- 若你看到：右上角預覽糊、遠端不糊  
  → 代表 canvas pipeline OK，但 Prebuilt + wrap 沒把你提供的 track 當 outgoing input。  
  MVP：先把它當「桌機實驗功能（可關）」；不要卡住里程碑。

---

## 7) 安全與風控（你已確認的結論，寫死避免走回頭路）
- private room：沒 token 進不去（無法靠猜 URL）
- 風險：拿到 tokenized URL 仍可在 token 有效期內進房（繞過你扣場/VIP）
- 正確做法（維持）：
  - token 短效（1–5 分鐘）
  - 每次 join 都 server 簽發
  - token 綁 user / exp
  - 前端不保存 token URL

落點：
- `app/api/daily/meeting-token/route.ts`（server gate）
- `app/rooms/[roomId]/page.tsx`（前端只拿短效 token，不保存）

---

## 8) 環境變數（你部署/本地必備）

### 前端（NEXT_PUBLIC_*）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Server-only（不可暴露）
- `SUPABASE_SERVICE_ROLE_KEY`（只給 `lib/supabaseAdmin.ts` 用）
- `DAILY_API_KEY`
- `DAILY_API_BASE`（預設 `https://api.daily.co/v1`）

---

## 9) 建議的里程碑 1~5（你要開始推進）
> 建議把里程碑文件放 repo：`docs/MILESTONES.md`，讓 Copilot/Agent 有「驗收點」不亂改。

- M1：跨裝置穩定（mobile disable effects、桌機保留背景模糊/虛擬背景）
- M2：Rooms/Account UI 產品化（互動回饋一致、loading/toast）
- M3：扣場/續場閉環穩定（你已有，但修 6.1 bug）
- M4B：ezPay 付費閉環（webhook → entitlements → 前端立即生效）
- M5：風控頁面/條款/客服流程（提高 PSP 過審）

---

## 10) 速查：功能 → 程式碼位置對照表

| 功能 | 檔案/路徑 | 備註 |
|---|---|---|
| 登入 | `app/auth/login/page.tsx` | Supabase client |
| Rooms 列表 | `app/rooms/page.tsx` | 讀 rooms |
| Room 視訊頁 | `app/rooms/[roomId]/page.tsx` | Daily Prebuilt iframe |
| Account 狀態 | `app/api/account/status/route.ts` | 目前週期 bug（週一） |
| 建 Daily 房 | `app/api/daily/create-room/route.ts` | privacy private / max 6 |
| 簽 meeting token | `app/api/daily/meeting-token/route.ts` | 扣場/續場 guard（每月 1 號） |
| Supabase client | `lib/supabaseClient.ts` | anon key |
| Supabase admin | `lib/supabaseAdmin.ts` | service_role（server only） |

---

## 附錄：你想用 Copilot/Agent 自動化時，最小「規格文件」建議
- `docs/cowork_system_overview.md`：規則與安全模型（本文件）
- `docs/MILESTONES.md`：里程碑與驗收點（每次只做一個 milestone）
- `docs/AGENT_PROMPTS.md`（可選）：固定 prompt 模板（避免每次重打）
