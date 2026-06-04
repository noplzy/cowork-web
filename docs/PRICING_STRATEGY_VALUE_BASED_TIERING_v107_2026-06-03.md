# 安感島 Pricing v107｜Value-based Tiering / Product Catalog 規格

日期：2026-06-03  
適用：Calm&Co / 安感島 / `noplzy/cowork-web`

## 1. 核心結論

安感島正式 Pricing 不應只是「低 / 中 / 高」三層，而應使用：

```text
低價層：舒服在場
中價層：穩定建立習慣
高價層：帶朋友 / 開活動 / 主持房間
加購：高成本能力按次或按 credit 購買
```

這符合安感島的商業性質：Rooms 有 Daily / RTC 成本，AI 有 provider 成本，付款有發票與退款責任，Buddies 未來有交易與爭議責任。因此不能用「無限使用」當主要賣點。

## 2. Production fact vs Pricing v2 next-spec

### 目前 production fact

```text
VIP 月方案（試營運）
NT$199 / 30 天
一次性付款
不自動續扣
ECPAY 信用卡
user_entitlements 控制 VIP 有效期
```

### 不可宣稱

```text
已正式上線 NT$299 / NT$599 / NT$1,299
已完成 Host Credit 商業化
已完成 AI 主持包販售
已完成房主贊助全房延長
已完成 AI usage / provider cost cap
已完成電子發票完整自動開立 / 折讓
```

## 3. Pricing v2 next-spec

| 方案 | 價格 | 賣給誰 | 核心價值 | 隔離條件 |
|---|---:|---|---|---|
| Free | NT$0 | 先試感覺的人 | 公開房 / 短場體驗 | 不給高成本 AI、活動房、完整邀請制 |
| 安心同行 | NT$299 | 低壓力常用者 | 好友房、邀請制、25/50/75 一般房 | 不給大量 Host Credit、活動房 |
| 常駐同行 | NT$599 | 每週規律使用者 | Shared Host AI 有感、摘要、延長彈性 | 不給完整主持控制台、活動房主能力 |
| 主持島民 | NT$1,299 | 房主 / 活動 / 帶朋友 | 90 分鐘活動房、主持控制台、房主贊助 | 不給無成本全房無限延長 |

## 4. 價格歧視 / 分層邏輯

這裡的價格歧視不是坑使用者，而是讓不同需求與付費意願的人買到合理的不同能力。

- Free → 299：想要好友房 / 邀請制 / 更穩定進房。
- 299 → 599：想要 AI Shared Host、回顧、摘要、更多延長彈性。
- 599 → 1299：想帶朋友、開活動、房主贊助、降低主持壓力。
- 1299 → Add-on / Buddies：開始變成活動、專業服務或交易需求。

## 5. Rooms 時長

正式一般房：25 / 50 / 75。  
活動房：90。  
不主推：100。

理由：25 / 50 / 75 是清楚的心智階梯；90 有活動 / Studio / Buddies 語意；100 與延長功能重疊，且成本語意不乾淨。

## 6. Host Credit

```text
1 Host Credit = 25 分鐘 AI 主持權
```

但它不是 AI 連續講 25 分鐘。它代表 room-level Shared Host eligibility、event-driven intervention、AI active cap、usage ledger、provider cost cap。

| 房間時長 | Host Credit | AI active cap |
|---:|---:|---:|
| 25 | 1 | 2 分鐘 |
| 50 | 2 | 4 分鐘 |
| 75 | 3 | 6 分鐘 |
| 90 | 4 | 8 分鐘 |

## 7. v107 實作範圍

已做：

- `lib/productCatalog.ts` 單一商品目錄。
- `lib/billingPlans.ts` 從 Product Catalog 映射。
- `/api/product/catalog` 商品目錄 API。
- `/pricing` 前台不再誤導正式 299 / 599 / 1299 已開放。
- `PricingCheckoutButton` 讓目前可付款的 NT$199 方案能從 pricing 頁啟動 ECPAY checkout。
- `/api/payments/ecpay/checkout` 用 catalog 的 invoice item / trade description。
- `/api/rooms/create` 拒絕 100 分鐘一般房。
- `lib/socialProfile.ts` 同步房間時長 option。

未做：

- 299 / 599 / 1299 真正開放付款。
- Host Credit schema / usage ledger。
- AI Shared Host cost cap。
- 房主贊助購買流程。
- 全房延長通行證 server gate。
- 電子發票自動開立 / 折讓。

## 8. 下一步

若目標是商業化 AI 與房主贊助，下一步是：`Host Credit schema + AI usage ledger + sponsor pass gate`。  
若目標是先安全正式收 VIP，下一步是：`ECPAY Invoice / refund automation`。
