# app/rooms/[roomId]/page.tsx 更新說明

本輪不重寫 Daily 主通話頁，只把 AI Companion 面板掛到房內右側 aside。
請在最新 `app/rooms/[roomId]/page.tsx` 套用下面兩個精準修改。

## 1. 新增 import

在這段 import 後面：

```ts
import {
  RoomVideoEffectsPanel,
  type FullBlurQuality,
} from "@/components/rooms/RoomVideoEffectsPanel";
```

新增：

```ts
import { AiCompanionPanel } from "@/components/ai/AiCompanionPanel";
```

## 2. 插入 AI 面板

在 `<RoomVideoEffectsPanel ... />` 結束後、`<section className="i20-panel">` Presence 區塊之前，插入：

```tsx
          <AiCompanionPanel
            roomId={roomId || ""}
            accessToken={accessToken}
            dailyReady={dailyReady}
            roomTitle={room?.title || "同行房間"}
            isMember={isMember}
          />
```

## 3. 不要修改的部分

- 不要改 `RoomCallStage`
- 不要改 Daily join / leave / participants / tracks flow
- 不要改 `RoomVideoEffectsPanel`
- 不要改 Daily meeting token 扣場邏輯

## 4. 驗證

```bash
npm run lint
npm run build
```

部署後：

1. 登入。
2. 進入任一房間。
3. 確認 Daily 視訊仍正常。
4. 右側看到「房內 AI 陪伴」。
5. 測「房內救援」→ DB `ai_usage_events` 應增加。
6. 測「共享主持」→ DB `ai_room_host_sessions` 與 `ai_usage_events` 應增加。
7. 測「語音播放」→ 若 SeedTTS 回傳音訊，瀏覽器本機應播放。
