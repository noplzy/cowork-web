# Milestones（1～5）— Cowork（共工）Rooms

> 這份文件用來讓人類與 Copilot/Agent 都能用同一套「驗收點」推進專案。  
> 原則：每個 milestone 都要有 **可驗收** 的 UI/指令/條件。

---

## M1：跨裝置穩定通話（Prebuilt + Web）
**目標**
- Mobile：可加入視訊、不卡、不噴致命錯誤（Effects 全關）
- Desktop：背景模糊/虛擬背景可用

**驗收**
- Desktop（Chrome + 無痕）可同房 Join，雙方都能看到彼此、聽到聲音
- Mobile（iOS Safari / Android Chrome）可 Join 通話
- Mobile 上 Effects 控制項 disabled，且不會因 processor 相關錯誤導致頁面崩潰

---

## M2：UI 設計系統（大品牌風格但克制）
**目標**
- 統一按鈕、輸入、卡片、toast、loading
- 去除「按下縮放」等廉價動效；hover/active/focus 回饋清楚但小幅

**驗收**
- 全站按鈕互動一致（hover/active/focus）
- 所有 async 行為都有 loading/disabled，失敗有 toast

---

## M3：額度/權限閉環（已完成）
**目標**
- membership → token → RPC 扣場 → 到期 eject → UI 顯示

**驗收**
- 25m 消耗 1、50m 消耗 2
- 每月免費 4 場
- VIP 可無限續場
- Pair 可被同房 VIP carry（額度用完仍可續）

---

## M4：視訊體驗加值
### M4A：背景模糊 / 虛擬背景（桌機）
**驗收**
- Desktop join 後能套用 blur / image

### M4A-2：全畫面模糊（先實驗）
**驗收（最低）**
- 本地預覽可糊（canvas pipeline）
- 若遠端不可見，UI 必須明確標記「可能不支援」，不得讓使用者以為壞掉

---

## M5：付費閉環（EZPay）
**目標**
- 付款成功 → webhook → entitlements.plan=vip → 前端即時生效

**驗收**
- webhook 驗簽與防重放
- 本地可用 tunnel 測回呼
- VIP 生效後，下一次 join 不扣場
