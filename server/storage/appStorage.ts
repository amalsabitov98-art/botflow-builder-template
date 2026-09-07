import type { SupabaseClient } from "@supabase/supabase-js";
import type { BotEntry, Funnel, MessageEntry, Settings, SubscriberProfile } from "../types";
import { getMessageHistoryKey } from "../services/botScope";
import { loadJSON, saveJSON } from "./jsonStore";
import { readAllRows } from "./pagination";

// Сколько последних сообщений поднимаем из базы при старте — на все чаты сразу.
const MESSAGE_HISTORY_LOAD_LIMIT = 5000;
// И сколько держим в памяти по каждому чату: панель переписки показывает хвост,
// вся история остаётся в базе.
const MESSAGE_HISTORY_PER_CHAT = 200;

interface AppStorageDeps {
  activeFunnels: Map<string, Funnel>;
  defaultSettings: Settings;
  files: {
    funnels: string;
    messages: string;
    orders: string;
    progress: string;
    settings: string;
    subscribers: string;
    tgCache: string;
  };
  getSupabase: () => SupabaseClient | null;
  getUseSupabase: () => boolean;
  isProduction: boolean;
  globalSubscribers: Map<number, SubscriberProfile>;
  loadOrdersFromSupabase: () => Promise<number>;
  loadOrdersSnapshot: (snapshot: any) => number;
  loadProgressFromSupabase: () => Promise<number>;
  loadProgressSnapshot: (snapshot: any) => number;
  messageHistory: Map<string, MessageEntry[]>;
  ordersCount: () => number;
  progressStateRowId: string;
  secretValues?: {
    deepseekApiKey?: string;
    geminiApiKey?: string;
    lavaApiKey?: string;
    lavaWebhookSecret?: string;
    telegramBotToken?: string;
  };
  setUseSupabase: (value: boolean) => void;
}

