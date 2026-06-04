# 安感島 v108｜Host Credit / AI Usage Ledger / ECPAY Automation

## 本輪完成

1. Host Credit schema
2. AI Shared Host usage ledger
3. Room sponsor pass gate
4. ECPAY invoice task queue
5. ECPAY refund task queue
6. ECPAY recurring subscription profile / callback
7. Account Host Credit page

## 重要邊界

這版把自動化資料流與 gate 做好，但不應在沒有綠界商店功能開通與正式 API 文件確認前，直接把「自動扣款 / 自動退款 / 自動開發票」對外宣稱為已正式營運。

### 自動扣款

已實作：

- `subscription_profiles`
- `subscription_events`
- `/api/payments/ecpay/recurring/checkout`
- `/api/payments/ecpay/recurring/notify`

需要：

```env
ECPAY_RECURRING_ENABLED=true
ECPAY_RECURRING_ALLOW_NEXT_SPEC=true
```

並且綠界商店需開通信用卡定期定額 / 自動扣款服務。

### 電子發票

已實作：

- `ecpay_invoice_tasks`
- `/api/internal/billing/process-invoices`
- `/api/internal/billing/automation`

若要 live call provider，需要：

```env
ECPAY_INVOICE_API_ENABLED=true
ECPAY_INVOICE_ENDPOINT=<你的正式電子發票 adapter endpoint>
```

若未設定，task 會標記 `manual_required`，不會假裝已開立。

### 退款

已實作：

- `ecpay_refund_tasks`
- `/api/internal/billing/process-refunds`
- `/api/internal/billing/automation`

若要 live call provider，需要：

```env
ECPAY_REFUND_API_ENABLED=true
ECPAY_REFUND_ENDPOINT=<你的正式退款 adapter endpoint>
```

若未設定，task 會標記 `manual_required`。

## 套用順序

1. 跑 SQL migration：

```txt
supabase/migrations/20260604100000_ai_host_credit_billing_automation.sql
```

2. 覆蓋 / 新增壓縮檔內的檔案。
3. Deploy。

## 測試

Host Credit：

```powershell
$token = "登入後 Supabase access_token"
$headers = @{ "Authorization" = "Bearer $token" }
Invoke-RestMethod -Uri "https://getcalmandco.com/api/ai/host-credit/status" -Method Get -Headers $headers
```

Billing automation：

```powershell
$secret = "BILLING_AUTOMATION_SECRET 或 ROOM_CLEANUP_SECRET"
$headers = @{ "x-cron-secret" = $secret }
Invoke-RestMethod -Uri "https://getcalmandco.com/api/internal/billing/automation" -Method Post -Headers $headers
```
