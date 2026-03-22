// types/daily-events.d.ts
// 目的：補齊 @daily-co/daily-js 在某些版本 typings 未包含的事件名稱，避免 TS 報錯。
// 不影響 runtime；只影響 TypeScript 編譯/IDE 型別檢查。

declare module "@daily-co/daily-js" {
  // daily-js 的 call object 通常是 DailyCall。若你的版本名稱不同，這個 augmentation 可能不會生效；
  // 仍可改用方案 A（event name cast as any）。
  interface DailyCall {
    on(event: "video-processor-warning", callback: (ev: any) => void): any;
    on(event: "video-processor-error", callback: (ev: any) => void): any;
  }
}