export function createAppStorage({
  activeFunnels,
  defaultSettings,
  files,
  getSupabase,
  getUseSupabase,
  isProduction,
  globalSubscribers,
  loadOrdersFromSupabase,
  loadOrdersSnapshot,
  loadProgressFromSupabase,
  loadProgressSnapshot,
  messageHistory,
  ordersCount,
  progressStateRowId,
  secretValues = {},
  setUseSupabase,
}: AppStorageDeps) {
  let settings: Settings = { ...defaultSettings, bots: [...defaultSettings.bots] };
  let tgCache = loadJSON(files.tgCache, {});
  const messageEnvelopePrefix = "__BOTFLOW_MESSAGE_V1__:";
  // Сбрасывается в false, если база ещё без колонок для пометок подписчика.
  let hasSubscriberFlagColumns = true;
  let hasMessageScopeColumns = true;
  // Сбрасывается в false, если в settings ещё нет колонки для ключа ассистента.
  let hasSettingsAssistantColumn = true;
  // Сбрасывается в false, если в settings ещё нет колонки для админского чата.
  let hasSettingsAdminChatColumn = true;
  // Сбрасывается в false, если в settings ещё нет колонки для xAI API key.
  let hasSettingsXaiColumn = true;
  let audienceRefreshPromise: Promise<void> | null = null;

  let lastAudienceRefreshAt = 0;

  // PostgREST отвечает PGRST204, когда колонки нет в схеме.
  function isMissingColumnError(error: any) {
    return error?.code === "PGRST204";
  }

  function throwOnSupabaseError(operation: string, error: any) {
    if (!error) return;
    console.error(`Supabase ${operation} failed:`, error);
    throw new Error(`Supabase ${operation} failed`);
  }

  function decodeStoredMessageText(value: unknown): Pick<MessageEntry, "text" | "media"> {
    const raw = typeof value === "string" ? value : "";
    if (!raw.startsWith(messageEnvelopePrefix)) return { text: raw };
    try {
      const parsed = JSON.parse(raw.slice(messageEnvelopePrefix.length));
      return {
        text: typeof parsed?.text === "string" ? parsed.text : "",
        media: parsed?.media && typeof parsed.media === "object" ? parsed.media : undefined,
      };
    } catch {
      return { text: raw };
    }
  }

  function encodeStoredMessageText(entry: Pick<MessageEntry, "text" | "media">) {
    if (!entry.media) return entry.text;
    return `${messageEnvelopePrefix}${JSON.stringify({ text: entry.text, media: entry.media })}`;
  }

  function getSettings() {
    return settings;
  }

  function getTgCache() {
    return tgCache;
  }

  function serializeEnvSecret(value: string | undefined, envValue: string | undefined, placeholder: string) {
    return envValue && value === envValue ? placeholder : (value || "");
  }

  function serializeSettingsForStorage(): Settings {
    return {
      ...settings,
      bots: settings.bots.map((bot) => ({
        ...bot,
        token: serializeEnvSecret(bot.token, secretValues.telegramBotToken, "__ENV_TELEGRAM_BOT_TOKEN__"),
      })),
      deepseekApiKey: serializeEnvSecret(settings.deepseekApiKey, secretValues.deepseekApiKey, "__ENV_DEEPSEEK_API_KEY__"),
      geminiApiKey: serializeEnvSecret(settings.geminiApiKey, secretValues.geminiApiKey, "__ENV_GEMINI_API_KEY__"),
      lavaApiKey: serializeEnvSecret(settings.lavaApiKey, secretValues.lavaApiKey, "__ENV_LAVA_API_KEY__"),
      lavaWebhookSecret: serializeEnvSecret(settings.lavaWebhookSecret, secretValues.lavaWebhookSecret, "__ENV_LAVA_WEBHOOK_SECRET__"),
    };
  }

  async function saveTgCache() {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      try {
        const { error } = await supabase.from("funnels").upsert({
          id: "__tg_cache__",
          data: tgCache,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        throwOnSupabaseError("tgCache save", error);
        console.log("📤 Saved tgCache to Supabase");
      } catch (e) {
        console.error("❌ Failed to save tgCache to Supabase:", e);
        throw e;
      }
    } else {
      saveJSON(files.tgCache, tgCache);
      console.log("📤 Saved tgCache to local JSON");
    }
  }

  function ensureBotsArray() {
    if (Array.isArray(settings.bots)) return;

    const oldToken = (settings as any).telegramBotToken;
    settings.bots = [];
    if (oldToken && oldToken !== "YOUR_TELEGRAM_BOT_TOKEN") {
      settings.bots.push({
        id: `bot-${Date.now()}`,
        token: oldToken,
        name: "Unknown",
        firstName: "Бот",
        active: false,
        addedAt: new Date().toISOString(),
      } satisfies BotEntry);
    }
  }

  async function loadFromSupabase() {
    const supabase = getSupabase();
    if (!supabase) return;

    console.log("📥 Loading data from Supabase...");

    const { data: settingsRow, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "main")
      .single();
    throwOnSupabaseError("settings load", settingsError);

    if (settingsRow) {
      settings.bots = settingsRow.bots || [];
      settings.geminiApiKey = settingsRow.gemini_api_key || settings.geminiApiKey;
      // APP_URL is validated before startup and is the canonical production
      // address. A freshly-created Supabase project historically contained
      // localhost here, which must never override the deployment URL.
      if (!isProduction) {
        settings.appUrl = settingsRow.app_url || settings.appUrl;
      }
      settings.notifications = settingsRow.notifications ?? true;
      settings.autoReminders = settingsRow.auto_reminders ?? true;
      settings.lavaApiKey = settingsRow.lava_api_key || "";
      settings.lavaWebhookSecret = settingsRow.lava_webhook_secret || "";
      settings.deepseekApiKey = settingsRow.deepseek_api_key || settings.deepseekApiKey;
      settings.adminTelegramChatId = settingsRow.admin_telegram_chat_id || settings.adminTelegramChatId || "";
      settings.expertTelegramUsername = settingsRow.expert_telegram_username || settings.expertTelegramUsername || "";
      settings.xaiApiKey = settingsRow.xai_api_key || settings.xaiApiKey || "";
    }

    ensureBotsArray();

    const { data: funnelRows, error: funnelsError } = await readAllRows(() => supabase.from("funnels").select("*").order("id"));
    throwOnSupabaseError("funnels load", funnelsError);
    if (funnelRows) {
      for (const row of funnelRows) {
        if (row.id === "__tg_cache__") {
          tgCache = row.data || {};
          console.log("📥 Loaded tgCache from Supabase");
          continue;
        }
        if (row.id === progressStateRowId) continue;
        if (row.id === "__broadcasts__") continue;

        const funnelData = row.data || {};
        funnelData.id = row.id;
        activeFunnels.set(row.id, funnelData);
      }
    }

    const { data: subRows, error: subscribersError } = await readAllRows(() => supabase.from("subscribers").select("*").order("id"));
    throwOnSupabaseError("subscribers load", subscribersError);
    if (subRows) {
      for (const row of subRows) {
        globalSubscribers.set(row.id, {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          username: row.username,
          languageCode: row.language_code,
          lastActive: row.last_active,
          ...(row.bot_blocked_at ? { botBlockedAt: row.bot_blocked_at } : {}),
          ...(row.awaiting_human_reply ? { awaitingHumanReply: row.awaiting_human_reply } : {}),
          ...(row.bot_states && typeof row.bot_states === "object" ? { botStates: row.bot_states } : {}),
        });
      }
    }

    // Берём САМЫЕ СВЕЖИЕ сообщения, а не самые старые. Раньше сортировка шла по
    // возрастанию, и после первых 5000 сообщений в проекте перезапуск поднимал
    // только древнюю переписку: в админке диалоги выглядели пустыми, а дожим
    // считал, что боту давно не писали, и слал касание поверх свежей рассылки.
    const { data: msgRows, error: messagesError } = await readAllRows(() => supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id"), MESSAGE_HISTORY_LOAD_LIMIT);
    throwOnSupabaseError("messages load", messagesError);

    if (msgRows) {
      // Строки пришли от новых к старым — разворачиваем, чтобы в истории чата
      // сообщения снова шли по времени.
      for (let index = msgRows.length - 1; index >= 0; index -= 1) {
        const row = msgRows[index];
        const key = row.bot_id
          ? getMessageHistoryKey(Number(row.chat_id), row.bot_id)
          : String(row.chat_id);
        const storedMessage = decodeStoredMessageText(row.text);
        if (!messageHistory.has(key)) messageHistory.set(key, []);
        const chatMessages = messageHistory.get(key)!;
        chatMessages.push({
          id: row.id,
          from: row.sender as 'bot' | 'user',
          text: storedMessage.text,
          timestamp: row.created_at,
          botId: row.bot_id || undefined,
          funnelId: row.funnel_id || undefined,
          media: storedMessage.media,
        });
        // Тот же предел, что и у logMessage: в памяти держим хвост переписки.
        if (chatMessages.length > MESSAGE_HISTORY_PER_CHAT) {
          chatMessages.splice(0, chatMessages.length - MESSAGE_HISTORY_PER_CHAT);
        }
      }
    }

    await loadOrdersFromSupabase();
    const progressCount = await loadProgressFromSupabase();
    console.log(`✅ Loaded: ${activeFunnels.size} funnels, ${globalSubscribers.size} subscribers, ${ordersCount()} orders, ${progressCount} progress states`);
  }

  async function loadFromJSON() {
    const funnelsData = loadJSON(files.funnels, {});
    for (const [k, v] of Object.entries(funnelsData)) {
      activeFunnels.set(k, v as Funnel);
    }

    const subscribersData = loadJSON(files.subscribers, {});
    for (const [k, v] of Object.entries(subscribersData)) {
      globalSubscribers.set(Number(k), v as SubscriberProfile);
    }

    const messagesData = loadJSON(files.messages, {});
    for (const [k, v] of Object.entries(messagesData)) {
      messageHistory.set(k, v as MessageEntry[]);
    }

    loadOrdersSnapshot(loadJSON(files.orders, []));
    loadProgressSnapshot(loadJSON(files.progress, {}));

    const settingsData = loadJSON(files.settings, null);
    if (settingsData) Object.assign(settings, settingsData);
    ensureBotsArray();
  }

  async function loadInitialData() {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      try {
        const { error } = await supabase.from("settings").select("id").limit(1);
        if (error) throw error;
        await loadFromSupabase();
        return;
      } catch (e: any) {
        if (isProduction) {
          throw new Error(`Supabase is unavailable during production startup: ${e?.message || e}`);
        }
        console.warn("⚠️ Supabase connection failed, falling back to JSON files:", e?.message || e);
        setUseSupabase(false);
      }
    }

    await loadFromJSON();
  }

  async function refreshAudienceData() {
    const supabase = getSupabase();
    if (!getUseSupabase() || !supabase) return;
    if (Date.now() - lastAudienceRefreshAt < 2_000) return;
    if (audienceRefreshPromise) return audienceRefreshPromise;

    audienceRefreshPromise = (async () => {
      const [
        { data: subscriberRows, error: subscribersError },
        { data: funnelRows, error: funnelsError },
      ] = await Promise.all([
        readAllRows(() => supabase.from("subscribers").select("*").order("id")),
        readAllRows(() => supabase.from("funnels").select("*").order("id")),
      ]);
      throwOnSupabaseError("audience subscribers refresh", subscribersError);
      throwOnSupabaseError("audience funnels refresh", funnelsError);

      const remoteSubscriberIds = new Set<number>();
      for (const row of subscriberRows || []) {
        const id = Number(row.id);
        if (!Number.isSafeInteger(id)) continue;
        remoteSubscriberIds.add(id);
        const existing = globalSubscribers.get(id);
        globalSubscribers.set(id, {
          id,
          firstName: row.first_name,
          lastName: row.last_name,
          username: row.username,
          languageCode: row.language_code,
          lastActive: row.last_active,
          ...((row.bot_blocked_at || existing?.botBlockedAt)
            ? { botBlockedAt: row.bot_blocked_at || existing?.botBlockedAt }
            : {}),
          ...((row.awaiting_human_reply || existing?.awaitingHumanReply)
            ? { awaitingHumanReply: row.awaiting_human_reply || existing?.awaitingHumanReply }
            : {}),
          ...((row.bot_states || existing?.botStates)
            ? { botStates: row.bot_states || existing?.botStates }
            : {}),
        });
      }
      for (const id of globalSubscribers.keys()) {
        if (!remoteSubscriberIds.has(id)) globalSubscribers.delete(id);
      }

      const remoteFunnelIds = new Set<string>();
      for (const row of funnelRows || []) {
        if (String(row.id).startsWith("__")) continue;
        remoteFunnelIds.add(row.id);
        activeFunnels.set(row.id, { ...(row.data || {}), id: row.id });
      }
      for (const id of activeFunnels.keys()) {
        if (!remoteFunnelIds.has(id)) activeFunnels.delete(id);
      }

      await loadProgressFromSupabase();
      lastAudienceRefreshAt = Date.now();
    })().finally(() => {
      audienceRefreshPromise = null;
    });

    return audienceRefreshPromise;
  }

  async function saveFunnel(id: string, data: any) {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { error } = await supabase.from("funnels").upsert({
        id,
        data,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      throwOnSupabaseError("funnel save", error);
    } else {
      const obj: Record<string, any> = {};
      activeFunnels.forEach((v, k) => (obj[k] = v));
      saveJSON(files.funnels, obj);
    }
  }

  async function deleteFunnel(id: string) {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { error } = await supabase.from("funnels").delete().eq("id", id);
      throwOnSupabaseError("funnel delete", error);
    } else {
      const obj: Record<string, any> = {};
      activeFunnels.forEach((v, k) => (obj[k] = v));
      saveJSON(files.funnels, obj);
    }
  }

  async function saveSettings() {
    const supabase = getSupabase();
    const storageSettings = serializeSettingsForStorage();
    if (getUseSupabase() && supabase) {
      const base = {
        id: "main",
        bots: storageSettings.bots,
        gemini_api_key: storageSettings.geminiApiKey,
        app_url: storageSettings.appUrl,
        notifications: storageSettings.notifications,
        auto_reminders: storageSettings.autoReminders,
        lava_api_key: storageSettings.lavaApiKey || "",
        lava_webhook_secret: storageSettings.lavaWebhookSecret || "",
        updated_at: new Date().toISOString(),
      };
      // Снимок флагов на момент запроса. Решение о повторе должно зависеть от
      // того, что отправил именно этот вызов: два параллельных сохранения
      // (например, старт двух ботов) читали общие флаги, первый успевал их
      // погасить, и второй уходил без повтора — падая с ошибкой о колонке,
      // которой он больше не отправлял.
      const sentAssistantColumn = hasSettingsAssistantColumn;
      const sentAdminChatColumn = hasSettingsAdminChatColumn;
      const sentXaiColumn = hasSettingsXaiColumn;

      const payload: Record<string, any> = { ...base };
      if (sentAssistantColumn) {
        payload.deepseek_api_key = storageSettings.deepseekApiKey || "";
      }
      if (sentAdminChatColumn) {
        payload.admin_telegram_chat_id = storageSettings.adminTelegramChatId || "";
      }
      if (sentXaiColumn) {
        payload.xai_api_key = storageSettings.xaiApiKey || "";
      }

      let { error } = await supabase
        .from("settings")
        .upsert(payload, { onConflict: "id" });

      if (error && (sentAssistantColumn || sentAdminChatColumn || sentXaiColumn) && isMissingColumnError(error)) {
        if (hasSettingsAssistantColumn) {
          hasSettingsAssistantColumn = false;
          console.warn(
            "⚠️ В таблице settings нет колонки deepseek_api_key — ключ ассистента не сохранится. "
            + "Примените ALTER TABLE из supabase-schema.sql.",
          );
        }
        if (hasSettingsAdminChatColumn) {
          hasSettingsAdminChatColumn = false;
          console.warn(
            "⚠️ В таблице settings нет колонки admin_telegram_chat_id. "
            + "Примените ALTER TABLE из supabase-schema.sql.",
          );
        }
        if (hasSettingsXaiColumn) {
          hasSettingsXaiColumn = false;
          console.warn(
            "⚠️ В таблице settings нет колонки xai_api_key. "
            + "Примените ALTER TABLE из supabase-schema.sql.",
          );
        }
        ({ error } = await supabase.from("settings").upsert(base, { onConflict: "id" }));
      }


      throwOnSupabaseError("settings save", error);
    } else {
      saveJSON(files.settings, storageSettings);
    }
  }

  async function saveSubscriber(profile: SubscriberProfile) {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const base = {
        id: profile.id,
        first_name: profile.firstName,
        last_name: profile.lastName || null,
        username: profile.username || null,
        language_code: profile.languageCode || null,
        last_active: profile.lastActive,
      };
      const withFlags = {
        ...base,
        bot_blocked_at: profile.botBlockedAt || null,
        awaiting_human_reply: profile.awaitingHumanReply || null,
        bot_states: profile.botStates || {},
      };

      const sentFlagColumns = hasSubscriberFlagColumns;
      let { error } = await supabase
        .from("subscribers")
        .upsert(sentFlagColumns ? withFlags : base, { onConflict: "id" });

      // Колонки для пометок добавлены отдельной миграцией. Пока её не применили,
      // сохраняем профиль без них: пометки останутся только в памяти, но
      // регистрация подписчика не сломается. После миграции достаточно перезапуска.
      // Повтор зависит от снимка выше, а не от общего флага: иначе параллельное
      // сохранение, погасившее флаг первым, роняло соседнее.
      if (error && sentFlagColumns && isMissingColumnError(error)) {
        if (hasSubscriberFlagColumns) {
          hasSubscriberFlagColumns = false;
          console.warn(
            "⚠️ В таблице subscribers нет новых колонок bot_blocked_at / awaiting_human_reply / bot_states. "
            + "Пометки «заблокировал бота» и «ждёт оператора» не сохранятся между перезапусками. "
            + "Примените ALTER TABLE из supabase-schema.sql.",
          );
        }
        ({ error } = await supabase.from("subscribers").upsert(base, { onConflict: "id" }));
      }

      throwOnSupabaseError("subscriber save", error);
      globalSubscribers.set(profile.id, profile);
    } else {
      const nextSubscribers = new Map(globalSubscribers);
      nextSubscribers.set(profile.id, profile);
      saveJSON(files.subscribers, Object.fromEntries(nextSubscribers));
      globalSubscribers.set(profile.id, profile);
    }
  }

  async function deleteSubscriber(chatId: number) {
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { error: messagesError } = await supabase.from("messages").delete().eq("chat_id", chatId);
      throwOnSupabaseError("subscriber messages delete", messagesError);
      const { error: subscriberError } = await supabase.from("subscribers").delete().eq("id", chatId);
      throwOnSupabaseError("subscriber delete", subscriberError);
      globalSubscribers.delete(chatId);
      for (const key of messageHistory.keys()) {
        if (key === String(chatId) || key.endsWith(`:${chatId}`)) messageHistory.delete(key);
      }
    } else {
      const nextSubscribers = new Map(globalSubscribers);
      const nextMessages = new Map(messageHistory);
      nextSubscribers.delete(chatId);
      for (const key of nextMessages.keys()) {
        if (key === String(chatId) || key.endsWith(`:${chatId}`)) nextMessages.delete(key);
      }
      saveJSON(files.subscribers, Object.fromEntries(nextSubscribers));
      saveJSON(files.messages, Object.fromEntries(nextMessages));
      globalSubscribers.delete(chatId);
      for (const key of messageHistory.keys()) {
        if (key === String(chatId) || key.endsWith(`:${chatId}`)) messageHistory.delete(key);
      }
    }
  }

  async function logMessage(
    chatId: number,
    from: 'bot' | 'user',
    text: string,
    media?: MessageEntry["media"],
    scope?: { botId?: string; funnelId?: string },
  ) {
    const key = getMessageHistoryKey(chatId, scope?.botId);
    const messages = [...(messageHistory.get(key) || [])];
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();

    const entry: MessageEntry = {
      id: msgId,
      from,
      text,
      timestamp,
      ...(scope?.botId ? { botId: scope.botId } : {}),
      ...(scope?.funnelId ? { funnelId: scope.funnelId } : {}),
      ...(media ? { media } : {}),
    };
    messages.push(entry);
    if (messages.length > MESSAGE_HISTORY_PER_CHAT) {
      messages.splice(0, messages.length - MESSAGE_HISTORY_PER_CHAT);
    }

    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const base = {
        id: msgId,
        chat_id: chatId,
        sender: from,
        text: encodeStoredMessageText(entry),
        created_at: timestamp,
      };
      const withScope = {
        ...base,
        bot_id: scope?.botId || null,
        funnel_id: scope?.funnelId || null,
      };
      const sentScopeColumns = hasMessageScopeColumns;
      let { error } = await supabase.from("messages").insert(sentScopeColumns ? withScope : base);
      if (error && sentScopeColumns && isMissingColumnError(error)) {
        if (hasMessageScopeColumns) {
          hasMessageScopeColumns = false;
          console.warn("⚠️ В таблице messages нет bot_id / funnel_id. Примените ALTER TABLE из supabase-schema.sql.");
        }
        ({ error } = await supabase.from("messages").insert(base));
      }
      throwOnSupabaseError("message save", error);
      messageHistory.set(key, messages);
    } else {
      const nextHistory = new Map(messageHistory);
      nextHistory.set(key, messages);
      saveJSON(files.messages, Object.fromEntries(nextHistory));
      messageHistory.set(key, messages);
    }
  }

  return {
    deleteFunnel,
    deleteSubscriber,
    getSettings,
    getTgCache,
    loadFromJSON,
    loadFromSupabase,
    loadInitialData,
    refreshAudienceData,
    logMessage,
    saveFunnel,
    saveSettings,
    saveSubscriber,
    saveTgCache,
  };
}
