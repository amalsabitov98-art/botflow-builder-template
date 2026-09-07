import type TelegramBot from "node-telegram-bot-api";
import type { Funnel, MessageEntry, SubscriberProfile } from "../types";
import type { NurtureDecision } from "./assistant";
import type { UserStageState } from "./progress";
import { getScopedMessageHistory, isAwaitingHumanReply, isBotBlocked } from "./botScope";

// Значения по умолчанию. Всё это — предохранители: они проверяются здесь, в коде,
// а не в промпте, поэтому модель не может их обойти, как бы её ни просили.
const DEFAULT_MAX_TOUCHES = 6;
const DEFAULT_MIN_GAP_HOURS = 72;
const DEFAULT_WINDOW_DAYS = 30;
// Дольше двух недель ждать бессмысленно: человек уже остыл.
const MAX_WAIT_HOURS = 24 * 14;
// Ночью не пишем. Часового пояса подписчика Telegram не даёт, поэтому окно
// считается по времени сервера — это приближение, а не точность.
const QUIET_FROM_HOUR = 21;
const QUIET_TO_HOUR = 10;
// Сколько подписчиков обрабатываем за один тик: предел расходов и нагрузки.
const MAX_PER_TICK = 20;
// Дожим не знает про рассылки и напоминания, но человек их не различает:
// для него это просто сообщения от бота. Держим паузу после любого из них.
const QUIET_AFTER_ANY_MESSAGE_HOURS = 24;

interface NurtureDeps {
  activeFunnels: Map<string, Funnel>;
  botInstances: Map<string, TelegramBot>;
  globalSubscribers: Map<number, SubscriberProfile>;
  logMessage: (chatId: number, from: 'bot' | 'user', text: string, media?: MessageEntry["media"], scope?: { botId?: string; funnelId?: string }) => Promise<void>;
  messageHistory: Map<string, MessageEntry[]>;
  now?: () => Date;
  persistUserState: (chatId: number, state: UserStageState) => Promise<void>;
  planNurtureTouch: (funnel: Funnel, chatId: number) => Promise<NurtureDecision>;
  userStates: Map<string, UserStageState>;
}

interface Candidate {
  chatId: number;
  funnel: Funnel;
  state: UserStageState;
  bot: TelegramBot;
}

