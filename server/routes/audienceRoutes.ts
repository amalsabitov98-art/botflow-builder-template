import express from "express";
import TelegramBot from "node-telegram-bot-api";
import type { AudienceFilter, BroadcastCampaign, BroadcastRecipient, BroadcastRule, Funnel, MessageEntry, OrderEntry, Settings, SubscriberProfile } from "../types";
import { matchesAudienceFilter, normalizeAudienceFilter } from "../../shared/audience";
import { getScopedMessageHistory, isAwaitingHumanReply, isBotBlocked, updateSubscriberBotState } from "../services/botScope";

interface AudienceRoutesContext {
  activeFunnels: Map<string, Funnel>;
  broadcastCampaigns: BroadcastCampaign[];
  broadcastRules: BroadcastRule[];
  botInstances: Map<string, TelegramBot>;
  globalSubscribers: Map<number, SubscriberProfile>;
  getSettings: () => Settings;
  messageHistory: Map<string, MessageEntry[]>;
  orders: OrderEntry[];
  userStates: Map<string, any>;
  getUserState: (chatId: number, funnelId?: string) => any;
  getUserStatesForChat: (chatId: number) => any[];
  refreshAudienceData?: () => Promise<void>;
  resolvePrivateMediaUrl?: (mediaSrc: string) => Promise<string>;
  // Пауза между отправками; переопределяется только в тестах.
  sendIntervalMs?: number;
  logMessage: (chatId: number, from: 'bot' | 'user', text: string, media?: MessageEntry["media"], scope?: { botId?: string; funnelId?: string }) => Promise<void>;
  saveBroadcasts: () => Promise<void>;
  saveFunnel: (id: string, data: any) => Promise<void>;
  saveSubscriber: (profile: SubscriberProfile) => Promise<void>;
  deleteSubscriber: (chatId: number) => Promise<void>;
  deleteUserState: (chatId: number) => Promise<void>;
  // Сервер откладывает recovery до запуска Telegram-ботов. Изолированные
  // route-тесты по умолчанию сохраняют прежний автоматический старт.
  deferBackgroundStart?: boolean;
}

