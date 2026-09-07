import TelegramBot from "node-telegram-bot-api";
import Anthropic from "@anthropic-ai/sdk";
import type { BotEntry, Funnel, FunnelStage, MessageEntry, Reminder, Settings, StageQuestion, SubscriberProfile } from "../types";
import type { ReminderJob, UserStageState } from "./progress";
import { escapeTelegramHtml, isTelegramMiniAppFunnel } from "./telegram";
import { isBotBlocked, updateSubscriberBotState } from "./botScope";
import { transcribeVoiceNote, type AudioTranscriptionOptions } from "./audioTranscription";
import { DEEPSEEK_API_BASE_URL, DEEPSEEK_REVIEW_MODEL } from "./deepseek";



// Команда старта: сама «/start», её адресная форма «/start@bot» и любой хвост —
// метка диплинка. Якорь обязателен: без него сообщение «а где /start?»
// перезапускало бы воронку.
const START_COMMAND = /^\/start(?:@\w+)?(?:\s|$)/;

export function isStartCommand(text?: string) {
  return START_COMMAND.test(text || "");
}

/**
 * Пришло ли Business-сообщение от собеседника, а не от самого владельца аккаунта.
 *
 * Обновление `business_message` приходит на обе стороны переписки. Business-чат
 * всегда личный, поэтому chat.id — это собеседник: у входящего сообщения from.id
 * совпадает с ним, у исходящего там идентификатор владельца. Без этой проверки
 * ответы владельца засчитывались как сдача домашнего задания, и на них отвечал
 * ИИ-ассистент.
 */
export function isIncomingBusinessMessage(msg: { chat?: { id?: number }; from?: { id?: number } } | undefined): boolean {
  const chatId = msg?.chat?.id;
  if (typeof chatId !== "number") return false;
  return msg?.from?.id === chatId;
}

/**
 * Воронка, в которой человек идёт у этого бота.
 *
 * У одного бота может быть несколько активных воронок, а Business-чат не несёт
 * ничего, кроме собеседника: ни диплинка, ни кнопки с `funnelId`. Раньше
 * бралась первая попавшаяся — человек из личной переписки попадал в чужой курс
 * и мог закрыть в нём этап. Теперь выбирается воронка, где у него есть
 * состояние (самое свежее по `lastActionAt`), а единственная воронка бота
 * подходит и без следов: выбирать всё равно не из чего. Если воронок несколько
 * и человек не встречался ни в одной — угадывать нечего, вернётся undefined.
 */
export function selectFunnelForChat(
  funnels: Funnel[],
  botId: string,
  getState: (funnelId: string) => { lastActionAt?: string } | undefined,
): Funnel | undefined {
  const botFunnels = funnels.filter((funnel) => funnel.connectedBotId === botId);
  if (botFunnels.length <= 1) return botFunnels[0];

  let selected: Funnel | undefined;
  let selectedAt = -1;
  for (const funnel of botFunnels) {
    const state = getState(funnel.id);
    if (!state) continue;
    const parsed = state.lastActionAt ? new Date(state.lastActionAt).getTime() : 0;
    // Битую дату считаем нулём, иначе NaN проигрывал бы любому сравнению и
    // воронка с испорченным состоянием не выбиралась бы никогда.
    const actedAt = Number.isFinite(parsed) ? parsed : 0;
    if (actedAt > selectedAt) {
      selected = funnel;
      selectedAt = actedAt;
    }
  }
  return selected;
}

// Автопереход живёт в той же очереди отложенных задач, что и напоминания:
// одна персистентность, одно восстановление таймеров после рестарта. Ключ
// занимает место идентификатора напоминания и не может с ним столкнуться.
const ADVANCE_JOB_KEY = "__advance__";

interface BotManagerDeps {
  activeFunnels: Map<string, Funnel>;
  buildInlineKeyboard: (
    buttonText: string,
    buttonAction: string,
    buttonUrl: string | undefined,
    buttonStyle: string | undefined,
    stageId: string,
    funnelId: string,
    hasWebApp: boolean,
    nextStageId: string | undefined,
    chatId?: number
  ) => any[];
  deliverStageMessage: (bot: TelegramBot, chatId: number, funnel: Funnel, stage: FunnelStage, firstName?: string) => Promise<void>;
  ensureUserState: (chatId: number, funnelId: string, stage?: any) => UserStageState;
  getUserState: (chatId: number, funnelId?: string) => UserStageState | undefined;
  getSettings: () => Settings;
  // Ключ ассистента: из настроек админки, иначе из переменных окружения.
  // Читается через server.ts, а не из process.env: все ключи проекта проходят
  // через config.ts, который в development не отдаёт боевые значения.
  getAssistantApiKey: () => string;
  // Ключи распознавания голосовых: настройки админки поверх переменных окружения.
  getTranscriptionKeys: () => AudioTranscriptionOptions;
  // null → long polling (dev/локально); объект → webhook-режим (production за HTTPS).
  getTelegramWebhook: () => { baseUrl: string; secret: string } | null;
  getWebAppUrl: (funnelId: string, stageId: string, chatId?: number) => string;
  globalSubscribers: Map<number, SubscriberProfile>;
  // Ассистент воронки. Возвращает true, если ответил подписчику сам.
  handleIncomingUserMessage?: (bot: TelegramBot, chatId: number, text: string, funnel: Funnel) => Promise<boolean>;
  // Начисляет бонус за ответ на вопрос воронки — ровно один раз на вопрос.
  awardQuestionBonus?: (state: UserStageState, funnelId: string, questionKey: string) => void;
  // Переписывает текст напоминания под подписчика. При любой осечке обязан
  // вернуть исходный шаблон — напоминание не должно теряться из-за ИИ.
  personalizeReminderText?: (funnel: Funnel, chatId: number, template: string) => Promise<string>;
  logMessage: (chatId: number, from: 'bot' | 'user', text: string, media?: MessageEntry["media"], scope?: { botId?: string; funnelId?: string }) => Promise<void>;
  persistUserState: (chatId: number, state: UserStageState) => Promise<void>;
  recordUserEvent: (chatId: number, event: string, funnelId: string, stageId?: string) => any;
  saveFunnel: (id: string, data: any) => Promise<void>;
  saveHomeworkSubmission?: (chatId: number, funnelId: string, submission: any) => Promise<any>;
  saveSettings: () => Promise<void>;
  saveSubscriber: (profile: SubscriberProfile) => Promise<void>;
  shouldSendReminder: (state: UserStageState, reminder: Reminder, stage: FunnelStage) => boolean;
  updateHomeworkStatus?: (chatId: number, funnelId: string, stageId: string, status: 'approved' | 'rejected', reviewerComment?: string) => Promise<{ success: boolean; state?: any; nextStageId?: string }>;
  userStates: Map<string, UserStageState>;
}