export function createNurtureService({
  activeFunnels,
  botInstances,
  globalSubscribers,
  logMessage,
  messageHistory,
  now = () => new Date(),
  persistUserState,
  planNurtureTouch,
  userStates,
}: NurtureDeps) {
  function hoursBetween(from: string | undefined, to: Date) {
    if (!from) return Number.POSITIVE_INFINITY;
    const started = new Date(from).getTime();
    if (!Number.isFinite(started)) return Number.POSITIVE_INFINITY;
    return (to.getTime() - started) / 3_600_000;
  }

  function isQuietHour(date: Date) {
    const hour = date.getHours();
    return hour >= QUIET_FROM_HOUR || hour < QUIET_TO_HOUR;
  }

  // Ближайшее время, когда писать снова прилично.
  function nextAllowedTime(date: Date) {
    const next = new Date(date);
    if (next.getHours() >= QUIET_FROM_HOUR) next.setDate(next.getDate() + 1);
    next.setHours(QUIET_TO_HOUR, 0, 0, 0);
    return next;
  }

  // Когда бот последний раз что-то писал этому человеку — рассылкой,
  // напоминанием или прошлым касанием. Всё это для него один поток.
  function hoursSinceLastBotMessage(chatId: number, botId: string | undefined, at: Date) {
    const history = getScopedMessageHistory(messageHistory, chatId, botId);
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].from !== "bot") continue;
      return hoursBetween(history[index].timestamp, at);
    }
    return Number.POSITIVE_INFINITY;
  }

  function ensureNurture(state: UserStageState) {
    if (!state.profile) state.profile = { answers: {} };
    if (!state.profile.nurture) state.profile.nurture = { touches: [] };
    return state.profile.nurture;
  }

  async function stop(chatId: number, state: UserStageState, reason: string) {
    ensureNurture(state).stoppedReason = reason;
    await persistUserState(chatId, state);
    console.log(`[NURTURE] ${chatId}: дожим прекращён — ${reason}`);
  }

  async function scheduleNext(chatId: number, state: UserStageState, at: Date) {
    ensureNurture(state).nextTouchAt = at.toISOString();
    await persistUserState(chatId, state);
  }

  function collectCandidates(at: Date): Candidate[] {
    const candidates: Candidate[] = [];

    for (const [key, state] of userStates) {
      const chatId = Number(key.split(":")[0]);
      if (!Number.isSafeInteger(chatId)) continue;

      const funnel = activeFunnels.get(state.funnelId);
      const assistant = funnel?.assistant;
      if (!funnel || !assistant?.enabled || !assistant.nurtureEnabled) continue;

      // Купил — дожимать больше нечего.
      if (state.purchaseStatus === "paid") continue;

      const subscriber = globalSubscribers.get(chatId);
      if (!subscriber) continue;
      // Заблокировал бота или ждёт живого оператора — не трогаем.
      if (isBotBlocked(subscriber, funnel.connectedBotId)
        || isAwaitingHumanReply(subscriber, funnel.connectedBotId)) continue;

      const nurture = state.profile?.nurture;
      if (nurture?.stoppedReason) continue;

      const minGapHours = assistant.nurtureMinGapHours || DEFAULT_MIN_GAP_HOURS;
      const due = nurture?.nextTouchAt
        ? new Date(nurture.nextTouchAt).getTime() <= at.getTime()
        // Первое касание: человек молчит дольше минимального интервала.
        : hoursBetween(state.lastActionAt, at) >= minGapHours;
      if (!due) continue;

      const botId = funnel.connectedBotId;
      const bot = botId ? botInstances.get(botId) : null;
      if (!bot) continue;

      candidates.push({ chatId, funnel, state, bot });
    }

    return candidates.slice(0, MAX_PER_TICK);
  }

  async function processCandidate({ chatId, funnel, state, bot }: Candidate, at: Date) {
    const assistant = funnel.assistant!;
    const maxTouches = assistant.nurtureMaxTouches || DEFAULT_MAX_TOUCHES;
    const minGapHours = assistant.nurtureMinGapHours || DEFAULT_MIN_GAP_HOURS;
    const windowDays = assistant.nurtureWindowDays || DEFAULT_WINDOW_DAYS;
    const nurture = ensureNurture(state);

    if (nurture.touches.length >= maxTouches) {
      await stop(chatId, state, `исчерпан лимит касаний (${maxTouches})`);
      return;
    }
    if (nurture.startedAt && hoursBetween(nurture.startedAt, at) > windowDays * 24) {
      await stop(chatId, state, `закончилось окно дожима (${windowDays} дн.)`);
      return;
    }
    // В тихие часы не пишем, а переносим на утро.
    if (isQuietHour(at)) {
      await scheduleNext(chatId, state, nextAllowedTime(at));
      return;
    }
    // Недавняя рассылка или напоминание — не наслаиваемся сверху.
    const sinceLastMessage = hoursSinceLastBotMessage(chatId, funnel.connectedBotId, at);
    if (sinceLastMessage < QUIET_AFTER_ANY_MESSAGE_HOURS) {
      const waitHours = QUIET_AFTER_ANY_MESSAGE_HOURS - sinceLastMessage;
      await scheduleNext(chatId, state, new Date(at.getTime() + waitHours * 3_600_000));
      return;
    }

    const decision = await planNurtureTouch(funnel, chatId);

    if (decision.action === "stop") {
      await stop(chatId, state, decision.reason);
      return;
    }

    // Интервал, который назвала модель, зажимается между минимальным разрывом
    // и двумя неделями: слишком частые касания — прямой путь к жалобам.
    const requested = Number(decision.waitHours) || minGapHours;
    const waitHours = Math.min(Math.max(requested, minGapHours), MAX_WAIT_HOURS);
    const nextAt = new Date(at.getTime() + waitHours * 3_600_000);

    if (decision.action === "wait" || !decision.message) {
      await scheduleNext(chatId, state, nextAt);
      return;
    }

    try {
      await bot.sendMessage(chatId, decision.message);
      await logMessage(chatId, "bot", decision.message, undefined, {
        botId: funnel.connectedBotId,
        funnelId: funnel.id,
      });
    } catch (error: any) {
      const code = Number(error?.response?.body?.error_code) || 0;
      if (code === 403) {
        await stop(chatId, state, "подписчик заблокировал бота");
        return;
      }
      console.warn(`[NURTURE] Не удалось отправить касание ${chatId}:`, error?.message || error);
      await scheduleNext(chatId, state, nextAt);
      return;
    }

    nurture.startedAt = nurture.startedAt || at.toISOString();
    nurture.touches.push({ at: at.toISOString(), message: decision.message, reason: decision.reason });
    nurture.nextTouchAt = nextAt.toISOString();
    await persistUserState(chatId, state);
    console.log(`[NURTURE] ${chatId}: касание ${nurture.touches.length}/${maxTouches} — ${decision.reason}`);
  }

  async function tick() {
    const at = now();
    for (const candidate of collectCandidates(at)) {
      try {
        await processCandidate(candidate, at);
      } catch (error: any) {
        console.error(`[NURTURE] Сбой на подписчике ${candidate.chatId}:`, error?.message || error);
      }
    }
  }

  return { tick };
}
