import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { createAppStorage } from "../storage/appStorage";
import type { Funnel, MessageEntry, Settings, SubscriberProfile } from "../types";

const MISSING_COLUMN_ERROR = {
  code: "PGRST204",
  message: "Could not find the column in the schema cache",
};

// База отвечает ошибкой на любой запрос с колонками, которых в ней ещё нет,
// — сколько бы параллельных запросов ни пришло.
const errorOnOptionalSettingsColumns = (payload: any) => (
  "deepseek_api_key" in payload || "admin_telegram_chat_id" in payload || "xai_api_key" in payload
    ? { error: MISSING_COLUMN_ERROR }
    : { error: null }
);

const errorOnOptionalSubscriberColumns = (payload: any) => (
  "bot_states" in payload || "bot_blocked_at" in payload
    ? { error: MISSING_COLUMN_ERROR }
    : { error: null }
);

function createStorageHarness(upsertResult: (payload: any, call: number) => { error: any }) {
  const upserts: Array<{ table: string; payload: any }> = [];
  const globalSubscribers = new Map<number, SubscriberProfile>();

  const supabase = {
    from: (table: string) => ({
      upsert: async (payload: any) => {
        upserts.push({ table, payload });
        return upsertResult(payload, upserts.length);
      },
    }),
  } as any;

  const defaultSettings: Settings = {
    bots: [],
    geminiApiKey: "",
    appUrl: "https://example.com",
    notifications: true,
    autoReminders: true,
  };

  const tmp = path.join(os.tmpdir(), `appstorage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const storage = createAppStorage({
    activeFunnels: new Map<string, Funnel>(),
    defaultSettings,
    files: {
      funnels: `${tmp}-funnels.json`,
      messages: `${tmp}-messages.json`,
      orders: `${tmp}-orders.json`,
      progress: `${tmp}-progress.json`,
      settings: `${tmp}-settings.json`,
      subscribers: `${tmp}-subscribers.json`,
      tgCache: `${tmp}-tg-cache.json`,
    },
    getSupabase: () => supabase,
    getUseSupabase: () => true,
    isProduction: true,
    globalSubscribers,
    loadOrdersFromSupabase: async () => 0,
    loadOrdersSnapshot: () => 0,
    loadProgressFromSupabase: async () => 0,
    loadProgressSnapshot: () => 0,
    messageHistory: new Map<string, MessageEntry[]>(),
    ordersCount: () => 0,
    progressStateRowId: "__progress__",
    setUseSupabase: () => undefined,
  });

  return { storage, upserts, globalSubscribers };
}

const profile: SubscriberProfile = {
  id: 42,
  firstName: "Нурлан",
  lastActive: new Date().toISOString(),
  botBlockedAt: new Date().toISOString(),
  awaitingHumanReply: new Date().toISOString(),
};

describe("settings persistence", () => {
  it("сохраняет остальные настройки, когда колонки для ключа ассистента ещё нет", async () => {
    const harness = createStorageHarness((_payload, call) => (
      call === 1 ? { error: MISSING_COLUMN_ERROR } : { error: null }
    ));

    await expect(harness.storage.saveSettings()).resolves.toBeUndefined();

    expect(harness.upserts).toHaveLength(2);
    expect(harness.upserts[0].payload).toHaveProperty("deepseek_api_key");
    expect(harness.upserts[1].payload).not.toHaveProperty("deepseek_api_key");
    expect(harness.upserts[1].payload).toMatchObject({ id: "main" });
  });

  it("не роняет параллельные сохранения, когда колонки ещё нет", async () => {
    // Два бота стартуют одновременно и оба сохраняют настройки. Раньше первый
    // успевал погасить общий флаг, второй уходил без повтора и падал с ошибкой
    // о колонке, которой он больше не отправлял.
    const harness = createStorageHarness(errorOnOptionalSettingsColumns);

    await expect(Promise.all([
      harness.storage.saveSettings(),
      harness.storage.saveSettings(),
    ])).resolves.toEqual([undefined, undefined]);

    // Каждый вызов повторился без необязательных колонок и дошёл до базы.
    const succeeded = harness.upserts.filter((item) => !("admin_telegram_chat_id" in item.payload));
    expect(succeeded).toHaveLength(2);
  });
});

describe("subscriber persistence", () => {
  it("сохраняет пометки, когда колонки в базе есть", async () => {
    const harness = createStorageHarness(() => ({ error: null }));

    await harness.storage.saveSubscriber(profile);

    expect(harness.upserts).toHaveLength(1);
    expect(harness.upserts[0].payload).toMatchObject({
      bot_blocked_at: profile.botBlockedAt,
      awaiting_human_reply: profile.awaitingHumanReply,
    });
  });

  it("не роняет регистрацию подписчика, когда миграция ещё не применена", async () => {
    // Первый запрос уходит с новыми колонками и получает PGRST204.
    const harness = createStorageHarness((_payload, call) => (
      call === 1 ? { error: MISSING_COLUMN_ERROR } : { error: null }
    ));

    await expect(harness.storage.saveSubscriber(profile)).resolves.toBeUndefined();

    expect(harness.upserts).toHaveLength(2);
    expect(harness.upserts[1].payload).not.toHaveProperty("awaiting_human_reply");
    expect(harness.upserts[1].payload).not.toHaveProperty("bot_blocked_at");
    expect(harness.upserts[1].payload).toMatchObject({ id: 42, first_name: "Нурлан" });
    // В памяти пометки остаются: оператор увидит их до перезапуска.
    expect(harness.globalSubscribers.get(42)?.awaitingHumanReply).toBeTruthy();
  });

  it("перестаёт слать несуществующие колонки после первой неудачи", async () => {
    const harness = createStorageHarness((_payload, call) => (
      call === 1 ? { error: MISSING_COLUMN_ERROR } : { error: null }
    ));

    await harness.storage.saveSubscriber(profile);
    await harness.storage.saveSubscriber({ ...profile, id: 43 });

    expect(harness.upserts).toHaveLength(3);
    expect(harness.upserts[2].payload).not.toHaveProperty("awaiting_human_reply");
  });

  it("не роняет параллельную регистрацию подписчиков без миграции", async () => {
    const harness = createStorageHarness(errorOnOptionalSubscriberColumns);

    await expect(Promise.all([
      harness.storage.saveSubscriber(profile),
      harness.storage.saveSubscriber({ ...profile, id: 43 }),
    ])).resolves.toEqual([undefined, undefined]);

    expect(harness.globalSubscribers.get(42)).toBeTruthy();
    expect(harness.globalSubscribers.get(43)).toBeTruthy();
  });

  it("не проглатывает другие ошибки Supabase", async () => {
    const harness = createStorageHarness(() => ({ error: { code: "42501", message: "permission denied" } }));

    await expect(harness.storage.saveSubscriber(profile)).rejects.toThrow("Supabase subscriber save failed");
    expect(harness.upserts).toHaveLength(1);
  });
});

// Запрос к Supabase собирается цепочкой: select().order().limit(). Мок повторяет
// её ровно настолько, чтобы дать loadInitialData дочитать до сообщений.
function createLoadHarness(messageRows: any[]) {
  const messageQueries: Array<{ ascending: boolean; limit: number }> = [];
  const messageHistory = new Map<string, MessageEntry[]>();

  const supabase = {
    from: (table: string) => ({
      select: () => {
        // Пустой ответ, который можно и сразу дождаться, и продолжить цепочкой.
        const empty: any = {
          eq: () => ({ single: async () => ({ data: null, error: null }) }),
          order: () => empty,
          range: async () => ({ data: [], error: null }),
          limit: async () => ({ data: [], error: null }),
          then: (resolve: (value: any) => void) => resolve({ data: [], error: null }),
        };
        if (table !== "messages") return empty;

        let ascending = false;
        const query: any = {
          ...empty,
          order: (column: string, options?: { ascending: boolean }) => {
            if (column === "created_at") ascending = options?.ascending ?? true;
            return query;
          },
          range: async (from: number, to: number) => {
            messageQueries.push({ ascending, limit: to - from + 1 });
            const ordered = [...messageRows].sort((a, b) => ascending
              ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
            return { data: ordered.slice(from, to + 1), error: null };
          },
        };
        return query;
      },
    }),
  } as any;

  const tmp = path.join(os.tmpdir(), `appstorage-load-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const storage = createAppStorage({
    activeFunnels: new Map<string, Funnel>(),
    defaultSettings: {
      bots: [],
      geminiApiKey: "",
      appUrl: "https://example.com",
      notifications: true,
      autoReminders: true,
    },
    files: {
      funnels: `${tmp}-funnels.json`,
      messages: `${tmp}-messages.json`,
      orders: `${tmp}-orders.json`,
      progress: `${tmp}-progress.json`,
      settings: `${tmp}-settings.json`,
      subscribers: `${tmp}-subscribers.json`,
      tgCache: `${tmp}-tg-cache.json`,
    },
    getSupabase: () => supabase,
    getUseSupabase: () => true,
    isProduction: true,
    globalSubscribers: new Map<number, SubscriberProfile>(),
    loadOrdersFromSupabase: async () => 0,
    loadOrdersSnapshot: () => 0,
    loadProgressFromSupabase: async () => 0,
    loadProgressSnapshot: () => 0,
    messageHistory,
    ordersCount: () => 0,
    progressStateRowId: "__progress__",
    setUseSupabase: () => undefined,
  });

  return { storage, messageHistory, messageQueries };
}

function messageRow(index: number, chatId = 42) {
  return {
    id: `m${index}`,
    chat_id: chatId,
    sender: index % 2 === 0 ? "bot" : "user",
    text: `сообщение ${index}`,
    // Чем больше index, тем свежее сообщение — минута за минутой.
    created_at: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  };
}

describe("appStorage: загрузка переписки", () => {
  it("поднимает самые свежие сообщения, а не самые старые", async () => {
    // Больше, чем помещается в лимит на чат: важно, какой конец истории выживет.
    const rows = Array.from({ length: 260 }, (_value, index) => messageRow(index));
    const harness = createLoadHarness(rows);

    await harness.storage.loadInitialData();

    expect(harness.messageQueries).toEqual([{ ascending: false, limit: 500 }, { ascending: false, limit: 500 }]);

    const history = harness.messageHistory.get("42") || [];
    expect(history).toHaveLength(200);
    // Хвост переписки, и в правильном порядке: от старых к новым.
    expect(history[0].text).toBe("сообщение 60");
    expect(history[history.length - 1].text).toBe("сообщение 259");
  });
});
