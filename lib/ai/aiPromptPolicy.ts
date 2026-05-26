import type { ModelArkMessage } from "@/lib/ai/modelArkClient";

export type RoomPromptContext = {
  title: string;
  roomCategory?: string | null;
  interactionStyle?: string | null;
  durationMinutes?: number | null;
  mode?: string | null;
};

export type PersonalRoomIntent = "start" | "stuck" | "wrapup" | "general";
export type SharedHostAction = "OPENING" | "HELP_NEXT_STEP" | "WRAP_UP" | "EXTENSION_CHECK";

const ROOM_CATEGORY_LABELS: Record<string, string> = {
  focus: "專注任務",
  life: "生活陪伴",
  share: "主題分享",
  hobby: "興趣同好",
};

const INTERACTION_STYLE_LABELS: Record<string, string> = {
  silent: "安靜同行",
  "light-chat": "輕聊天",
  guided: "房主引導",
  "open-share": "開放分享",
};

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function clampUserText(input: string, maxChars = 900): string {
  return normalizeWhitespace(input).slice(0, maxChars);
}

export function clampAssistantText(input: string, maxChars = 900): string {
  return input.trim().slice(0, maxChars);
}

export function describeRoomContext(room: RoomPromptContext): string {
  const category = room.roomCategory ? ROOM_CATEGORY_LABELS[room.roomCategory] ?? room.roomCategory : "未指定";
  const interaction = room.interactionStyle
    ? INTERACTION_STYLE_LABELS[room.interactionStyle] ?? room.interactionStyle
    : "未指定";

  return [
    `房間名稱：${room.title || "同行房間"}`,
    `房型：${room.mode === "pair" ? "雙人" : "小組"}`,
    `分類：${category}`,
    `互動風格：${interaction}`,
    `時間：${Number(room.durationMinutes || 25)} 分鐘`,
  ].join("\n");
}

function baseSafetySystemPrompt() {
  return [
    "你是安感島 Calm&Co 的 AI Companion。",
    "你的角色是低壓力陪伴與房內節奏輔助，不是心理治療師、醫師、律師、投資顧問或成人陪聊。",
    "使用繁體中文回覆。語氣溫和、簡短、清楚，不要過度熱情，不要情緒勒索，不要假裝真人。",
    "不要提供醫療診斷、法律結論、投資建議、色情曖昧交易、賭博、詐騙、灰產導流或危險行為指示。",
    "不要要求使用者揭露敏感個資。不要聲稱你能看到鏡頭、聽到現場或知道房內所有人的私人狀態。",
    "如果使用者提到自傷或立即危險，請溫和建議立刻聯絡當地緊急服務或可信任的人。",
  ].join("\n");
}

export function buildPersonalRoomMessages(params: {
  room: RoomPromptContext;
  message: string;
  intent: PersonalRoomIntent;
}): ModelArkMessage[] {
  const roomContext = describeRoomContext(params.room);
  const intentInstruction: Record<PersonalRoomIntent, string> = {
    start: "使用者正在開始一段同行。請給一個很小、可立即執行的第一步。",
    stuck: "使用者卡住了。請幫他把問題切成一個下一步，不要說教。",
    wrapup: "使用者接近結束。請幫他做簡短收尾，包含已完成、下一步、休息提醒。",
    general: "請以低壓力陪伴方式回應，保持簡短可行。",
  };

  return [
    {
      role: "system",
      content: [
        baseSafetySystemPrompt(),
        "這是 Personal Room AI，只能回應單一使用者的當下求助。",
        "不要替整個房間下指令，不要假裝代表房主。",
        "輸出 2 到 5 句，必要時用短條列。不要輸出 Markdown 標題。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [`房間情境：\n${roomContext}`, `使用者意圖：${params.intent}`, intentInstruction[params.intent], `使用者訊息：${params.message}`].join("\n\n"),
    },
  ];
}

export function buildSharedHostMessages(params: {
  room: RoomPromptContext;
  action: SharedHostAction;
}): ModelArkMessage[] {
  const roomContext = describeRoomContext(params.room);
  const actionInstruction: Record<SharedHostAction, string> = {
    OPENING: "產生一段房間開場主持詞，幫大家知道現在可以怎麼開始。",
    HELP_NEXT_STEP: "產生一段中途協助詞，幫房內成員回到下一個小步驟。",
    WRAP_UP: "產生一段收尾主持詞，協助整理完成事項與下一步。",
    EXTENSION_CHECK: "產生一段續場確認詞，提醒是否需要延長，不要催促付費。",
  };

  return [
    {
      role: "system",
      content: [
        baseSafetySystemPrompt(),
        "這是 Shared Host AI。你是房間級主持輔助，只能做節奏提醒、低壓力引導與安全邊界提醒。",
        "不要點名任何人，不要假裝知道誰正在做什麼，不要使用私人資料。",
        "輸出可直接貼給房內所有人的主持詞。長度 3 到 6 句。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [`房間情境：\n${roomContext}`, `主持動作：${params.action}`, actionInstruction[params.action]].join("\n\n"),
    },
  ];
}