export function registerAudienceRoutes(app: express.Express, ctx: AudienceRoutesContext) {
  interface AvatarCacheEntry {
    status: 200 | 404 | 502;
    expiresAt: number;
    contentType?: string;
    body?: Buffer;
  }

  const avatarCache = new Map<number, AvatarCacheEntry>();
  const avatarRequests = new Map<number, Promise<AvatarCacheEntry>>();
  const AVATAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const AVATAR_MISS_TTL_MS = 60 * 60 * 1000;
  const AVATAR_ERROR_TTL_MS = 60 * 1000;
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  async function refreshAudienceSnapshot() {
    try {
      await ctx.refreshAudienceData?.();
    } catch (error: any) {
      console.warn("Failed to refresh audience snapshot, using cached data:", error?.message || error);
    }
  }

  async function persistBroadcastsForRequest(res: express.Response) {
    try {
      await ctx.saveBroadcasts();
      return true;
    } catch (error) {
      console.error("Failed to persist broadcasts:", error);
      if (!res.headersSent) {
        res.status(503).json({ error: "Не удалось сохранить рассылку. Попробуйте ещё раз." });
      }
      return false;
    }
  }

  const segmentLabels: Record<string, string> = {
    all: "Все",
    profile_opened: "Открыли профиль",
    profile_continue_clicked: "Нажали продолжить",
    menu_button_opened_not_continued: "Открыл «Мой прогресс», но не продолжил",
    lesson_sent_not_opened: "Получил не открыл",
    lesson_opened_not_viewed: "Открыл не досмотрел",
    lesson_viewed_not_completed: "Досмотрел не завершил",
    completed_not_paid: "Прошел не купил",
    paid: "Купили",
  };

  const broadcastTemplates = [
    {
      segmentKey: "menu_button_opened_not_continued",
      label: "Вернуть из профиля",
      text: "{name}, вижу ты открыл «Мой прогресс», но не продолжил урок. Жми кнопку в профиле и забери следующий шаг.",
    },
    {
      segmentKey: "lesson_opened_not_viewed",
      label: "Досмотреть урок",
      text: "{name}, ты открыл этап «{stage}», но не дошел до результата. Вернись на пару минут, там самый важный кусок.",
    },
    {
      segmentKey: "lesson_viewed_not_completed",
      label: "Нажать следующий шаг",
      text: "{name}, урок уже посмотрен. Осталось нажать кнопку и перейти дальше, чтобы воронка не остановилась.",
    },
    {
      segmentKey: "completed_not_paid",
      label: "Оффер после прохождения",
      text: "{name}, ты уже прошел ключевой шаг. Хочешь, я покажу, как забрать следующий результат быстрее?",
    },
    {
      segmentKey: "profile_opened",
      label: "Мягкий возврат",
      text: "{name}, твой прогресс сохранен. Продолжим с этапа «{stage}»?",
    },
  ];

  function hasEvent(progress: any, eventName: string) {
    return Array.isArray(progress?.events) && progress.events.some((event: any) => event?.event === eventName);
  }

  function buildSubscriberSegments(progress: any) {
    if (!progress) return [];

    const currentStageId = progress.currentStageId;
    const sent = currentStageId && progress.sentStages?.includes(currentStageId);
    const opened = currentStageId && progress.openedStages?.includes(currentStageId);
    const viewed = currentStageId && progress.viewedStages?.includes(currentStageId);
    const completed = currentStageId && progress.completedStages?.includes(currentStageId);
    const paid = progress.purchaseStatus === 'paid';

    return [
      hasEvent(progress, 'menu_button_opened') ? 'menu_button_opened' : null,
      hasEvent(progress, 'profile_opened') ? 'profile_opened' : null,
      hasEvent(progress, 'profile_continue_clicked') ? 'profile_continue_clicked' : null,
      hasEvent(progress, 'menu_button_opened') && !hasEvent(progress, 'profile_continue_clicked') ? 'menu_button_opened_not_continued' : null,
      sent && !opened ? 'lesson_sent_not_opened' : null,
      opened && !viewed ? 'lesson_opened_not_viewed' : null,
      viewed && !completed ? 'lesson_viewed_not_completed' : null,
      completed && !paid ? 'completed_not_paid' : null,
      paid ? 'paid' : null,
    ].filter(Boolean);
  }

  function getSubscriberFunnel(chatId: number, progress?: any) {
    const state = progress || ctx.getUserState(chatId);
    if (state?.funnelId && ctx.activeFunnels.has(state.funnelId)) {
      return ctx.activeFunnels.get(state.funnelId);
    }
    return Array.from(ctx.activeFunnels.values()).find(funnel => funnel.subscriberIds?.includes(chatId)) || null;
  }

  // Все воронки, в которых состоит подписчик: и по сохранённому прогрессу
  // (одна запись на пару chatId+воронка), и по спискам подписчиков самой воронки.
  function getSubscriberFunnelIds(chatId: number): string[] {
    const ids = new Set<string>();
    for (const state of ctx.getUserStatesForChat(chatId)) {
      if (state?.funnelId && ctx.activeFunnels.has(state.funnelId)) ids.add(state.funnelId);
    }
    for (const funnel of ctx.activeFunnels.values()) {
      if (funnel.subscriberIds?.includes(chatId)) ids.add(funnel.id);
    }
    return Array.from(ids);
  }

  function getSubscriberFunnelList(chatId: number) {
    return getSubscriberFunnelIds(chatId).map(id => {
      const funnel = ctx.activeFunnels.get(id);
      return { id, title: funnel?.title || id };
    });
  }

  function getSubscriberBots(chatId: number) {
    const botIds = new Set<string>();
    for (const funnelId of getSubscriberFunnelIds(chatId)) {
      const connectedBotId = ctx.activeFunnels.get(funnelId)?.connectedBotId;
      if (typeof connectedBotId === "string" && connectedBotId) botIds.add(connectedBotId);
    }

    // Старые контакты могли сохраниться до привязки подписчика к воронке.
    // Для них безопасно пробуем остальные уже запущенные боты владельца.
    for (const botId of ctx.botInstances.keys()) botIds.add(botId);

    return Array.from(botIds)
      .map(botId => ctx.botInstances.get(botId))
      .filter((bot): bot is TelegramBot => Boolean(bot));
  }

  async function loadSubscriberAvatar(chatId: number): Promise<AvatarCacheEntry> {
    const bots = getSubscriberBots(chatId);
    let completedLookup = false;

    for (const bot of bots) {
      try {
        const profilePhotos = await bot.getUserProfilePhotos(chatId, { offset: 0, limit: 1 });
        completedLookup = true;
        const sizes = profilePhotos.photos?.[0];
        if (!sizes?.length) continue;

        const smallestPhoto = [...sizes].sort((left, right) => {
          const leftSize = left.file_size || left.width * left.height;
          const rightSize = right.file_size || right.width * right.height;
          return leftSize - rightSize;
        })[0];

        if (smallestPhoto.file_size && smallestPhoto.file_size > MAX_AVATAR_BYTES) continue;

        const fileUrl = await bot.getFileLink(smallestPhoto.file_id);
        const upstream = await fetch(fileUrl);
        if (!upstream.ok) continue;

        const contentType = upstream.headers.get("content-type")?.split(";")[0].trim() || "";
        const declaredLength = Number(upstream.headers.get("content-length") || 0);
        if (!contentType.startsWith("image/") || declaredLength > MAX_AVATAR_BYTES) continue;

        const body = Buffer.from(await upstream.arrayBuffer());
        if (body.length === 0 || body.length > MAX_AVATAR_BYTES) continue;

        return {
          status: 200,
          contentType,
          body,
          expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
        };
      } catch {
        // Фото может быть скрыто настройками приватности или недоступно конкретному боту.
        // Пробуем следующий бот, не раскрывая его токен или Telegram URL в логах.
      }
    }

    if (bots.length > 0 && !completedLookup) {
      return {
        status: 502,
        expiresAt: Date.now() + AVATAR_ERROR_TTL_MS,
      };
    }

    return {
      status: 404,
      expiresAt: Date.now() + AVATAR_MISS_TTL_MS,
    };
  }

  async function getCachedSubscriberAvatar(chatId: number) {
    const cached = avatarCache.get(chatId);
    if (cached && cached.expiresAt > Date.now()) return cached;
    if (cached) avatarCache.delete(chatId);

    const activeRequest = avatarRequests.get(chatId);
    if (activeRequest) return activeRequest;

    const request = loadSubscriberAvatar(chatId)
      .then(result => {
        avatarCache.set(chatId, result);
        return result;
      })
      .finally(() => avatarRequests.delete(chatId));
    avatarRequests.set(chatId, request);
    return request;
  }

  function getSubscriberStageLabel(chatId: number, funnel: Funnel) {
    const state = ctx.getUserState(chatId, funnel?.id);
    if (state && state.funnelId === funnel?.id) {
      const stageIndex = state.currentStageIndex;
      if (stageIndex >= 0 && funnel?.stages?.[stageIndex]) {
        return funnel.stages[stageIndex].title || `Этап ${stageIndex + 1}`;
      }
    }
    if (funnel?.activeSubscriberIds?.includes(chatId) && funnel.stages?.[0]) {
      return funnel.stages[0].title || "Вход в воронку";
    }
    return "Неизвестно";
  }

  function formatBroadcastText(template: string, subscriber: SubscriberProfile, funnel: Funnel) {
    const stage = funnel ? getSubscriberStageLabel(subscriber.id, funnel) : "Неизвестно";
    return template
      .replace(/\{name\}/g, subscriber.firstName || "")
      .replace(/\{firstName\}/g, subscriber.firstName || "")
      .replace(/\{lastName\}/g, subscriber.lastName || "")
      .replace(/\{username\}/g, subscriber.username ? `@${subscriber.username}` : "")
      .replace(/\{stage\}/g, stage)
      .replace(/\{funnel\}/g, funnel?.title || "");
  }

  interface BroadcastRecipientItem {
    subscriber: SubscriberProfile;
    progress: any;
    segments: string[];
    funnel: Funnel | null;
    funnelId: string | null;
    connectedBotId: string | null;
    bot: TelegramBot | null | undefined;
  }

  function progressTimestamp(progress: any) {
    return progress?.lastActionAt ? new Date(progress.lastActionAt).getTime() : 0;
  }

  // Один Telegram-чат = (подписчик + бот). Если две воронки крутятся на одном боте,
  // это одна и та же переписка — шлём один раз. Разные боты — разные чаты, шлём в каждый.
  function dedupeRecipients(items: BroadcastRecipientItem[]) {
    const byChat = new Map<number, Map<string, BroadcastRecipientItem>>();
    for (const item of items) {
      const chatId = item.subscriber.id;
      if (!byChat.has(chatId)) byChat.set(chatId, new Map());
      const byBot = byChat.get(chatId)!;
      const botKey = item.connectedBotId || "none";
      const existing = byBot.get(botKey);
      const preferNew = !existing
        || (!existing.bot && item.bot)
        || (Boolean(existing.bot) === Boolean(item.bot) && progressTimestamp(item.progress) > progressTimestamp(existing.progress));
      if (preferNew) byBot.set(botKey, item);
    }

    const result: BroadcastRecipientItem[] = [];
    for (const byBot of byChat.values()) {
      const entries = Array.from(byBot.values());
      const deliverable = entries.filter(item => item.bot && item.connectedBotId);
      // Если есть хоть один доставляемый чат — шлём по всем уникальным ботам.
      // Иначе оставляем одну запись, чтобы подписчик попал в счётчик «пропущено».
      const kept = deliverable.length > 0 ? deliverable : entries.slice(0, 1);
      result.push(...kept);
    }
    return result;
  }

  function selectBroadcastRecipients(
    segmentKey: string,
    { funnelId, recipientIds, filter }: { funnelId?: string; recipientIds?: number[]; filter?: AudienceFilter } = {}
  ): BroadcastRecipientItem[] {
    const selectedIds = Array.isArray(recipientIds)
      ? new Set(recipientIds.map(Number).filter(Number.isSafeInteger))
      : null;
    const targetFunnelId = funnelId && ctx.activeFunnels.has(funnelId) ? funnelId : null;

    const items: BroadcastRecipientItem[] = [];
    for (const subscriber of ctx.globalSubscribers.values()) {
      if (selectedIds && !selectedIds.has(subscriber.id)) continue;
      let funnelIds = getSubscriberFunnelIds(subscriber.id);
      if (targetFunnelId) funnelIds = funnelIds.filter(id => id === targetFunnelId);

      // Подписчик без привязки к воронке участвует только в общих рассылках.
      const memberships: (string | null)[] = funnelIds.length > 0
        ? funnelIds
        : (targetFunnelId ? [] : [null]);

      for (const fid of memberships) {
        const funnel = fid ? ctx.activeFunnels.get(fid) : null;
        const progress = fid ? ctx.getUserState(subscriber.id, fid) : ctx.getUserState(subscriber.id);
        const segments = buildSubscriberSegments(progress);
        if (segmentKey !== "all" && !segments.includes(segmentKey)) continue;
        // Отбор по ответам и источнику сужает сегмент, а не заменяет его.
        if (!matchesAudienceFilter(progress?.profile, filter)) continue;

        const connectedBotId = funnel?.connectedBotId || null;
        if (isBotBlocked(subscriber, connectedBotId || undefined)) continue;
        const bot = connectedBotId ? ctx.botInstances.get(connectedBotId) : null;
        items.push({ subscriber, progress, segments, funnel, funnelId: fid, connectedBotId, bot });
      }
    }

    return dedupeRecipients(items);
  }

  function getReadyRecipients(segmentKey: string, options: { funnelId?: string; recipientIds?: number[]; filter?: AudienceFilter } = {}) {
    return selectBroadcastRecipients(segmentKey, options).filter(item => item.bot && item.connectedBotId);
  }

  function getCampaignStatus(sent: number, failed: number, skipped: number): BroadcastCampaign["status"] {
    if (sent > 0 && failed === 0) return "sent";
    if (sent > 0 && failed > 0) return "partial";
    if (sent === 0 && skipped > 0 && failed === 0) return "skipped";
    return "failed";
  }

  function buildConfirmPhrase(readyCount: number) {
    return `ОТПРАВИТЬ ${readyCount}`;
  }

  function createCampaign(partial: Omit<BroadcastCampaign, "id" | "createdAt">): BroadcastCampaign {
    return {
      id: `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...partial,
    };
  }

  function normalizeMediaType(value: unknown): BroadcastCampaign["mediaType"] {
    return value === "photo" || value === "video" || value === "videoNote" ? value : "none";
  }

  function normalizeMediaUrl(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizePinMessage(value: unknown) {
    return value === true;
  }

  function normalizeBroadcastName(value: unknown) {
    const name = typeof value === "string" ? value.trim() : "";
    return name.slice(0, 120) || `Рассылка ${new Date().toLocaleDateString("ru-RU")}`;
  }

  function normalizeRecipientIds(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return Array.from(new Set(
      value
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0)
    )).slice(0, 5_000);
  }

  function validateBroadcastBody({
    segmentKey,
    text,
    mediaType,
    mediaUrl,
  }: {
    segmentKey: unknown;
    text: unknown;
    mediaType: BroadcastCampaign["mediaType"];
    mediaUrl: string;
  }) {
    if (typeof segmentKey !== "string") return "Некорректный сегмент аудитории";
    if ((!text || typeof text !== "string" || text.trim().length < 3) && (mediaType === "none" || !mediaUrl)) {
      return "Добавьте текст сообщения или медиа";
    }
    if (mediaType !== "none" && !mediaUrl) return "Загрузите медиафайл";
    return "";
  }

  function resolveMediaSource(mediaUrl: string) {
    if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
    const appUrl = ctx.getSettings().appUrl.replace(/\/$/, "");
    return `${appUrl}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
  }

  function hasAutoRuleAlreadySent(ruleId: string, chatId: number, funnelId?: string | null) {
    return ctx.broadcastCampaigns.some(campaign => (
      campaign.type === "auto"
      && campaign.sourceRuleId === ruleId
      && campaign.recipients.some(recipient => (
        recipient.chatId === chatId
        && recipient.status === "sent"
        // Запись без funnelId — из старых кампаний: считаем «уже отправлено» по любой воронке.
        && (!funnelId || !recipient.funnelId || recipient.funnelId === funnelId)
      ))
    ));
  }

  // Telegram разрешает ~30 сообщений/сек на рассылки. Держимся с запасом: ~20/сек.
  const SEND_INTERVAL_MS = ctx.sendIntervalMs ?? 50;
  // Небольшие рассылки завершаем до ответа на HTTP-запрос, большие уходят в фон.
  const SYNC_SEND_LIMIT = 10;
  // Ручной запуск подтверждается фразой «ОТПРАВИТЬ N», поэтому лимит здесь низкий:
  // он защищает от случайной рассылки на всю базу одним кликом.
  const MAX_MANUAL_BROADCAST_RECIPIENTS = 100;
  // У запланированной рассылки аудитория считается заново в момент запуска и к тому
  // времени успевает вырасти. Предел выше ручного и служит только страховкой от
  // бесконтрольной отправки; при 20 сообщениях/сек это около минуты работы.
  const MAX_SCHEDULED_BROADCAST_RECIPIENTS = 1000;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  function telegramErrorCode(e: any): number {
    return Number(e?.response?.body?.error_code ?? e?.response?.statusCode) || 0;
  }

  // Недостижимый чат: заблокировали бота, удалили аккаунт либо «chat not found».
  // Всё это бессмысленно повторять — иначе такие адресаты попадают в каждую
  // следующую рассылку и тратят лимит впустую. Ложное срабатывание само
  // исправится: любая активность подписчика снимает метку (см. trackUserActivity).
  function isBlockedError(e: any) {
    const description = String(e?.response?.body?.description || e?.message || "");
    return telegramErrorCode(e) === 403
      || /bot was blocked|user is deactivated|chat not found/i.test(description);
  }

  // 429 = flood limit; Telegram присылает retry_after в секундах.
  function getRetryAfterMs(e: any) {
    if (telegramErrorCode(e) !== 429) return 0;
    const retryAfter = Number(e?.response?.body?.parameters?.retry_after);
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) : 5;
    return seconds * 1000;
  }

  async function deliverBroadcastMessage(
    item: BroadcastRecipientItem,
    messageText: string,
    mediaType: BroadcastCampaign["mediaType"],
    mediaUrl: string
  ) {
    const bot = item.bot!;
    const stableMediaSource = mediaUrl ? await ctx.resolvePrivateMediaUrl?.(mediaUrl) || mediaUrl : "";
    const resolvedMediaSource = /^https?:\/\//i.test(stableMediaSource)
      || stableMediaSource.startsWith("/")
        && !stableMediaSource.startsWith("/api/")
      ? stableMediaSource
      : resolveMediaSource(stableMediaSource);

    if (mediaType === "photo" && mediaUrl) {
      if (messageText.length <= 1024) {
        return await bot.sendPhoto(item.subscriber.id, resolvedMediaSource, messageText ? { caption: messageText } : undefined);
      } else {
        await bot.sendPhoto(item.subscriber.id, resolvedMediaSource);
        return await bot.sendMessage(item.subscriber.id, messageText);
      }
    } else if (mediaType === "video" && mediaUrl) {
      if (messageText.length <= 1024) {
        return await bot.sendVideo(item.subscriber.id, resolvedMediaSource, messageText ? { caption: messageText } : undefined);
      } else {
        await bot.sendVideo(item.subscriber.id, resolvedMediaSource);
        return await bot.sendMessage(item.subscriber.id, messageText);
      }
    } else if (mediaType === "videoNote" && mediaUrl) {
      const mediaMessage = await bot.sendVideoNote(item.subscriber.id, resolvedMediaSource);
      if (messageText) {
        return await bot.sendMessage(item.subscriber.id, messageText);
      }
      return mediaMessage;
    } else {
      return await bot.sendMessage(item.subscriber.id, messageText);
    }
  }

  async function pinBroadcastMessage(bot: TelegramBot, chatId: number, message: any, enabled: boolean) {
    if (!enabled || !message?.message_id) return;
    try {
      await bot.pinChatMessage(chatId, message.message_id, { disable_notification: true });
    } catch (error: any) {
      // Сообщение уже доставлено: отсутствие права закрепления не должно
      // превращать успешную рассылку в failed.
      console.warn(`[BROADCAST] Не удалось закрепить сообщение ${message.message_id}:`, error?.response?.body?.description || error?.message || "unknown error");
    }
  }

  async function markSubscriberBlocked(chatId: number, botId?: string) {
    const subscriber = ctx.globalSubscribers.get(chatId);
    if (!subscriber || isBotBlocked(subscriber, botId)) return;
    updateSubscriberBotState(subscriber, botId, { blockedAt: new Date().toISOString() });
    await ctx.saveSubscriber(subscriber);
  }

  async function runBroadcastCampaign(
    campaign: BroadcastCampaign,
    items: BroadcastRecipientItem[],
    { text, mediaType = "none", mediaUrl = "", pinMessage = false, resume = false }: { text: string; mediaType?: BroadcastCampaign["mediaType"]; mediaUrl?: string; pinMessage?: boolean; resume?: boolean }
  ) {
    // При догрузке после рестарта уже обработанные получатели остаются в кампании,
    // а счётчики продолжают их учитывать — иначе прогресс обнулился бы.
    const processedBefore = resume ? [...campaign.recipients] : [];
    const countProcessed = (status: BroadcastRecipient["status"]) =>
      processedBefore.filter(recipient => recipient.status === status).length;
    const total = processedBefore.length + items.length;

    let sent = countProcessed("sent");
    let failed = countProcessed("failed");
    let skipped = countProcessed("skipped");
    let blocked = countProcessed("blocked");
    let firstSend = true;

    campaign.error = undefined;

    for (const item of items) {
      const recipient: BroadcastRecipient = {
        chatId: item.subscriber.id,
        botId: item.connectedBotId || undefined,
        firstName: item.subscriber.firstName,
        username: item.subscriber.username,
        funnelId: item.funnelId || undefined,
        status: "skipped",
      };

      if (!item.bot || !item.connectedBotId) {
        skipped += 1;
        recipient.error = "Bot is not running";
        campaign.recipients.push(recipient);
        continue;
      }

      if (!firstSend) await sleep(SEND_INTERVAL_MS);
      firstSend = false;

      const messageText = formatBroadcastText(text.trim(), item.subscriber, item.funnel);
      try {
        const bot = item.bot!;
        try {
          const sentMessage = await deliverBroadcastMessage(item, messageText, mediaType, mediaUrl);
          await pinBroadcastMessage(bot, item.subscriber.id, sentMessage, pinMessage);
        } catch (e: any) {
          const retryMs = getRetryAfterMs(e);
          if (!retryMs) throw e;
          await sleep(retryMs);
          const sentMessage = await deliverBroadcastMessage(item, messageText, mediaType, mediaUrl);
          await pinBroadcastMessage(bot, item.subscriber.id, sentMessage, pinMessage);
        }
        await ctx.logMessage(
          item.subscriber.id,
          "bot",
          messageText,
          mediaType && mediaType !== "none" && mediaUrl
            ? { type: mediaType, url: mediaUrl }
            : undefined,
          { botId: item.connectedBotId || undefined, funnelId: item.funnelId || undefined },
        );
        sent += 1;
        recipient.status = "sent";
        recipient.sentAt = new Date().toISOString();
      } catch (e: any) {
        if (isBlockedError(e)) {
          blocked += 1;
          recipient.status = "blocked";
          recipient.error = "Пользователь заблокировал бота";
          await markSubscriberBlocked(item.subscriber.id, item.connectedBotId || undefined);
        } else {
          failed += 1;
          recipient.status = "failed";
          recipient.error = e?.message || "Failed to send message";
        }
      }

      campaign.recipients.push(recipient);
      campaign.result = {
        total,
        attempted: sent + failed + blocked,
        sent,
        failed,
        skipped,
        blocked,
      };
      // Промежуточное сохранение, чтобы прогресс переживал рестарт сервера.
      // Журналируем каждого получателя: после рестарта повториться может максимум
      // одно сообщение (если процесс упал между Telegram и этой записью).
      await ctx.saveBroadcasts();
    }

    campaign.result = {
      total,
      attempted: sent + failed + blocked,
      sent,
      failed,
      skipped,
      blocked,
    };
    campaign.status = getCampaignStatus(sent, failed + blocked, skipped);
    await ctx.saveBroadcasts();
  }

  async function sendBroadcastToItems({
    items,
    text,
    segmentKey,
    filter,
    funnelId,
    funnelLabel,
    type,
    sourceRuleId,
    mediaType = "none",
    mediaUrl = "",
    pinMessage = false,
    background = false,
  }: {
    items: ReturnType<typeof selectBroadcastRecipients>;
    text: string;
    segmentKey: string;
    filter?: AudienceFilter;
    funnelId?: string;
    funnelLabel?: string;
    type: BroadcastCampaign["type"];
    sourceRuleId?: string;
    mediaType?: BroadcastCampaign["mediaType"];
    mediaUrl?: string;
    pinMessage?: boolean;
    background?: boolean;
  }) {
    const campaign = createCampaign({
      type,
      status: "sending",
      segmentKey,
      segmentLabel: segmentLabels[segmentKey] || segmentKey,
      filter,
      funnelId: funnelId || undefined,
      funnelLabel: funnelLabel || undefined,
      text: text.trim(),
      mediaType,
      mediaUrl,
      pinMessage,
      sentAt: new Date().toISOString(),
      sourceRuleId,
      result: { total: items.length, attempted: 0, sent: 0, failed: 0, skipped: 0, blocked: 0 },
      recipients: [],
      // Слепок аудитории на момент запуска: по нему рассылка догружается после
      // рестарта, не задевая тех, кто подписался уже во время отправки.
      targetChatIds: items.map(item => item.subscriber.id),
    });

    ctx.broadcastCampaigns.unshift(campaign);
    if (ctx.broadcastCampaigns.length > 200) ctx.broadcastCampaigns.splice(200);
    // Кампания должна стать долговечной до первого внешнего эффекта в Telegram.
    await ctx.saveBroadcasts();

    const run = runBroadcastCampaign(campaign, items, { text, mediaType, mediaUrl, pinMessage }).catch(async (e) => {
      console.error(`[BROADCAST] Campaign ${campaign.id} crashed:`, e);
      campaign.status = getCampaignStatus(campaign.result.sent, campaign.result.failed + (campaign.result.blocked || 0), campaign.result.skipped);
      await ctx.saveBroadcasts().catch(() => undefined);
    });

    if (!background) await run;
    return campaign;
  }

  function getEventTimestamp(progress: any, eventName: string) {
    if (!Array.isArray(progress?.events)) return 0;
    const event = [...progress.events].reverse().find((item: any) => item?.event === eventName);
    return event?.timestamp ? new Date(event.timestamp).getTime() : 0;
  }

  function getSegmentTriggerTimestamp(segmentKey: string, progress: any) {
    if (!progress) return 0;
    if (segmentKey === "menu_button_opened_not_continued") return getEventTimestamp(progress, "menu_button_opened");
    if (segmentKey === "profile_opened") return getEventTimestamp(progress, "profile_opened");
    if (segmentKey === "profile_continue_clicked") return getEventTimestamp(progress, "profile_continue_clicked");
    return progress.lastActionAt ? new Date(progress.lastActionAt).getTime() : 0;
  }

  async function processBroadcastRules() {
    const enabledRules = ctx.broadcastRules.filter(rule => rule.enabled);
    if (enabledRules.length === 0) return;

    const now = Date.now();
    for (const rule of enabledRules) {
      const candidates = getReadyRecipients(rule.segmentKey, { filter: rule.filter })
        .filter(item => {
          const triggerAt = getSegmentTriggerTimestamp(rule.segmentKey, item.progress);
          if (!triggerAt || now - triggerAt < rule.delayMinutes * 60 * 1000) return false;
          return !hasAutoRuleAlreadySent(rule.id, item.subscriber.id, item.funnelId);
        })
        .slice(0, Math.max(1, rule.limitPerRun || 20));

      if (candidates.length > 0) {
        await sendBroadcastToItems({
          items: candidates,
          text: rule.text,
          segmentKey: rule.segmentKey,
          filter: rule.filter,
          type: "auto",
          sourceRuleId: rule.id,
          mediaType: normalizeMediaType(rule.mediaType),
          mediaUrl: normalizeMediaUrl(rule.mediaUrl),
          pinMessage: normalizePinMessage(rule.pinMessage),
        });
      }
    }
  }

  let automationRunning = false;
  let automationInterval: NodeJS.Timeout | null = null;

  async function processScheduledBroadcasts() {
    const dueCampaigns = ctx.broadcastCampaigns.filter(campaign => (
      campaign.status === "scheduled"
      && campaign.scheduledAt
      && new Date(campaign.scheduledAt).getTime() <= Date.now()
    ));

    for (const campaign of dueCampaigns) {
      // Ставим статус до первого await: параллельный тик уже не подхватит кампанию повторно.
      campaign.status = "sending";
      campaign.sentAt = new Date().toISOString();
      campaign.updatedAt = campaign.sentAt;
      campaign.recipients = [];
      campaign.error = undefined;

      const items = selectBroadcastRecipients(campaign.segmentKey, {
        funnelId: campaign.funnelId,
        recipientIds: campaign.recipientIds,
        filter: campaign.filter,
      });
      // Аудиторию фиксируем на момент запуска, чтобы догрузка после рестарта
      // повторила ровно тот же список.
      campaign.targetChatIds = items.map(item => item.subscriber.id);
      const readyCount = items.filter(item => item.bot && item.connectedBotId).length;

      if (readyCount > MAX_SCHEDULED_BROADCAST_RECIPIENTS) {
        campaign.status = "failed";
        // Раньше кампания молча становилась failed, и об этом можно было узнать
        // только открыв историю. Теперь причина видна в интерфейсе и в логах.
        campaign.error = `Аудитория выросла до ${readyCount} получателей — это больше предела ${MAX_SCHEDULED_BROADCAST_RECIPIENTS} за один запуск. Разбейте рассылку на несколько.`;
        campaign.result = {
          total: items.length,
          attempted: 0,
          sent: 0,
          failed: 0,
          skipped: items.length,
          blocked: 0,
        };
        console.error(`[BROADCAST_SCHEDULER] Кампания ${campaign.id} не отправлена: ${campaign.error}`);
        await ctx.saveBroadcasts();
        continue;
      }

      campaign.result = {
        total: items.length,
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        blocked: 0,
      };
      await ctx.saveBroadcasts();
      await runBroadcastCampaign(campaign, items, {
        text: campaign.text,
        mediaType: normalizeMediaType(campaign.mediaType),
        mediaUrl: normalizeMediaUrl(campaign.mediaUrl),
        pinMessage: normalizePinMessage(campaign.pinMessage),
      });
    }
  }


  // Рестарт процесса во время отправки оставлял кампанию в статусе "sending"
  // навсегда: планировщик забирает только "scheduled". Прогресс сохраняется
  // каждые 25 получателей, поэтому при старте догружаем ровно тех, до кого
  // очередь не дошла.
  async function recoverInterruptedBroadcasts() {
    const interrupted = ctx.broadcastCampaigns.filter(campaign => campaign.status === "sending");
    if (interrupted.length === 0) return;

    for (const campaign of interrupted) {
      const processedScopes = new Set(campaign.recipients
        .filter(recipient => recipient.botId)
        .map(recipient => `${recipient.botId}:${recipient.chatId}`));
      const legacyProcessedIds = new Set(campaign.recipients
        .filter(recipient => !recipient.botId)
        .map(recipient => recipient.chatId));
      // Слепок аудитории есть только у кампаний, запущенных после этого обновления.
      // Для старых честнее закрыть кампанию по факту, чем угадывать список.
      const targetIds = Array.isArray(campaign.targetChatIds) ? campaign.targetChatIds : null;
      const remaining = targetIds
        ? selectBroadcastRecipients(campaign.segmentKey, {
          funnelId: campaign.funnelId,
          recipientIds: targetIds,
          filter: campaign.filter,
        }).filter(item => (
          !legacyProcessedIds.has(item.subscriber.id)
          && !processedScopes.has(`${item.connectedBotId}:${item.subscriber.id}`)
        ))
        : [];

      if (remaining.length === 0) {
        const countProcessed = (status: BroadcastRecipient["status"]) =>
          campaign.recipients.filter(recipient => recipient.status === status).length;
        const sent = countProcessed("sent");
        const failed = countProcessed("failed");
        const skipped = countProcessed("skipped");
        const blocked = countProcessed("blocked");

        campaign.result = {
          total: campaign.recipients.length,
          attempted: sent + failed + blocked,
          sent,
          failed,
          skipped,
          blocked,
        };
        campaign.status = getCampaignStatus(sent, failed + blocked, skipped);
        if (!targetIds) {
          campaign.error = "Отправка прервана перезапуском сервера. Проверьте список получателей перед повторным запуском.";
        }
        console.warn(`[BROADCAST_RECOVERY] Кампания ${campaign.id} закрыта со статусом ${campaign.status}`);
        await ctx.saveBroadcasts();
        continue;
      }

      console.warn(`[BROADCAST_RECOVERY] Кампания ${campaign.id}: догружаем ${remaining.length} получателей после перезапуска`);
      await runBroadcastCampaign(campaign, remaining, {
        text: campaign.text,
        mediaType: normalizeMediaType(campaign.mediaType),
        mediaUrl: normalizeMediaUrl(campaign.mediaUrl),
        pinMessage: normalizePinMessage(campaign.pinMessage),
        resume: true,
      });
    }
  }

  let schedulerRunning = false;
  let schedulerInterval: NodeJS.Timeout | null = null;

  async function startBackgroundTasks() {
    if (automationInterval || schedulerInterval) return;
    // Вызывается сервером только после запуска сохранённых Telegram-ботов.
    await recoverInterruptedBroadcasts();
    await processScheduledBroadcasts();

    automationInterval = setInterval(() => {
      if (automationRunning) return;
      automationRunning = true;
      processBroadcastRules()
        .catch((e) => console.error("[BROADCAST_AUTOMATION] failed:", e))
        .finally(() => { automationRunning = false; });
    }, 60 * 1000);
    automationInterval.unref?.();

    schedulerInterval = setInterval(() => {
      if (schedulerRunning) return;
      schedulerRunning = true;
      processScheduledBroadcasts()
        .catch((e) => console.error("[BROADCAST_SCHEDULER] failed:", e))
        .finally(() => { schedulerRunning = false; });
    }, 15 * 1000);
    schedulerInterval.unref?.();
  }

  function stopBackgroundTasks() {
    if (automationInterval) clearInterval(automationInterval);
    if (schedulerInterval) clearInterval(schedulerInterval);
    automationInterval = null;
    schedulerInterval = null;
  }

  if (!ctx.deferBackgroundStart) {
    void startBackgroundTasks().catch((error) => {
      console.error("[BROADCAST] startup failed:", error);
    });
  }

  app.get("/api/subscribers", async (_req, res) => {
    await refreshAudienceSnapshot();
    const allUsers = Array.from(ctx.globalSubscribers.values());
    const enrichedUsers = allUsers.map(user => {
      const progress = ctx.getUserState(user.id);
      const funnel = getSubscriberFunnel(user.id, progress);

      let stageLabel = "Неизвестно";
      let status = "active";

      if (funnel) {
        if (!funnel.subscriberIds?.includes(user.id)) {
          funnel.subscriberIds = [...(funnel.subscriberIds || []), user.id];
        }
        if (!funnel.activeSubscriberIds) funnel.activeSubscriberIds = [...funnel.subscriberIds];
        const explicitlyUnsubscribed = funnel.unsubscribedSubscriberIds?.includes(user.id);
        status = explicitlyUnsubscribed ? "inactive" : "active";

        const state = progress;
        if (state && state.funnelId === funnel.id) {
          const stageIndex = state.currentStageIndex;
          if (stageIndex >= 0 && funnel.stages && funnel.stages[stageIndex]) {
            stageLabel = funnel.stages[stageIndex].title || `Этап ${stageIndex + 1}`;
          }
        } else if (status === "active" && funnel.stages?.[0]) {
          stageLabel = funnel.stages[0].title || "Вход в воронку";
        }
      } else if (!progress) {
        status = "active";
      }

      const primaryBotId = funnel?.connectedBotId;
      if (isBotBlocked(user, primaryBotId)) status = "inactive";
      const messageHistory = getScopedMessageHistory(ctx.messageHistory, user.id, primaryBotId);
      const lastMessage = messageHistory[messageHistory.length - 1] || null;
      let pendingReplyCount = 0;
      for (let index = messageHistory.length - 1; index >= 0; index -= 1) {
        if (messageHistory[index].from === "bot") break;
        pendingReplyCount += 1;
      }

      return {
        ...user,
        awaitingHumanReply: isAwaitingHumanReply(user, primaryBotId)
          ? user.botStates?.[primaryBotId || ""]?.awaitingHumanReply || user.awaitingHumanReply
          : undefined,
        isTest: user.id >= 9000000000000 || user.username?.startsWith('test_'),
        funnel: funnel ? funnel.title : "—",
        funnelId: funnel?.id || null,
        funnels: getSubscriberFunnelList(user.id),
        stage: stageLabel,
        status: status,
        lastMessage,
        pendingReplyCount,
        // Метка диплинка: откуда человек пришёл в воронку.
        source: progress?.profile?.source?.value || null,
        progress: progress ? {
          currentStageId: progress.currentStageId,
          currentStageIndex: progress.currentStageIndex,
          sentStages: progress.sentStages,
          openedStages: progress.openedStages,
          viewedStages: progress.viewedStages,
          completedStages: progress.completedStages,
          lastActionAt: progress.lastActionAt,
          purchaseStatus: progress.purchaseStatus || 'none',
          segments: buildSubscriberSegments(progress),
          events: progress.events.slice(-20),
        } : null
      };
    });

    res.json(enrichedUsers);
  });

  app.get("/api/subscribers/:chatId/avatar", async (req, res) => {
    const chatId = Number(req.params.chatId);
    if (!Number.isFinite(chatId)) return res.status(400).json({ error: "Invalid subscriber id" });
    if (!ctx.globalSubscribers.has(chatId)) return res.status(404).json({ error: "Subscriber not found" });

    const avatar = await getCachedSubscriberAvatar(chatId);
    res.setHeader("Cache-Control", avatar.status === 200
      ? "private, max-age=21600"
      : avatar.status === 404
        ? "private, max-age=3600"
        : "no-store");
    res.setHeader("Vary", "Authorization, Cookie");

    if (avatar.status !== 200 || !avatar.body || !avatar.contentType) {
      return res.status(avatar.status).end();
    }

    res.setHeader("Content-Type", avatar.contentType);
    res.setHeader("Content-Length", avatar.body.length);
    return res.send(avatar.body);
  });

  async function removeSubscriberEverywhere(chatId: number) {
    for (const funnel of ctx.activeFunnels.values()) {
      let changed = false;
      for (const key of ["subscriberIds", "activeSubscriberIds", "unsubscribedSubscriberIds"]) {
        const arr = (funnel as any)[key];
        if (Array.isArray(arr) && arr.includes(chatId)) {
          (funnel as any)[key] = arr.filter((id: number) => id !== chatId);
          changed = true;
        }
      }
      if (changed) await ctx.saveFunnel(funnel.id, funnel);
    }
    await ctx.deleteUserState(chatId);
    await ctx.deleteSubscriber(chatId);
  }

  app.delete("/api/subscribers/:id", async (req, res) => {
    const chatId = Number(req.params.id);
    if (!Number.isFinite(chatId)) return res.status(400).json({ error: "Invalid subscriber id" });
    if (!ctx.globalSubscribers.has(chatId)) return res.status(404).json({ error: "Subscriber not found" });

    try {
      await removeSubscriberEverywhere(chatId);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Failed to delete subscriber:", e?.message);
      res.status(500).json({ error: e?.message || "Failed to delete subscriber" });
    }
  });

  app.post("/api/subscribers/delete", async (req, res) => {
    const rawIds: any[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids: number[] = Array.from(new Set(
      rawIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    ));
    if (ids.length === 0) return res.status(400).json({ error: "No subscriber ids provided" });

    let deleted = 0;
    const errors: { id: number; error: string }[] = [];
    for (const id of ids) {
      if (!ctx.globalSubscribers.has(id)) continue;
      try {
        await removeSubscriberEverywhere(id);
        deleted += 1;
      } catch (e: any) {
        errors.push({ id, error: e?.message || "Failed to delete subscriber" });
      }
    }

    res.json({ success: true, deleted, errors });
  });

  app.get("/api/orders", (_req, res) => {
    res.json(ctx.orders);
  });

  app.get("/api/broadcasts", (_req, res) => {
    res.json({
      campaigns: ctx.broadcastCampaigns.slice(0, 100),
      rules: ctx.broadcastRules,
      templates: broadcastTemplates,
    });
  });

  app.get("/api/messages/:chatId", (req, res) => {
    const chatId = Number(req.params.chatId);
    if (!Number.isSafeInteger(chatId)) return res.status(400).json({ error: "Invalid chat id" });
    const requestedFunnelId = typeof req.query.funnelId === "string" ? req.query.funnelId : "";
    const funnel = requestedFunnelId && getSubscriberFunnelIds(chatId).includes(requestedFunnelId)
      ? ctx.activeFunnels.get(requestedFunnelId)
      : getSubscriberFunnel(chatId);
    const messages = getScopedMessageHistory(ctx.messageHistory, chatId, funnel?.connectedBotId);
    res.json(messages);
  });

  app.get("/api/telegram/media/:botId/:fileId", async (req, res) => {
    const bot = ctx.botInstances.get(req.params.botId);
    if (!bot) return res.status(404).json({ error: "Bot is not running" });

    try {
      const fileUrl = await bot.getFileLink(req.params.fileId);
      const upstream = await fetch(fileUrl);
      if (!upstream.ok) return res.status(upstream.status).json({ error: "Telegram media is unavailable" });

      const contentType = upstream.headers.get("content-type");
      const contentLength = upstream.headers.get("content-length");
      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (e: any) {
      console.error("Failed to proxy Telegram media:", e?.message);
      res.status(502).json({ error: "Failed to load Telegram media" });
    }
  });

  app.post("/api/messages/:chatId", async (req, res) => {
    const chatId = Number(req.params.chatId);
    const { text, funnelId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing message text' });
    }

    const subscriber = ctx.globalSubscribers.get(chatId);
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    const funnel = typeof funnelId === "string" && getSubscriberFunnelIds(chatId).includes(funnelId)
      ? ctx.activeFunnels.get(funnelId)
      : getSubscriberFunnel(chatId);
    const connectedBotId: string | null = funnel?.connectedBotId || null;

    if (!connectedBotId) {
      return res.status(400).json({ error: 'No bot connected to this subscriber\'s funnel' });
    }

    const bot = ctx.botInstances.get(connectedBotId);
    if (!bot) {
      return res.status(400).json({ error: 'Bot is not running' });
    }

    try {
      await bot.sendMessage(chatId, text);
      await ctx.logMessage(chatId, 'bot', text, undefined, {
        botId: connectedBotId,
        funnelId: funnel?.id,
      });
      // Оператор ответил — метку «ждём человека», которую поставил ассистент, снимаем.
      if (isAwaitingHumanReply(subscriber, connectedBotId)) {
        updateSubscriberBotState(subscriber, connectedBotId, { awaitingHumanReply: null });
        await ctx.saveSubscriber(subscriber);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to send message:', e?.message);
      res.status(500).json({ error: e?.message || 'Failed to send message' });
    }
  });

  // Из чего собирается отбор: вопросы воронок и метки диплинков, которые
  // реально встречались. Список приходит с сервера, чтобы админка не гадала по
  // выгрузке подписчиков и не тянула её целиком ради двух полей.
  app.get("/api/audience/filter-options", async (req, res) => {
    await refreshAudienceSnapshot();
    const rawFunnelId = typeof req.query.funnelId === "string" ? req.query.funnelId : "";
    const funnelId = ctx.activeFunnels.has(rawFunnelId) ? rawFunnelId : "";

    const funnels = funnelId
      ? [ctx.activeFunnels.get(funnelId)!]
      : Array.from(ctx.activeFunnels.values());

    // Один ключ профиля может спрашиваться на разных этапах — собираем варианты
    // вместе, иначе половина ответов окажется вне отбора.
    const byKey = new Map<string, { key: string; label: string; options: Map<string, string> }>();
    for (const funnel of funnels) {
      for (const stage of funnel.stages || []) {
        for (const question of stage.questions || []) {
          if (!question?.key) continue;
          const entry = byKey.get(question.key)
            || { key: question.key, label: question.text || question.key, options: new Map<string, string>() };
          for (const option of question.options || []) {
            if (option?.id) entry.options.set(option.id, option.label || option.id);
          }
          byKey.set(question.key, entry);
        }
      }
    }

    const sourceCounts = new Map<string, number>();
    let withoutSource = 0;
    for (const state of ctx.userStates.values()) {
      if (funnelId && state?.funnelId !== funnelId) continue;
      const value = state?.profile?.source?.value;
      if (value) sourceCounts.set(value, (sourceCounts.get(value) || 0) + 1);
      else withoutSource += 1;
    }

    res.json({
      answers: Array.from(byKey.values())
        .map(entry => ({
          key: entry.key,
          label: entry.label,
          options: Array.from(entry.options.entries()).map(([id, label]) => ({ id, label })),
        }))
        .filter(entry => entry.options.length > 0),
      sources: Array.from(sourceCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([value, count]) => ({ value, count })),
      withoutSource,
    });
  });

  app.post("/api/broadcasts/preview", async (req, res) => {
    await refreshAudienceSnapshot();
    const { segmentKey = "all", text = "", recipientIds, funnelId: rawFunnelId, filter: rawFilter } = req.body || {};

    if (typeof segmentKey !== "string") {
      return res.status(400).json({ error: "Некорректный сегмент аудитории" });
    }

    const filter = normalizeAudienceFilter(rawFilter);
    const funnelId = typeof rawFunnelId === "string" && ctx.activeFunnels.has(rawFunnelId) ? rawFunnelId : undefined;
    const recipients = selectBroadcastRecipients(segmentKey, { funnelId, recipientIds, filter });
    const readyRecipients = recipients.filter(item => item.bot && item.connectedBotId);
    const sampleTextSource = text && typeof text === "string" ? text : "Привет, {name}! Продолжаем?";

    res.json({
      segmentKey,
      segmentLabel: segmentLabels[segmentKey] || segmentKey,
      filter: filter || null,
      funnelId: funnelId || null,
      funnelLabel: funnelId ? ctx.activeFunnels.get(funnelId)?.title || null : null,
      total: recipients.length,
      ready: readyRecipients.length,
      skipped: recipients.length - readyRecipients.length,
      confirmPhrase: buildConfirmPhrase(readyRecipients.length),
      recipients: recipients.map(item => ({
        id: item.subscriber.id,
        firstName: item.subscriber.firstName,
        username: item.subscriber.username,
        funnel: item.funnel?.title || "—",
        funnelId: item.funnelId,
        stage: item.funnel ? getSubscriberStageLabel(item.subscriber.id, item.funnel) : "Неизвестно",
        canSend: Boolean(item.bot && item.connectedBotId),
        segments: item.segments,
      })),
      sampleText: readyRecipients[0]
        ? formatBroadcastText(sampleTextSource, readyRecipients[0].subscriber, readyRecipients[0].funnel)
        : sampleTextSource,
    });
  });

  app.post("/api/broadcasts/test", async (req, res) => {
    const { segmentKey = "all", text = "", chatId, funnelId: rawFunnelId, filter: rawFilter, mediaType: rawMediaType, mediaUrl: rawMediaUrl, pinMessage: rawPinMessage } = req.body || {};
    const mediaType = normalizeMediaType(rawMediaType);
    const mediaUrl = normalizeMediaUrl(rawMediaUrl);
    const pinMessage = normalizePinMessage(rawPinMessage);
    const filter = normalizeAudienceFilter(rawFilter);

    if (typeof segmentKey !== "string") {
      return res.status(400).json({ error: "Некорректный сегмент аудитории" });
    }
    if ((!text || typeof text !== "string" || text.trim().length < 3) && (!mediaType || mediaType === "none" || !mediaUrl)) {
      return res.status(400).json({ error: "Добавьте текст сообщения или медиа" });
    }
    if (mediaType !== "none" && !mediaUrl) return res.status(400).json({ error: "Загрузите медиафайл" });

    const funnelId = typeof rawFunnelId === "string" && ctx.activeFunnels.has(rawFunnelId) ? rawFunnelId : undefined;
    // Для теста разрешаем выбрать любой доступный Telegram-контакт: он не обязан
    // соответствовать сегменту будущей рассылки.
    const readyRecipients = getReadyRecipients(
      chatId ? "all" : segmentKey,
      chatId ? {} : { funnelId, filter },
    );
    const target = chatId
      ? readyRecipients.find(item => item.subscriber.id === Number(chatId))
      : readyRecipients[0];

    if (!target) {
      return res.status(400).json({ error: "Выбранный получатель сейчас недоступен для теста" });
    }

    const campaign = await sendBroadcastToItems({
      items: [target],
      text,
      segmentKey,
      funnelId,
      funnelLabel: funnelId ? ctx.activeFunnels.get(funnelId)?.title : undefined,
      type: "test",
      mediaType,
      mediaUrl,
      pinMessage,
    });

    res.json(campaign);
  });

  app.post("/api/broadcasts/send", async (req, res) => {
    const { segmentKey = "all", text = "", confirmText, maxRecipients = 100, recipientIds, funnelId: rawFunnelId, filter: rawFilter, mediaType: rawMediaType, mediaUrl: rawMediaUrl, pinMessage: rawPinMessage, name, sourceCampaignId } = req.body || {};
    const mediaType = normalizeMediaType(rawMediaType);
    const mediaUrl = normalizeMediaUrl(rawMediaUrl);
    const pinMessage = normalizePinMessage(rawPinMessage);

    const validationError = validateBroadcastBody({ segmentKey, text, mediaType, mediaUrl });
    if (validationError) return res.status(400).json({ error: validationError });

    const funnelId = typeof rawFunnelId === "string" && ctx.activeFunnels.has(rawFunnelId) ? rawFunnelId : undefined;
    const normalizedRecipientIds = normalizeRecipientIds(recipientIds);
    const filter = normalizeAudienceFilter(rawFilter);
    const recipients = selectBroadcastRecipients(segmentKey, { funnelId, recipientIds: normalizedRecipientIds, filter });
    const readyRecipients = recipients.filter(item => item.bot && item.connectedBotId);
    const requestedLimit = Math.max(1, Number(maxRecipients) || MAX_MANUAL_BROADCAST_RECIPIENTS);
    const limit = Math.min(requestedLimit, MAX_MANUAL_BROADCAST_RECIPIENTS);

    if (readyRecipients.length > limit) {
      return res.status(400).json({
        error: `Выбрано слишком много отправок: ${readyRecipients.length}. Максимум за один запуск — ${limit}.`,
        ready: readyRecipients.length,
        maxRecipients: limit,
      });
    }

    const expectedConfirmText = buildConfirmPhrase(readyRecipients.length);
    if (confirmText !== expectedConfirmText) {
      return res.status(400).json({
        error: `Введите точную фразу подтверждения: ${expectedConfirmText}`,
        confirmPhrase: expectedConfirmText,
      });
    }

    // Большие рассылки уходят в фон: ответ сразу, прогресс виден в истории кампаний.
    let campaign: BroadcastCampaign;
    try {
      campaign = await sendBroadcastToItems({
        items: recipients,
        text,
        segmentKey,
        filter,
        funnelId,
        funnelLabel: funnelId ? ctx.activeFunnels.get(funnelId)?.title : undefined,
        type: "manual",
        mediaType,
        mediaUrl,
        pinMessage,
        background: readyRecipients.length > SYNC_SEND_LIMIT,
      });
    } catch (error) {
      console.error("Failed to start broadcast:", error);
      return res.status(503).json({ error: "Не удалось сохранить и запустить рассылку" });
    }
    campaign.name = normalizeBroadcastName(name);
    campaign.updatedAt = new Date().toISOString();
    if (typeof sourceCampaignId === "string") {
      const sourceIndex = ctx.broadcastCampaigns.findIndex(item => (
        item.id === sourceCampaignId
        && item.id !== campaign.id
        && (item.status === "draft" || item.status === "scheduled")
      ));
      if (sourceIndex >= 0) ctx.broadcastCampaigns.splice(sourceIndex, 1);
    }
    if (!(await persistBroadcastsForRequest(res))) return;

    res.json(campaign);
  });

  app.post("/api/broadcasts/save", async (req, res) => {
    const {
      id,
      status = "draft",
      name,
      segmentKey = "all",
      text = "",
      recipientIds,
      funnelId: rawFunnelId,
      filter: rawFilter,
      mediaType: rawMediaType,
      mediaUrl: rawMediaUrl,
      pinMessage: rawPinMessage,
      scheduledAt: rawScheduledAt,
      confirmText,
    } = req.body || {};
    const mediaType = normalizeMediaType(rawMediaType);
    const mediaUrl = normalizeMediaUrl(rawMediaUrl);
    const pinMessage = normalizePinMessage(rawPinMessage);
    if (status !== "draft" && status !== "scheduled") {
      return res.status(400).json({ error: "Допустим только черновик или запланированная рассылка" });
    }
    if (typeof segmentKey !== "string") {
      return res.status(400).json({ error: "Некорректный сегмент аудитории" });
    }
    if (status === "scheduled") {
      const validationError = validateBroadcastBody({ segmentKey, text, mediaType, mediaUrl });
      if (validationError) return res.status(400).json({ error: validationError });
    }

    const funnelId = typeof rawFunnelId === "string" && ctx.activeFunnels.has(rawFunnelId) ? rawFunnelId : undefined;
    const normalizedRecipientIds = normalizeRecipientIds(recipientIds);
    const filter = normalizeAudienceFilter(rawFilter);
    const recipients = selectBroadcastRecipients(segmentKey, { funnelId, recipientIds: normalizedRecipientIds, filter });
    const readyRecipients = recipients.filter(item => item.bot && item.connectedBotId);
    if (readyRecipients.length > MAX_SCHEDULED_BROADCAST_RECIPIENTS) {
      return res.status(400).json({
        error: `Выбрано слишком много отправок: ${readyRecipients.length}. Максимум — ${MAX_SCHEDULED_BROADCAST_RECIPIENTS}.`,
      });
    }

    let scheduledAt: string | undefined;
    if (status === "scheduled") {
      const timestamp = new Date(rawScheduledAt).getTime();
      if (!Number.isFinite(timestamp) || timestamp < Date.now() + 60_000) {
        return res.status(400).json({ error: "Выберите время минимум на минуту позже текущего" });
      }
      const expectedConfirmText = buildConfirmPhrase(readyRecipients.length);
      if (confirmText !== expectedConfirmText) {
        return res.status(400).json({
          error: `Введите точную фразу подтверждения: ${expectedConfirmText}`,
          confirmPhrase: expectedConfirmText,
        });
      }
      scheduledAt = new Date(timestamp).toISOString();
    }

    const snapshot = structuredClone(ctx.broadcastCampaigns);
    const existing = typeof id === "string"
      ? ctx.broadcastCampaigns.find(item => item.id === id && (item.status === "draft" || item.status === "scheduled"))
      : undefined;
    const now = new Date().toISOString();
    const campaign = existing || createCampaign({
      type: "manual",
      status,
      name: normalizeBroadcastName(name),
      segmentKey,
      segmentLabel: segmentLabels[segmentKey] || segmentKey,
      filter,
      funnelId,
      funnelLabel: funnelId ? ctx.activeFunnels.get(funnelId)?.title : undefined,
      recipientIds: normalizedRecipientIds,
      text: String(text).trim(),
      mediaType,
      mediaUrl,
      pinMessage,
      updatedAt: now,
      scheduledAt,
      result: { total: recipients.length, attempted: 0, sent: 0, failed: 0, skipped: 0, blocked: 0 },
      recipients: [],
    });

    Object.assign(campaign, {
      status,
      name: normalizeBroadcastName(name),
      segmentKey,
      segmentLabel: segmentLabels[segmentKey] || segmentKey,
      filter,
      funnelId,
      funnelLabel: funnelId ? ctx.activeFunnels.get(funnelId)?.title : undefined,
      recipientIds: normalizedRecipientIds,
      text: String(text).trim(),
      mediaType,
      mediaUrl,
      pinMessage,
      updatedAt: now,
      scheduledAt,
      sentAt: undefined,
      result: { total: recipients.length, attempted: 0, sent: 0, failed: 0, skipped: 0, blocked: 0 },
      recipients: [],
    });

    if (!existing) ctx.broadcastCampaigns.unshift(campaign);
    if (ctx.broadcastCampaigns.length > 200) ctx.broadcastCampaigns.splice(200);
    if (!(await persistBroadcastsForRequest(res))) {
      ctx.broadcastCampaigns.splice(0, ctx.broadcastCampaigns.length, ...snapshot);
      return;
    }
    res.json(campaign);
  });

  app.delete("/api/broadcasts/:campaignId", async (req, res) => {
    const index = ctx.broadcastCampaigns.findIndex(item => item.id === req.params.campaignId);
    if (index === -1) return res.status(404).json({ error: "Рассылка не найдена" });
    const campaign = ctx.broadcastCampaigns[index];
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return res.status(409).json({ error: "Удалять можно только черновики и запланированные рассылки" });
    }
    const [deletedCampaign] = ctx.broadcastCampaigns.splice(index, 1);
    if (!(await persistBroadcastsForRequest(res))) {
      ctx.broadcastCampaigns.splice(index, 0, deletedCampaign);
      return;
    }
    res.json({ success: true });
  });

  app.post("/api/broadcast-rules", async (req, res) => {
    const { name, segmentKey, filter: rawFilter, delayMinutes, text, enabled = false, limitPerRun = 20, mediaType: rawMediaType, mediaUrl: rawMediaUrl, pinMessage: rawPinMessage } = req.body || {};
    const mediaType = normalizeMediaType(rawMediaType);
    const mediaUrl = normalizeMediaUrl(rawMediaUrl);
    const pinMessage = normalizePinMessage(rawPinMessage);
    const ruleText = typeof text === "string" ? text.trim() : "";

    if (!name || typeof name !== "string") return res.status(400).json({ error: "Missing rule name" });
    if (!segmentKey || typeof segmentKey !== "string") return res.status(400).json({ error: "Missing segment key" });
    if (!ruleText && (mediaType === "none" || !mediaUrl)) return res.status(400).json({ error: "Нужен текст или медиа" });
    if (mediaType !== "none" && !mediaUrl) return res.status(400).json({ error: "Missing media URL" });

    const now = new Date().toISOString();
    const rule: BroadcastRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      segmentKey,
      filter: normalizeAudienceFilter(rawFilter),
      delayMinutes: Math.max(1, Number(delayMinutes) || 120),
      text: ruleText,
      mediaType,
      mediaUrl,
      pinMessage,
      enabled: Boolean(enabled),
      limitPerRun: Math.max(1, Number(limitPerRun) || 20),
      createdAt: now,
      updatedAt: now,
    };

    ctx.broadcastRules.unshift(rule);
    if (!(await persistBroadcastsForRequest(res))) {
      ctx.broadcastRules.shift();
      return;
    }
    res.json(rule);
  });

  app.patch("/api/broadcast-rules/:ruleId", async (req, res) => {
    const rule = ctx.broadcastRules.find(item => item.id === req.params.ruleId);
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    const previousRule = structuredClone(rule);
    const { name, segmentKey, filter, delayMinutes, text, enabled, limitPerRun, mediaType, mediaUrl, pinMessage } = req.body || {};
    if (name !== undefined) rule.name = String(name).trim();
    if (segmentKey !== undefined) rule.segmentKey = String(segmentKey);
    // null снимает отбор целиком; undefined — поле просто не трогали.
    if (filter !== undefined) rule.filter = normalizeAudienceFilter(filter);
    if (delayMinutes !== undefined) rule.delayMinutes = Math.max(1, Number(delayMinutes) || rule.delayMinutes);
    if (text !== undefined) rule.text = String(text).trim();
    if (mediaType !== undefined) rule.mediaType = normalizeMediaType(mediaType);
    if (mediaUrl !== undefined) rule.mediaUrl = normalizeMediaUrl(mediaUrl);
    if (pinMessage !== undefined) rule.pinMessage = normalizePinMessage(pinMessage);
    if (enabled !== undefined) rule.enabled = Boolean(enabled);
    if (limitPerRun !== undefined) rule.limitPerRun = Math.max(1, Number(limitPerRun) || rule.limitPerRun);
    rule.updatedAt = new Date().toISOString();

    if (!(await persistBroadcastsForRequest(res))) {
      Object.assign(rule, previousRule);
      return;
    }
    res.json(rule);
  });

  app.delete("/api/broadcast-rules/:ruleId", async (req, res) => {
    const index = ctx.broadcastRules.findIndex(item => item.id === req.params.ruleId);
    if (index === -1) return res.status(404).json({ error: "Rule not found" });

    const [deleted] = ctx.broadcastRules.splice(index, 1);
    if (!(await persistBroadcastsForRequest(res))) {
      ctx.broadcastRules.splice(index, 0, deleted);
      return;
    }
    res.json({ success: true, rule: deleted });
  });

  return { startBackgroundTasks, stopBackgroundTasks };
}