export function createBotManager({
  activeFunnels,
  buildInlineKeyboard,
  deliverStageMessage,
  ensureUserState,
  getUserState,
  getSettings,
  getAssistantApiKey,
  getTranscriptionKeys,
  getTelegramWebhook,
  getWebAppUrl,
  awardQuestionBonus,
  globalSubscribers,
  handleIncomingUserMessage,
  personalizeReminderText,
  logMessage,
  persistUserState,
  recordUserEvent,
  saveFunnel,
  saveHomeworkSubmission,
  saveSettings,
  saveSubscriber,
  shouldSendReminder,
  updateHomeworkStatus,
  userStates,
}: BotManagerDeps) {
  const botInstances = new Map<string, TelegramBot>();

  const MAX_TIMEOUT_MS = 2_147_483_647;

  function runBotTask(label: string, task: () => Promise<void>) {
    void task().catch((error) => console.error(`[BOT] ${label} failed:`, error));
  }

  // dropWebhook: снимаем webhook в Telegram только при явной остановке бота пользователем.
  // При shutdown (деплой) webhook НЕ трогаем: новый контейнер уже поставил свой,
  // и deleteWebHook из умирающего контейнера снёс бы его.
  function stopBotById(botId: string, { dropWebhook = false }: { dropWebhook?: boolean } = {}) {
    const bot = botInstances.get(botId);
    if (bot) {
      try {
        if (dropWebhook) void bot.deleteWebHook().catch(() => undefined);
        void bot.stopPolling().catch(() => undefined);
        bot.removeAllListeners();
      } catch (e) { /* ignore */ }
      botInstances.delete(botId);
    }
  }

  function stopAllBots() {
    for (const [id] of botInstances) {
      stopBotById(id);
    }
  }

  function getMenuButtonText(funnel: Funnel) {
    const rawText = funnel?.introWebApp?.menuButtonText || "Мой прогресс";
    return String(rawText).trim().slice(0, 64) || "Мой прогресс";
  }

  async function setFunnelMenuButton(bot: TelegramBot, funnel: Funnel, chatId?: number) {
    if (!funnel?.id || !funnel.introWebApp?.enabled) return;

    const signedUrl = getWebAppUrl(funnel.id, "intro", chatId);
    const url = `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}source=menu_button`;
    try {
      await bot.setChatMenuButton({
        ...(chatId ? { chat_id: chatId } : {}),
        menu_button: {
          type: "web_app",
          text: getMenuButtonText(funnel),
          web_app: { url },
        },
      });
      console.log(`[BOT] WebApp menu button configured for funnel ${funnel.id}${chatId ? ` chatId=${chatId}` : ""}`);
    } catch (e: any) {
      console.warn(`[BOT] Failed to configure WebApp menu button for funnel ${funnel.id}:`, e?.message || e);
    }
  }

  function getResumeStage(funnel: Funnel, state?: UserStageState) {
    const firstStage = funnel.stages?.[0];
    if (!state) return firstStage;

    const currentStage = funnel.stages?.find((stage: FunnelStage) => stage.id === state.currentStageId) || firstStage;
    const currentCompleted = currentStage?.id && state.completedStages.includes(currentStage.id);
    const nextStageId = currentCompleted ? currentStage?.nextStage?.targetStageId : currentStage?.id;
    return funnel.stages?.find((stage: FunnelStage) => stage.id === nextStageId) || currentStage || firstStage;
  }

  function getReminderJobId(chatId: number, funnelId: string, stageId: string, reminderId: string) {
    return `${chatId}:${funnelId}:${stageId}:${reminderId}`;
  }

  function clearRuntimeTimeouts(state?: UserStageState) {
    if (!state) return;
    state.timeouts.forEach((t) => clearTimeout(t));
    state.timeouts = [];
  }

  function markReminderJob(state: UserStageState, jobId: string, status: ReminderJob["status"]) {
    const job = state.reminderJobs.find((item) => item.id === jobId);
    if (!job || job.status !== "pending") return false;
    job.status = status;
    job.completedAt = new Date().toISOString();
    return true;
  }

  function cancelPendingReminderJobs(state: UserStageState, funnelId?: string, stageId?: string) {
    let changed = false;
    for (const job of state.reminderJobs) {
      if (job.status !== "pending") continue;
      if (funnelId && job.funnelId !== funnelId) continue;
      if (stageId && job.stageId !== stageId) continue;
      job.status = "canceled";
      job.completedAt = new Date().toISOString();
      changed = true;
    }
    return changed;
  }

  /**
   * Автопереход: следующий этап уходит сам, если человек так и не нажал кнопку.
   * Условия ровно те же, что у напоминания — он всё ещё на этом этапе, — плюс
   * проверка, что следующий этап ему ещё не приходил.
   */
  async function deliverStageAdvance(bot: TelegramBot, chatId: number, jobId: string) {
    const jobFunnelId = jobId.split(":")[1];
    const state = getUserState(chatId, jobFunnelId);
    const job = state?.reminderJobs.find((item) => item.id === jobId);
    if (!state || !job || job.status !== "pending") return;

    const funnel = activeFunnels.get(job.funnelId);
    const stage = funnel?.stages?.find((s: FunnelStage) => s.id === job.stageId);
    const targetId = stage?.nextStage?.targetStageId;
    const target = targetId ? funnel?.stages?.find((s: FunnelStage) => s.id === targetId) : undefined;

    const stillOnStage = state.funnelId === job.funnelId && state.currentStageId === job.stageId;
    const alreadySent = Boolean(target && state.sentStages.includes(target.id));
    // Заблокировал бота — доставлять некому, и ретраить на каждом рестарте незачем.
    const blocked = isBotBlocked(globalSubscribers.get(chatId), funnel?.connectedBotId);

    if (!funnel || !stage || !target || !stillOnStage || alreadySent || blocked) {
      if (markReminderJob(state, jobId, "skipped")) {
        await persistUserState(chatId, state);
      }
      return;
    }

    try {
      // Тот же путь, что и по нажатию кнопки: этап, его напоминания и вопросы.
      await sendStageMessage(bot, chatId, funnel, target);

      // Переход на новый этап гасит все висящие задачи прошлого — в том числе эту.
      // Поэтому отмечаем её отправленной напрямую, а не через markReminderJob,
      // который работает только с ещё ожидающими задачами.
      const delivered = state.reminderJobs.find((item) => item.id === jobId);
      if (delivered && delivered.status !== "sent") {
        delivered.status = "sent";
        delivered.completedAt = new Date().toISOString();
        await persistUserState(chatId, state);
      }
      console.log(`[ADVANCE] ${chatId}: ${stage.id} → ${target.id} по таймеру`);
    } catch (e: any) {
      const errorCode = Number(e?.response?.body?.error_code ?? e?.response?.status);
      if (errorCode === 403) {
        const blockedSubscriber = globalSubscribers.get(chatId);
        if (blockedSubscriber && !isBotBlocked(blockedSubscriber, funnel.connectedBotId)) {
          updateSubscriberBotState(blockedSubscriber, funnel.connectedBotId, {
            blockedAt: new Date().toISOString(),
          });
          await saveSubscriber(blockedSubscriber);
        }
        if (markReminderJob(state, jobId, "skipped")) {
          await persistUserState(chatId, state);
        }
        console.warn(`[ADVANCE] Подписчик ${chatId} заблокировал бота, автопереход ${jobId} отменён`);
        return;
      }
      console.error(`[ADVANCE] Не удалось перевести ${chatId} на следующий этап (${jobId}):`, e);
    }
  }

  async function deliverReminderJob(bot: TelegramBot, chatId: number, jobId: string) {
    const jobFunnelId = jobId.split(":")[1];
    const state = getUserState(chatId, jobFunnelId);
    const job = state?.reminderJobs.find((item) => item.id === jobId);
    if (!state || !job || job.status !== "pending") return;

    if (job.kind === "advance") {
      await deliverStageAdvance(bot, chatId, jobId);
      return;
    }

    const funnel = activeFunnels.get(job.funnelId);
    const stage = funnel?.stages?.find((s: FunnelStage) => s.id === job.stageId);
    const reminder = stage?.reminders?.find((item: Reminder) => item.id === job.reminderId);

    if (!funnel || !stage || !reminder) {
      if (markReminderJob(state, jobId, "skipped")) {
        await persistUserState(chatId, state);
      }
      return;
    }

    const stillOnStage = state.funnelId === job.funnelId && state.currentStageId === job.stageId;
    if (!stillOnStage || !shouldSendReminder(state, reminder, stage)) {
      if (markReminderJob(state, jobId, "skipped")) {
        await persistUserState(chatId, state);
      }
      return;
    }

    const subscriber = globalSubscribers.get(chatId);
    const firstName = subscriber?.firstName || "друг";
    const template = reminder.message.replace(/{name}/g, firstName);
    // Текст может переписать ассистент под конкретного человека; если он выключен
    // или не справился, уходит исходный шаблон.
    const msg = personalizeReminderText
      ? await personalizeReminderText(funnel, chatId, template)
      : template;
    try {
      await deliverStageMessage(
        bot,
        chatId,
        funnel,
        {
          ...stage,
          firstMessage: {
            text: msg,
            photo: reminder.photo,
            buttonText: reminder.buttonText,
            buttonAction: reminder.buttonAction || (stage.webApp?.enabled ? "open_webapp" : "next_stage"),
            buttonUrl: reminder.buttonUrl,
            buttonStyle: reminder.buttonStyle,
            pinMessage: reminder.pinMessage,
            mediaOrder: "media_first",
          },
        },
        firstName
      );
      if (markReminderJob(state, jobId, "sent")) {
        await persistUserState(chatId, state);
      }
    } catch (e: any) {
      // 403 = подписчик заблокировал бота: помечаем его и гасим задачу,
      // иначе напоминание будет ретраиться при каждом рестарте сервера.
      const errorCode = Number(e?.response?.body?.error_code ?? e?.response?.status);
      if (errorCode === 403) {
        const blockedSubscriber = globalSubscribers.get(chatId);
        if (blockedSubscriber && !isBotBlocked(blockedSubscriber, funnel.connectedBotId)) {
          updateSubscriberBotState(blockedSubscriber, funnel.connectedBotId, {
            blockedAt: new Date().toISOString(),
          });
          await saveSubscriber(blockedSubscriber);
        }
        if (markReminderJob(state, jobId, "skipped")) {
          await persistUserState(chatId, state);
        }
        console.warn(`[REMINDER] Subscriber ${chatId} blocked the bot, reminder ${jobId} skipped`);
        return;
      }
      console.error(`[REMINDER] Failed to send reminder ${jobId}:`, e);
    }
  }

  function scheduleReminderTimeout(bot: TelegramBot, chatId: number, state: UserStageState, jobId: string) {
    const job = state.reminderJobs.find((item) => item.id === jobId);
    if (!job || job.status !== "pending") return;

    const dueAt = new Date(job.dueAt).getTime();
    const delayMs = Math.max(0, dueAt - Date.now());
    const timeout = setTimeout(() => {
      if (delayMs > MAX_TIMEOUT_MS) {
        scheduleReminderTimeout(bot, chatId, state, jobId);
        return;
      }
      void deliverReminderJob(bot, chatId, jobId)
        .catch((error) => console.error(`[REMINDER] Unhandled delivery failure for ${jobId}:`, error));
    }, Math.min(delayMs, MAX_TIMEOUT_MS));
    state.timeouts.push(timeout);
  }

  function createReminderJobs(
    chatId: number,
    funnelId: string,
    stage: FunnelStage,
    reminders: any[],
    baseTimeMs = Date.now()
  ) {
    const state = ensureUserState(chatId, funnelId, stage);
    const createdJobIds: string[] = [];
    const now = new Date().toISOString();

    for (const reminder of reminders) {
      if (!reminder?.id || !Number.isFinite(Number(reminder.delayMinutes))) continue;
      const id = getReminderJobId(chatId, funnelId, stage.id, reminder.id);
      const existing = state.reminderJobs.find((job) => job.id === id);
      if (existing) {
        if (existing.status === "pending") {
          // Уже поставленная задача имеет собственный runtime-таймер. Повторное
          // событие не должно создавать второй timeout на тот же job.
        } else if (existing.status === "canceled") {
          existing.dueAt = new Date(baseTimeMs + Number(reminder.delayMinutes) * 60 * 1000).toISOString();
          existing.status = "pending";
          existing.createdAt = now;
          existing.completedAt = undefined;
          createdJobIds.push(existing.id);
        }
        continue;
      }

      const dueAt = new Date(baseTimeMs + Number(reminder.delayMinutes) * 60 * 1000).toISOString();
      state.reminderJobs.push({
        id,
        kind: "reminder",
        funnelId,
        stageId: stage.id,
        reminderId: reminder.id,
        dueAt,
        status: "pending",
        createdAt: now,
      });
      createdJobIds.push(id);
    }

    if (state.reminderJobs.length > 200) {
      state.reminderJobs.splice(0, state.reminderJobs.length - 200);
    }

    return { state, createdJobIds };
  }

  /**
   * Ставит в ту же очередь задачу «перевести на следующий этап через N минут».
   * Возвращает id задачи или null, если у этапа нет автоперехода.
   */
  function createAdvanceJob(
    chatId: number,
    funnelId: string,
    stage: FunnelStage,
    baseTimeMs = Date.now()
  ) {
    const minutes = Number(stage.nextStage?.autoAdvanceMinutes);
    if (!stage.nextStage?.targetStageId || !Number.isFinite(minutes) || minutes <= 0) return null;

    const state = ensureUserState(chatId, funnelId, stage);
    const id = getReminderJobId(chatId, funnelId, stage.id, ADVANCE_JOB_KEY);
    const dueAt = new Date(baseTimeMs + minutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const existing = state.reminderJobs.find((job) => job.id === id);
    if (existing) {
      // Уже висит — не сдвигаем срок. Отменённую задачу этап заводит заново.
      if (existing.status === "pending") return { state, jobId: id };
      if (existing.status !== "canceled") return null;
      existing.kind = "advance";
      existing.dueAt = dueAt;
      existing.status = "pending";
      existing.createdAt = now;
      existing.completedAt = undefined;
      return { state, jobId: id };
    }

    state.reminderJobs.push({
      id,
      kind: "advance",
      funnelId,
      stageId: stage.id,
      reminderId: ADVANCE_JOB_KEY,
      dueAt,
      status: "pending",
      createdAt: now,
    });
    if (state.reminderJobs.length > 200) {
      state.reminderJobs.splice(0, state.reminderJobs.length - 200);
    }
    return { state, jobId: id };
  }

  async function scheduleStageAdvance(
    bot: TelegramBot,
    chatId: number,
    funnelId: string,
    stage: FunnelStage,
    baseTimeMs = Date.now()
  ) {
    const created = createAdvanceJob(chatId, funnelId, stage, baseTimeMs);
    if (!created) return;
    scheduleReminderTimeout(bot, chatId, created.state, created.jobId);
    await persistUserState(chatId, created.state);
  }

  async function scheduleReminderJobs(
    bot: TelegramBot,
    chatId: number,
    funnelId: string,
    stage: FunnelStage,
    reminders: any[],
    baseTimeMs = Date.now()
  ) {
    if (!getSettings().autoReminders || reminders.length === 0) return;
    const { state, createdJobIds } = createReminderJobs(chatId, funnelId, stage, reminders, baseTimeMs);
    for (const jobId of createdJobIds) {
      scheduleReminderTimeout(bot, chatId, state, jobId);
    }
    await persistUserState(chatId, state);
  }

  async function sendResumeMessage(bot: TelegramBot, chatId: number, funnel: Funnel, firstName: string, state: UserStageState) {
    const stage = getResumeStage(funnel, state);
    // Название берём из воронки: движок общий, а копия проекта не должна
    // здороваться чужим брендом.
    const funnelTitle = (funnel.title || "").trim();
    const intro = funnelTitle
      ? `${firstName}, ты уже начал обучение в «${funnelTitle}».`
      : `${firstName}, ты уже начал обучение.`;
    const text = `${intro}\n\nСейчас у тебя открыт шаг:\n${stage?.title || "продолжить обучение"}.\n\nНажми кнопку ниже, чтобы вернуться к нему.`;

    const resumeUrl = getWebAppUrl(funnel.id, stage?.id || "intro", chatId);
    const resumeButton: any = { text: "Продолжить обучение" };
    if (isTelegramMiniAppFunnel(funnel)) {
      resumeButton.web_app = { url: resumeUrl };
    } else {
      resumeButton.url = resumeUrl;
    }

    await bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [[resumeButton]],
      },
    });
    await logMessage(chatId, 'bot', text, undefined, {
      botId: funnel.connectedBotId,
      funnelId: funnel.id,
    });
  }

  async function trackUserActivity(entry: BotEntry, chatId: number, targetFunnel?: any, userProfile?: any) {
    if (userProfile) {
      // Блокировка бота сбрасывается новой активностью, а вот ожидание ответа
      // оператора — нет: подписчик, который пишет снова, ждёт человека тем более.
      const previous = globalSubscribers.get(chatId);
      const nextProfile: SubscriberProfile = {
        id: chatId,
        firstName: userProfile.first_name || "Без имени",
        lastName: userProfile.last_name,
        username: userProfile.username,
        languageCode: userProfile.language_code,
        lastActive: new Date().toISOString(),
        ...(previous?.awaitingHumanReply ? { awaitingHumanReply: previous.awaitingHumanReply } : {}),
        ...(previous?.botStates ? { botStates: previous.botStates } : {}),
      };
      updateSubscriberBotState(nextProfile, entry.id, { blockedAt: null });
      await saveSubscriber(nextProfile);
    }

    const funnels = Array.from(activeFunnels.values());
    const funnel = targetFunnel || funnels.find((f) => f.connectedBotId === entry.id);
    if (!funnel) return;

    let updated = false;
    if (!funnel.subscriberIds) funnel.subscriberIds = [];
    if (!funnel.activeSubscriberIds) funnel.activeSubscriberIds = [...funnel.subscriberIds];
    if (!funnel.unsubscribedSubscriberIds) funnel.unsubscribedSubscriberIds = [];

    if (!funnel.subscriberIds.includes(chatId)) {
      funnel.subscriberIds.push(chatId);
      updated = true;
    }
    if (!funnel.activeSubscriberIds.includes(chatId)) {
      funnel.activeSubscriberIds.push(chatId);
      updated = true;
    }
    const unsubscribedBefore = funnel.unsubscribedSubscriberIds.length;
    funnel.unsubscribedSubscriberIds = funnel.unsubscribedSubscriberIds.filter((id: number) => id !== chatId);
    if (funnel.unsubscribedSubscriberIds.length !== unsubscribedBefore) {
      updated = true;
    }

    if (updated) {
      funnel.subscribers = funnel.subscriberIds.length;
      funnel.activeSubscribers = funnel.activeSubscriberIds.length;
      await saveFunnel(funnel.id, funnel);
    }
  }

  async function startReminders(bot: TelegramBot, chatId: number, funnelId: string, stage: FunnelStage) {
    const previousState = getUserState(chatId, funnelId);
    clearRuntimeTimeouts(previousState);

    const state = ensureUserState(chatId, funnelId, stage);
    state.funnelId = funnelId;
    state.currentStageId = stage.id;
    state.currentStageIndex = stage.index || 0;
    state.timeouts = [];
    state.finished = false;
    state.lastActionAt = new Date().toISOString();
    cancelPendingReminderJobs(state);
    recordUserEvent(chatId, 'stage_sent', funnelId, stage.id);

    const stageReminders = (stage.reminders || []).filter((reminder: any) => reminder.condition !== "not_paid");
    await scheduleReminderJobs(bot, chatId, funnelId, stage, stageReminders);
    // Автопереход не зависит от выключателя автонапоминаний: напоминание — это
    // толчок, а переход — сам шаг воронки.
    await scheduleStageAdvance(bot, chatId, funnelId, stage);
  }

  function cancelStageReminders(chatId: number, funnelId: string, stageId: string) {
    const state = getUserState(chatId, funnelId);
    if (!state) return;
    clearRuntimeTimeouts(state);
    if (cancelPendingReminderJobs(state, funnelId, stageId)) {
      void persistUserState(chatId, state);
    }
  }

  function schedulePaymentReminders(bot: TelegramBot, chatId: number, funnelId: string, stage: FunnelStage) {
    const state = ensureUserState(chatId, funnelId, stage);
    if (state.purchaseStatus === "paid") return;

    const paymentReminders = (stage.reminders || []).filter((reminder: any) => reminder.condition === "not_paid");
    void scheduleReminderJobs(bot, chatId, funnelId, stage, paymentReminders)
      .catch((error) => console.error("Failed to schedule payment reminders:", error));
  }

  function resumePendingReminders() {
    for (const [key, state] of userStates) {
      const chatId = Number(key.split(":")[0]);
      if (!Number.isSafeInteger(chatId)) continue;
      clearRuntimeTimeouts(state);

      for (const job of state.reminderJobs) {
        if (job.status !== "pending") continue;
        const funnel = activeFunnels.get(job.funnelId);
        const stage = funnel?.stages?.find((s: FunnelStage) => s.id === job.stageId);
        const botId = funnel?.connectedBotId;
        const bot = botId ? botInstances.get(botId) : null;

        // У автоперехода нет напоминания — его целью служит следующий этап.
        // Пропал он или само напоминание — задача больше не имеет смысла.
        const target = job.kind === "advance"
          ? stage?.nextStage?.targetStageId
          : stage?.reminders?.find((item: Reminder) => item.id === job.reminderId)?.id;

        if (!funnel || !stage || !target) {
          if (markReminderJob(state, job.id, "skipped")) {
            void persistUserState(chatId, state);
          }
          continue;
        }

        if (!bot) {
          console.warn(`[REMINDER] Bot is not running for pending job ${job.id}`);
          continue;
        }

        scheduleReminderTimeout(bot, chatId, state, job.id);
      }
    }
  }


  // Telegram обрезает callback_data длиннее 64 байт, поэтому вопрос с длинными
  // идентификаторами лучше не отправлять вовсе, чем отправить со сломанными кнопками.
  function buildQuestionKeyboard(question: StageQuestion) {
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (const option of question.options || []) {
      const data = `ans:${question.id}:${option.id}`;
      if (Buffer.byteLength(data, "utf8") > 64) {
        console.warn(`[QUESTION] Слишком длинный идентификатор в вопросе ${question.id}, вариант ${option.id} пропущен`);
        continue;
      }
      rows.push([{ text: option.label, callback_data: data }]);
    }
    return rows;
  }

  // Задаём первый вопрос этапа, на который человек ещё не ответил.

  // Telegram отдаёт метку диплинка как «/start <payload>»: t.me/бот?start=ad_vk_01.
  // Разрешённые символы у самого Telegram — латиница, цифры, дефис и подчёркивание,
  // но полагаться на это нельзя: payload приходит из внешнего мира.
  function parseStartPayload(text?: string) {
    const raw = (text || "").trim().split(/\s+/)[1] || "";
    return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  }

  // Источник записывается один раз. Человек, пришедший по объявлению, а через
  // месяц нажавший /start из закладок, не должен «переехать» в другой источник.
  function rememberSource(state: UserStageState, payload: string) {
    if (!payload) return false;
    if (!state.profile) state.profile = { answers: {} };
    if (state.profile.source?.value) return false;
    state.profile.source = { value: payload, at: new Date().toISOString() };
    return true;
  }

  async function sendNextQuestion(bot: TelegramBot, chatId: number, stage: FunnelStage, state: UserStageState) {
    const pending = (stage.questions || []).find((question) => !state.profile?.answers?.[question.key]);
    if (!pending) return;

    const keyboard = buildQuestionKeyboard(pending);
    if (keyboard.length === 0) return;

    const firstName = globalSubscribers.get(chatId)?.firstName || "друг";
    const text = pending.text.replace(/{name}/g, firstName);
    await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    const funnel = activeFunnels.get(state.funnelId);
    await logMessage(chatId, "bot", text, undefined, {
      botId: funnel?.connectedBotId,
      funnelId: state.funnelId,
    });
  }


  /**
   * Сохраняет ответ подписчика на вопрос этапа и продолжает воронку:
   * уводит на ветку варианта либо задаёт следующий вопрос.
   */
  async function handleQuestionAnswer(
    bot: TelegramBot,
    entry: BotEntry,
    chatId: number,
    data: string,
    queryId: string,
    message?: { message_id: number; text?: string },
  ) {
    const [, questionId, optionId] = data.split(":");
    const funnel = Array.from(activeFunnels.values()).find((f) => f.connectedBotId === entry.id);
    const state = funnel ? getUserState(chatId, funnel.id) : undefined;
    const stage = funnel?.stages?.find((s: FunnelStage) => s.id === state?.currentStageId);
    const question = stage?.questions?.find((item) => item.id === questionId);
    const option = question?.options?.find((item) => item.id === optionId);

    if (!funnel || !state || !stage || !question || !option) {
      await bot.answerCallbackQuery(queryId).catch(console.error);
      return;
    }

    state.profile = {
      ...(state.profile || { answers: {} }),
      answers: {
        ...(state.profile?.answers || {}),
        [question.key]: {
          questionId: question.id,
          optionId: option.id,
          label: option.label,
          at: new Date().toISOString(),
        },
      },
    };
    state.lastActionAt = new Date().toISOString();
    awardQuestionBonus?.(state, funnel.id, question.key);
    await persistUserState(chatId, state);

    // Показываем выбор в самом сообщении и убираем кнопки: ответить дважды нельзя,
    // а человек видит, что именно он выбрал.
    if (message) {
      await bot.editMessageText(`${message.text || question.text}\n\n✅ ${option.label}`, {
        chat_id: chatId,
        message_id: message.message_id,
      }).catch(() => undefined);
    }
    await bot.answerCallbackQuery(queryId).catch(console.error);

    if (option.targetStageId) {
      const target = funnel.stages?.find((s: FunnelStage) => s.id === option.targetStageId);
      if (target) {
        await sendStageMessage(bot, chatId, funnel, target);
        return;
      }
    }

    await sendNextQuestion(bot, chatId, stage, state);
  }

  async function sendStageMessage(bot: TelegramBot, chatId: number, funnel: Funnel, stage: FunnelStage) {
    await deliverStageMessage(bot, chatId, funnel, stage);
    await startReminders(bot, chatId, funnel.id, stage);

    const state = getUserState(chatId, funnel.id);
    if (state) await sendNextQuestion(bot, chatId, stage, state);
  }

  async function startBotInstance(entry: BotEntry) {
    stopBotById(entry.id);

    if (!entry.token || entry.token.includes("YOUR_")) {
      console.warn(`Bot ${entry.name}: invalid token, skipping.`);
      return;
    }

    const webhook = getTelegramWebhook();
    console.log(`Starting bot: ${entry.firstName} (@${entry.name}) [${webhook ? "webhook" : "polling"}]...`);
    const bot = new TelegramBot(entry.token, { polling: false });

    bot.on("polling_error", (error: any) => {
      if (error.code === "EFATAL" && error.message?.includes("ECONNRESET")) return;
      if (error.code === "ETELEGRAM" && error.message?.includes("409 Conflict")) {
        if (error.message?.includes("webhook is active")) {
          console.warn(`[BOT] @${entry.name}: у бота включён webhook (вероятно, production). Локальный polling не будет получать сообщения — используйте отдельного тестового бота для разработки.`);
        }
        return;
      }
      if (error.code === "ETELEGRAM" && error.message?.includes("401 Unauthorized")) {
        console.error(`Bot ${entry.name}: Invalid token!`);
        entry.active = false;
        void saveSettings().catch((saveError) => console.error("Failed to persist disabled bot state:", saveError));
        stopBotById(entry.id);
        return;
      }
      console.error(`Bot ${entry.name} polling error:`, error.message);
    });

    bot.onText(START_COMMAND, (msg) => runBotTask("/start handler", async () => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || "друг";
      const startPayload = parseStartPayload(msg.text);
      console.log(`[BOT] /start received from ${firstName} (chatId: ${chatId})${startPayload ? ` source=${startPayload}` : ""}`);

      const funnels = Array.from(activeFunnels.values());
      const activeFunnel = funnels.find((f) => f.connectedBotId === entry.id);

      if (activeFunnel && activeFunnel.stages?.length > 0) {
        const firstStage = activeFunnel.stages[0];
        await setFunnelMenuButton(bot, activeFunnel, chatId);
        const existingState = ensureUserState(chatId, activeFunnel.id, firstStage);
        if (rememberSource(existingState, startPayload)) {
          await persistUserState(chatId, existingState);
        }
        const hasProgress = existingState?.funnelId === activeFunnel.id && (
          existingState.sentStages.length > 0
          || existingState.openedStages.length > 0
          || existingState.viewedStages.length > 0
          || existingState.completedStages.length > 0
        );

        if (existingState && hasProgress) {
          await sendResumeMessage(bot, chatId, activeFunnel, firstName, existingState);
          await trackUserActivity(entry, chatId, activeFunnel, msg.from);
          return;
        }

        await deliverStageMessage(bot, chatId, activeFunnel, firstStage, firstName);
        await startReminders(bot, chatId, activeFunnel.id, firstStage);
        await trackUserActivity(entry, chatId, activeFunnel, msg.from);
      } else {
        const fallbackText = `Привет, ${firstName}! 👋\n\nВоронка ещё не настроена.`;
        await bot.sendMessage(chatId, fallbackText);
        await logMessage(chatId, 'bot', fallbackText, undefined, { botId: entry.id });
        if (activeFunnel) await trackUserActivity(entry, chatId, activeFunnel, msg.from);
      }
    }));

    function businessFunnelForChat(chatId: number) {
      return selectFunnelForChat(
        Array.from(activeFunnels.values()),
        entry.id,
        (funnelId) => getUserState(chatId, funnelId),
      );
    }

    async function checkAndHandleHomework(
      targetBot: TelegramBot,
      chatId: number,
      text: string,
      funnel: Funnel,
      from?: { id: number; first_name?: string; last_name?: string; username?: string },
      businessConnectionId?: string,
    ): Promise<boolean> {

      const state = getUserState(chatId, funnel.id);
      const currentStage = funnel.stages.find((s) => s.id === state?.currentStageId) || funnel.stages[state?.currentStageIndex || 0];
      if (!currentStage || !currentStage.requireHomework) {
        return false;
      }

      const existingHw = state?.profile.homeworks?.[currentStage.id];
      if (existingHw?.status === "approved") {
        return false;
      }

      const criteria = currentStage.homeworkCriteria || "Проверь, что в сообщении есть ссылка на выполненный проект или ответ на задание урока.";

      let aiSummary = "Ответ получен и ожидает проверки автором.";
      try {
        const apiKey = getAssistantApiKey();
        if (apiKey) {
          const anthropic = new Anthropic({ apiKey, baseURL: DEEPSEEK_API_BASE_URL });
          const prompt = `Ты проверяешь домашнее задание студента по уроку "${currentStage.title}".\nКритерии проверки: ${criteria}\nОтвет студента: "${text}"\n\nДай доброжелательный первичный разбор (1-2 коротких предложения): что сделано хорошо, выполнено ли задание. Напиши, что работа передана автору курса на подтверждение.`;
          const response = await anthropic.messages.create({
            model: DEEPSEEK_REVIEW_MODEL,
            max_tokens: 250,
            messages: [{ role: "user", content: prompt }],
          });
          const firstBlock = response.content[0];
          if (firstBlock && firstBlock.type === "text") {
            aiSummary = firstBlock.text.trim();
          }
        }
      } catch (err) {
        console.warn("[HOMEWORK] Ошибка ИИ-оценки ДЗ:", err);
      }

      const submission = {
        id: `hw-${Date.now()}`,
        stageId: currentStage.id,
        stageTitle: currentStage.title,
        submittedAt: new Date().toISOString(),
        content: text,
        aiFeedback: aiSummary,
        status: "pending_review" as const,
      };

      if (saveHomeworkSubmission) {
        await saveHomeworkSubmission(chatId, funnel.id, submission);
      }

      const studentReply =
        `🎓 <b>Домашнее задание принято!</b>\n\n` +
        `🤖 <i>Первичный разбор:</i> ${escapeTelegramHtml(aiSummary)}\n\n` +
        `Я передал твою работу автору курса. Скоро он подключится с обратной связью и откроет следующий урок! 🚀`;

      const sendOpts: any = { parse_mode: "HTML" };
      if (businessConnectionId) {
        sendOpts.business_connection_id = businessConnectionId;
      }

      try {
        await targetBot.sendMessage(chatId, studentReply, sendOpts);
      } catch (sendErr) {
        console.warn("[HOMEWORK] Не удалось отправить ответ студенту:", sendErr);
      }

      const studentName = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "Студент";
      const usernameText = from?.username ? `@${from.username}` : `ID: ${chatId}`;
      const pmLink = from?.username ? `https://t.me/${from.username}` : `tg://user?id=${chatId}`;

      // Всё, что подставляется ниже, пришло извне: текст студента, его имя из
      // профиля Telegram, название воронки и ответ модели. Без экранирования
      // один "<" в задании ломал отправку карточки, а имя вида "<b>…</b>"
      // подрисовывало разметку в сообщение, под которым куратор жмёт кнопки.
      const adminCard =
        `🎓 <b>Новая сдача ДЗ!</b>\n` +
        `Урок: <b>${escapeTelegramHtml(currentStage.title || currentStage.id)}</b> `
        + `(воронка <i>${escapeTelegramHtml(funnel.title || funnel.id)}</i>)\n` +
        `Студент: <b>${escapeTelegramHtml(studentName)}</b> (${escapeTelegramHtml(usernameText)})\n\n` +
        `📝 <b>Ответ студента:</b>\n` +
        `<blockquote>${escapeTelegramHtml(text.slice(0, 400))}</blockquote>\n\n` +
        `🤖 <b>Резюме ИИ:</b>\n` +
        `<i>${escapeTelegramHtml(aiSummary)}</i>`;

      const inlineKeyboard = [
        [
          { text: "💬 Написать в ЛС", url: pmLink },
        ],
        [
          { text: "✅ Одобрить и открыть урок", callback_data: `hw_appr:${chatId}:${funnel.id}:${currentStage.id}` },
          { text: "❌ На доработку", callback_data: `hw_rej:${chatId}:${funnel.id}:${currentStage.id}` },
        ],
      ];

      await notifyAdmin(adminCard, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      });

      return true;
    }

    bot.on("callback_query", (query) => runBotTask("callback query handler", async () => {
      if (!query.data || !query.message) return;
      const chatId = query.message.chat.id;
      const firstName = query.from.first_name || "друг";

      if (query.data.startsWith("hw_appr:") || query.data.startsWith("hw_rej:")) {
        const parts = query.data.split(":");
        const action = parts[0] === "hw_appr" ? "approved" : "rejected";
        const targetChatId = Number(parts[1]);
        const funnelId = parts[2];
        const stageId = parts[3];

        const funnel = activeFunnels.get(funnelId);
        const currentStage = funnel?.stages.find((s) => s.id === stageId);
        const stageTitle = currentStage?.title || stageId;

        if (action === "approved") {
          if (updateHomeworkStatus) {
            const result = await updateHomeworkStatus(targetChatId, funnelId, stageId, "approved");
            try {
              const congratsText = `🎉 <b>Твоё домашнее задание по уроку «${escapeTelegramHtml(stageTitle)}» одобрено автором!</b>\n\nСледующий урок уже открыт — приятного обучения! 🚀`;
              await bot.sendMessage(targetChatId, congratsText, { parse_mode: "HTML" });

              if (result.nextStageId && funnel) {
                const nextStage = funnel.stages.find((s) => s.id === result.nextStageId);
                if (nextStage) {
                  await deliverStageMessage(bot, targetChatId, funnel, nextStage);
                }
              }
            } catch (e) {
              console.warn("[HOMEWORK] Ошибка отправки поздравления студенту:", e);
            }
          }

          try {
            // query.message.text приходит уже без разметки, поэтому обратно в
            // HTML его нужно экранировать — иначе "<" из задания рвёт правку.
            const originalText = escapeTelegramHtml((query.message as any)?.text || "Домашнее задание");
            await bot.editMessageText(
              `${originalText}\n\n✅ <b>ОДОБРЕНО</b> (${new Date().toLocaleTimeString("ru-RU")})`,
              {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: "HTML",
              }
            );
          } catch {}
        } else {
          if (updateHomeworkStatus) {
            await updateHomeworkStatus(targetChatId, funnelId, stageId, "rejected");
            try {
              const rejectMsg = `По домашнему заданию к уроку «${escapeTelegramHtml(stageTitle)}» требуется доработка ✍️ Пожалуйста, посмотри комментарий автора и пришли обновлённую версию!`;
              await bot.sendMessage(targetChatId, rejectMsg, { parse_mode: "HTML" });
            } catch {}
          }

          try {
            const originalText = escapeTelegramHtml((query.message as any)?.text || "Домашнее задание");
            await bot.editMessageText(
              `${originalText}\n\n❌ <b>ОТПРАВЛЕНО НА ДОРАБОТКУ</b> (${new Date().toLocaleTimeString("ru-RU")})`,
              {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: "HTML",
              }
            );
          } catch {}
        }


        await bot.answerCallbackQuery(query.id, { text: action === "approved" ? "Задание одобрено!" : "Отправлено на доработку" });
        return;
      }


      if (query.data.startsWith("ans:")) {
        await handleQuestionAnswer(bot, entry, chatId, query.data, query.id, query.message);
        return;
      }

      if (query.data.startsWith("stage_") || query.data.startsWith("next_")) {
        const stageId = query.data.replace("stage_", "").replace("next_", "");

        const funnel = Array.from(activeFunnels.values()).find((f) => f.connectedBotId === entry.id);
        if (funnel) {
          await setFunnelMenuButton(bot, funnel, chatId);
          const stage = funnel.stages?.find((s: any) => s.id === stageId);
          if (stage) {
            const oldState = getUserState(chatId, funnel.id);
            clearRuntimeTimeouts(oldState);

            await deliverStageMessage(bot, chatId, funnel, stage, firstName);
            await startReminders(bot, chatId, funnel.id, stage);
            await trackUserActivity(entry, chatId, funnel, query.from);
          }
        }
      }

      await bot.answerCallbackQuery(query.id).catch(console.error);
    }));

    bot.on("message", (msg) => runBotTask("message handler", async () => {
      // У /start свой хендлер. Раньше отсекался только точный «/start», поэтому
      // диплинк «/start ad_vk_01» проскакивал сюда: человек получал этап и следом
      // ответ ассистента на текст самой команды. Остальные команды пропускаем
      // дальше — на них некому ответить, кроме ассистента и оператора.
      if (isStartCommand(msg.text)) return;

      const funnel = Array.from(activeFunnels.values()).find((item) => item.connectedBotId === entry.id);
      await trackUserActivity(entry, msg.chat.id, funnel, msg.from);

      let media: MessageEntry["media"] | undefined;
      if (msg.photo?.length) {
        media = { type: "photo", fileId: msg.photo[msg.photo.length - 1].file_id, botId: entry.id };
      } else if (msg.video) {
        media = { type: "video", fileId: msg.video.file_id, botId: entry.id, mimeType: msg.video.mime_type };
      } else if (msg.video_note) {
        media = { type: "videoNote", fileId: msg.video_note.file_id, botId: entry.id };
      } else if (msg.animation) {
        media = { type: "animation", fileId: msg.animation.file_id, botId: entry.id, fileName: msg.animation.file_name, mimeType: msg.animation.mime_type };
      } else if (msg.document) {
        media = { type: "document", fileId: msg.document.file_id, botId: entry.id, fileName: msg.document.file_name, mimeType: msg.document.mime_type };
      } else if (msg.sticker) {
        media = { type: "sticker", fileId: msg.sticker.file_id, botId: entry.id };
      } else if (msg.voice) {
        media = { type: "voice", fileId: msg.voice.file_id, botId: entry.id, mimeType: msg.voice.mime_type };
      } else if (msg.audio) {
        media = { type: "audio", fileId: msg.audio.file_id, botId: entry.id, fileName: msg.audio.file_name, mimeType: msg.audio.mime_type };
      }

      const messageText = msg.text || msg.caption || "";
      if (messageText || media) {
        await logMessage(msg.chat.id, 'user', messageText, media, {
          botId: entry.id,
          funnelId: funnel?.id,
        });
      }

      if (msg.web_app_data) {
        console.log(`Web App data from ${msg.chat.id}:`, msg.web_app_data.data);
      }

      // Обработка текстовых и голосовых сообщений
      let effectiveText = msg.text || "";

      if (!effectiveText && msg.voice && funnel) {
        try {
          const fileLink = await bot.getFileLink(msg.voice.file_id);
          const response = await fetch(fileLink);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const transcribed = await transcribeVoiceNote(
              buffer,
              msg.voice.mime_type || "audio/ogg",
              getTranscriptionKeys(),
            );

            if (transcribed) {
              effectiveText = transcribed;
              await logMessage(msg.chat.id, 'user', `[🎙️ Голосовое сообщение]: ${transcribed}`, undefined, {
                botId: entry.id,
                funnelId: funnel?.id,
              });
            }
          }
        } catch (voiceError) {
          console.warn("[VOICE] Ошибка транскрибации голосового сообщения:", voiceError);
        }

        if (!effectiveText) {
          try {
            await bot.sendMessage(
              msg.chat.id,
              "Я пока не умею слушать голосовые сообщения 🎧 Напишите, пожалуйста, текстом, и я сразу отвечу!",
            );
          } catch (replyErr) {
            console.warn("[VOICE] Не удалось отправить автоответ на голосовое:", replyErr);
          }
        }
      }

      if (effectiveText) {
        if (funnel) {
          const handledAsHw = await checkAndHandleHomework(bot, msg.chat.id, effectiveText, funnel, msg.from);
          if (!handledAsHw && handleIncomingUserMessage) {
            await handleIncomingUserMessage(bot, msg.chat.id, effectiveText, funnel);
          }
        }
      }
    }));

    // Telegram Business: подключение/отключение бота к личному бизнес-аккаунту
    (bot as any).on("business_connection", (connection: any) => runBotTask("business connection handler", async () => {
      console.log(`[BUSINESS] Бот @${entry.name} подключен к аккаунту ${connection.user?.first_name} (ID: ${connection.user_chat_id}), can_reply: ${connection.can_reply}`);
      if (connection.is_enabled && connection.user_chat_id) {
        void notifyAdmin(
          `🤝 <b>Telegram Business подключен!</b>\n` +
          `Аккаунт: <b>${escapeTelegramHtml(connection.user?.first_name || "")}</b> `
          + `(@${escapeTelegramHtml(connection.user?.username || '—')}, ID: <code>${connection.user_chat_id}</code>)\n` +
          `Права на ответы: <i>${connection.can_reply ? 'Да' : 'Нет'}</i>`
        );
      }
    }));

    // Telegram Business: входящие личные сообщения из бизнес-чата
    (bot as any).on("business_message", (msg: any) => runBotTask("business message handler", async () => {
      if (!isIncomingBusinessMessage(msg)) return;
      const studentChatId = msg.chat.id;

      const funnel = businessFunnelForChat(studentChatId);

      const messageText = msg.text || msg.caption || "";
      if (messageText) {
        await logMessage(studentChatId, 'user', `[Telegram Business]: ${messageText}`, undefined, {
          botId: entry.id,
          funnelId: funnel?.id,
        });
      }

      // Без воронки дальше идти некуда: и сдача ДЗ, и ответ ассистента живут
      // в конкретном курсе. Само сообщение уже записано в историю диалога, а
      // в подписчики воронки человека не добавляем — неизвестно, в какую.
      if (!funnel) return;

      await trackUserActivity(entry, studentChatId, funnel, msg.from);

      if (messageText) {
        const handledAsHw = await checkAndHandleHomework(
          bot,
          studentChatId,
          messageText,
          funnel,
          msg.from,
          msg.business_connection_id,
        );

        if (!handledAsHw && handleIncomingUserMessage) {
          await handleIncomingUserMessage(bot, studentChatId, messageText, funnel);
        }
      }
    }));

    // Telegram Business: собеседник поправил уже отправленное сообщение.
    (bot as any).on("edited_business_message", (msg: any) => runBotTask("edited business message handler", async () => {
      if (!isIncomingBusinessMessage(msg)) return;
      const messageText = msg.text || msg.caption || "";
      if (!messageText) return;

      const chatId = msg.chat.id;
      // Правку пишем в историю, но заново не разбираем: иначе одна и та же
      // домашка уходила бы куратору второй карточкой, а ассистент отвечал бы
      // на исправленную опечатку как на новое сообщение.
      await logMessage(chatId, 'user', `[Telegram Business, правка]: ${messageText}`, undefined, {
        botId: entry.id,
        funnelId: businessFunnelForChat(chatId)?.id,
      });
    }));

    // Telegram Business: сообщения в чате удалены. Кто удалил — Telegram не
    // сообщает, поэтому фиксируем только факт: без него история диалога в
    // админке расходится с тем, что видят собеседники.
    (bot as any).on("deleted_business_messages", (update: any) => runBotTask("deleted business messages handler", async () => {
      const chatId = update?.chat?.id;
      if (typeof chatId !== "number") return;
      const deletedCount = Array.isArray(update.message_ids) ? update.message_ids.length : 0;
      if (!deletedCount) return;

      await logMessage(chatId, 'user', `[Telegram Business]: удалено сообщений в чате — ${deletedCount}`, undefined, {
        botId: entry.id,
        funnelId: businessFunnelForChat(chatId)?.id,
      });
    }));

    bot.on('my_chat_member', (msg) => runBotTask("membership handler", async () => {
      const chatId = msg.chat.id;
      const status = msg.new_chat_member?.status;

      for (const funnel of activeFunnels.values()) {
        if (funnel.connectedBotId === entry.id && funnel.subscriberIds?.includes(chatId)) {
          if (!funnel.activeSubscriberIds) funnel.activeSubscriberIds = [...funnel.subscriberIds];
          if (!funnel.unsubscribedSubscriberIds) funnel.unsubscribedSubscriberIds = [];

          if (status === 'kicked' || status === 'left') {
            funnel.activeSubscriberIds = funnel.activeSubscriberIds.filter((id: number) => id !== chatId);
            if (!funnel.unsubscribedSubscriberIds.includes(chatId)) {
              funnel.unsubscribedSubscriberIds.push(chatId);
            }
            void notifyAdmin(`🚫 <b>Подписчик заблокировал бота</b>\nПользователь ID: <code>${chatId}</code>\nБот: @${escapeTelegramHtml(entry.name)}\nВоронка: <i>${escapeTelegramHtml(funnel.title || funnel.id)}</i>`);
          } else if (status === 'member' || status === 'administrator' || status === 'creator') {

            if (!funnel.activeSubscriberIds.includes(chatId)) {
              funnel.activeSubscriberIds.push(chatId);
            }
            funnel.unsubscribedSubscriberIds = funnel.unsubscribedSubscriberIds.filter((id: number) => id !== chatId);
          }

          funnel.activeSubscribers = funnel.activeSubscriberIds.length;
          await saveFunnel(funnel.id, funnel);
          const subscriber = globalSubscribers.get(chatId);
          if (subscriber) {
            updateSubscriberBotState(subscriber, entry.id, {
              blockedAt: status === 'kicked' || status === 'left'
                ? new Date().toISOString()
                : null,
            });
            await saveSubscriber(subscriber);
          }
          break;
        }
      }
    }));

    try {
      const allowedUpdates: any = [
        "message",
        "edited_message",
        "callback_query",
        "my_chat_member",
        "business_connection",
        "business_message",
        "edited_business_message",
        "deleted_business_messages",
      ];
      if (webhook) {
        const webhookUrl = `${webhook.baseUrl}/api/webhook/telegram/${entry.id}`;
        await bot.setWebHook(webhookUrl, { secret_token: webhook.secret, allowed_updates: allowedUpdates } as any);
        console.log(`[BOT] Webhook set for @${entry.name}: ${webhookUrl}`);
      } else {
        // Webhook специально НЕ удаляем: если этот же токен работает в production
        // через webhook, локальный deleteWebHook убил бы прод. Для локальной
        // разработки используйте отдельного тестового бота.
        void bot.startPolling({ params: { allowed_updates: allowedUpdates } } as any).catch((error: any) => {
          entry.active = false;
          stopBotById(entry.id);
          void saveSettings().catch(() => undefined);
          console.error(`[BOT] Failed to start polling for @${entry.name}:`, error?.message || error);
        });
      }

      botInstances.set(entry.id, bot);
    } catch (error: any) {
      entry.active = false;
      bot.removeAllListeners();
      await saveSettings().catch(() => undefined);
      console.error(`[BOT] Failed to start @${entry.name}:`, error?.message || error);
      throw error;
    }

    const initialFunnel = Array.from(activeFunnels.values()).find((f) => f.connectedBotId === entry.id);
    if (initialFunnel) {
      void setFunnelMenuButton(bot, initialFunnel)
        .catch((error) => console.error("Failed to initialize the Telegram menu button:", error));
    }

    entry.active = true;
    void saveSettings().catch((error) => console.error("Failed to persist bot settings:", error));
    console.log(`Bot started: ${entry.firstName} (@${entry.name}) ✓`);
  }

  async function verifyBotToken(token: string): Promise<{ ok: boolean; username?: string; firstName?: string }> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) {
        return { ok: true, username: data.result.username, firstName: data.result.first_name };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  // Про непрочитанные уведомления говорим один раз за запуск: иначе владелец
  // видит в боте «работа передана автору», а карточка не уходит никуда, и
  // понять это можно только по пустому разделу домашних заданий.
  let missingAdminChatReported = false;

  async function notifyAdmin(message: string, options?: { parse_mode?: "HTML" | "Markdown" | "MarkdownV2"; reply_markup?: any }) {
    const settings = getSettings();
    if (!settings.notifications) return;
    const adminChatId = settings.adminTelegramChatId?.trim();
    if (!adminChatId) {
      if (!missingAdminChatReported) {
        missingAdminChatReported = true;
        console.warn(
          "⚠️ Уведомления администратору не отправляются: в настройках не указан Telegram Chat ID. "
          + "Сдачи домашних заданий и оплаты видны только в админке.",
        );
      }
      return;
    }

    let bot: TelegramBot | undefined;
    for (const b of botInstances.values()) {
      bot = b;
      break;
    }
    if (!bot) return;

    try {
      await bot.sendMessage(adminChatId, message, {
        parse_mode: options?.parse_mode || "HTML",
        reply_markup: options?.reply_markup,
      });
    } catch (error: any) {
      console.error("[NOTIFY_ADMIN] Ошибка отправки уведомления администратору:", error?.message || error);
    }
  }

  return {
    botInstances,
    cancelStageReminders,
    handleQuestionAnswer,
    notifyAdmin,
    parseStartPayload,
    rememberSource,
    resumePendingReminders,
    sendNextQuestion,
    sendStageMessage,
    schedulePaymentReminders,
    startBotInstance,
    stopAllBots,
    stopBotById,
    verifyBotToken,
  };
}

