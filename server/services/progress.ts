import type { SupabaseClient } from "@supabase/supabase-js";
import { saveJSON } from "../storage/jsonStore";
import { readAllRows } from "../storage/pagination";
import type { Funnel, FunnelStage, Reminder } from "../types";

export type TrackedEvent = {
  event: string;
  funnelId?: string;
  stageId?: string;
  timestamp: string;
};

// Отложенная задача по подписчику. Изначально в очереди жили только напоминания,
// поэтому у старых записей нет поля kind — они читаются как 'reminder'.
export type ReminderJob = {
  id: string;
  kind?: 'reminder' | 'advance';
  funnelId: string;
  stageId: string;
  reminderId: string;
  dueAt: string;
  status: 'pending' | 'sent' | 'skipped' | 'canceled';
  createdAt: string;
  completedAt?: string;
};

// Ответ подписчика на вопрос этапа.
export type SubscriberAnswer = {
  questionId: string;
  optionId: string;
  label: string;
  at: string;
};

// Одно касание длинного дожима: что отправили и почему.
export type NurtureTouch = {
  at: string;
  message: string;
  reason: string;
};

// Состояние длинного дожима по конкретному подписчику.
export type NurtureState = {
  startedAt?: string;
  nextTouchAt?: string;
  touches: NurtureTouch[];
  stoppedReason?: string;
};

// Прогресс по платному курсу. Раньше жил в localStorage браузера: терялся при
// смене устройства и был не виден ни серверу, ни владельцу.
export type CourseProgress = {
  completed: string[];
  lastLessonId?: string;
  startedAt?: string;
  updatedAt?: string;
};

// Движение бонусов. id — ключ идемпотентности: за один и тот же урок или
// ответ начислить дважды нельзя, сколько бы раз запрос ни повторился.
export type BonusEntry = {
  id: string;
  at: string;
  amount: number;
  reason: string;
};

export type BonusState = {
  balance: number;
  history: BonusEntry[];
  // Active awards survive history trimming; used for duplicate/reversal checks.
  awards?: Record<string, number>;
};

// Сколько раз ассистент отвечал этому человеку сегодня. Лежит в досье, а не в
// памяти процесса: иначе каждый деплой обнулял бы счётчик, и дневной лимит
// перестал бы ограничивать расходы.
export type AssistantUsage = {
  day: string;
  count: number;
};

// Откуда человек пришёл: метка из диплинка t.me/бот?start=<метка>.
// Записывается один раз — источник, который его привёл, а не последний клик.
export type SubscriberSource = {
  value: string;
  at: string;
};

// Домашнее задание в интерактивном челлендже
export type HomeworkSubmission = {
  id: string;
  stageId: string;
  stageTitle?: string;
  submittedAt: string;
  content: string;
  mediaUrl?: string;
  aiFeedback?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewerComment?: string;
};

// Досье подписчика: всё, что воронка о нём знает и планирует.
// Живёт одной JSONB-колонкой, чтобы каждая новая функция не требовала миграции.
export type SubscriberDossier = {
  answers: Record<string, SubscriberAnswer>;
  nurture?: NurtureState;
  course?: CourseProgress;
  bonus?: BonusState;
  source?: SubscriberSource;
  assistantUsage?: AssistantUsage;
  homeworks?: Record<string, HomeworkSubmission>;
};


export type UserStageState = {
  funnelId: string;
  persistedAt?: string;
  currentStageId?: string;
  currentStageIndex: number;
  timeouts: NodeJS.Timeout[];
  finished: boolean;
  sentStages: string[];
  openedStages: string[];
  viewedStages: string[];
  completedStages: string[];
  lastActionAt: string;
  purchaseStatus?: 'none' | 'pending' | 'paid' | 'refund';
  events: TrackedEvent[];
  reminderJobs: ReminderJob[];
  profile: SubscriberDossier;
};

export type RecordUserEventResult = {
  alreadyRecorded: boolean;
  state: UserStageState;
};

export type UserStateKey = string;

interface ProgressServiceDeps {
  activeFunnels: Map<string, Funnel>;
  getSupabase: () => SupabaseClient | null;
  getUseSupabase: () => boolean;
  progressFile: string;
  progressStateRowId: string;
}

function uniquePush(list: string[], value?: string) {
  if (value && !list.includes(value)) list.push(value);
}

function toStringArray(value: any): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function normalizeEvents(value: any): TrackedEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.event === "string")
    .slice(-100)
    .map((item) => ({
      event: String(item.event),
      funnelId: item.funnelId ? String(item.funnelId) : undefined,
      stageId: item.stageId ? String(item.stageId) : undefined,
      timestamp: item.timestamp || new Date().toISOString(),
    }));
}

function normalizeReminderJobs(value: any): ReminderJob[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => (
      item
      && typeof item.id === "string"
      && typeof item.funnelId === "string"
      && typeof item.stageId === "string"
      && typeof item.reminderId === "string"
      && typeof item.dueAt === "string"
    ))
    .slice(-200)
    .map((item) => ({
      id: item.id,
      kind: item.kind === "advance" ? "advance" as const : "reminder" as const,
      funnelId: item.funnelId,
      stageId: item.stageId,
      reminderId: item.reminderId,
      dueAt: item.dueAt,
      status: item.status === "sent" || item.status === "skipped" || item.status === "canceled"
        ? item.status
        : "pending",
      createdAt: item.createdAt || new Date().toISOString(),
      completedAt: item.completedAt || undefined,
    }));
}

function wasStageEventRecorded(state: UserStageState, event: string, stageId?: string) {
  if (!stageId || stageId === "intro") return false;
  if (event === "stage_sent") return state.sentStages.includes(stageId);
  if (event === "webapp_opened") return state.openedStages.includes(stageId);
  if (event === "lesson_viewed") return state.viewedStages.includes(stageId);
  if (event === "stage_completed") return state.completedStages.includes(stageId);
  if (event === "offer_viewed" || event === "checkout_started") {
    return state.events.some((tracked) => tracked.event === event && tracked.stageId === stageId);
  }
  return false;
}

function getUserStateKey(chatId: number, funnelId: string): UserStateKey {
  return `${chatId}:${funnelId}`;
}

export function parseUserStateKey(key: UserStateKey) {
  const separatorIndex = key.indexOf(":");
  const chatIdRaw = separatorIndex === -1 ? key : key.slice(0, separatorIndex);
  const funnelId = separatorIndex === -1 ? "" : key.slice(separatorIndex + 1);
  return { chatId: Number(chatIdRaw), funnelId };
}

function getStateTimestamp(state?: UserStageState) {
  return state?.lastActionAt ? new Date(state.lastActionAt).getTime() : 0;
}

export function createProgressService({
  activeFunnels,
  getSupabase,
  getUseSupabase,
  progressFile,
  progressStateRowId,
}: ProgressServiceDeps) {
  const userStates = new Map<UserStateKey, UserStageState>();
  let progressTableAvailable: boolean | null = null;
  let warnedProgressTableFallback = false;
  // Сбрасывается в false, если в таблице ещё нет колонки profile.
  let progressProfileColumn = true;

  function getUserState(chatId: number, funnelId?: string): UserStageState | undefined {
    if (funnelId) return userStates.get(getUserStateKey(chatId, funnelId));

    let latestState: UserStageState | undefined;
    for (const [key, state] of userStates) {
      const parsed = parseUserStateKey(key);
      if (parsed.chatId !== chatId) continue;
      if (!latestState || getStateTimestamp(state) >= getStateTimestamp(latestState)) {
        latestState = state;
      }
    }
    return latestState;
  }

  function getUserStatesForChat(chatId: number) {
    return Array.from(userStates.entries())
      .filter(([key]) => parseUserStateKey(key).chatId === chatId)
      .map(([, state]) => state);
  }

  function ensureUserState(chatId: number, funnelId: string, stage?: any): UserStageState {
    const key = getUserStateKey(chatId, funnelId);
    const existing = userStates.get(key);
    if (existing) return existing;

    const state: UserStageState = {
      funnelId,
      currentStageId: stage?.id,
      currentStageIndex: stage?.index || 0,
      timeouts: [],
      finished: false,
      sentStages: [],
      openedStages: [],
      viewedStages: [],
      completedStages: [],
      lastActionAt: new Date().toISOString(),
      purchaseStatus: 'none',
      events: [],
      reminderJobs: [],
      profile: { answers: {} },
    };
    userStates.set(key, state);
    return state;
  }

  function serializeUserState(state: UserStageState) {
    return {
      funnelId: state.funnelId,
      persistedAt: state.persistedAt,
      currentStageId: state.currentStageId || null,
      currentStageIndex: state.currentStageIndex || 0,
      finished: state.finished,
      sentStages: state.sentStages,
      openedStages: state.openedStages,
      viewedStages: state.viewedStages,
      completedStages: state.completedStages,
      lastActionAt: state.lastActionAt,
      purchaseStatus: state.purchaseStatus || 'none',
      events: state.events.slice(-100),
      reminderJobs: state.reminderJobs.slice(-200),
      profile: state.profile || { answers: {} },
    };
  }

  // Досье могло прийти из старого снимка или из базы без колонки — приводим к форме.
  function normalizeDossier(value: any): SubscriberDossier {
    if (!value || typeof value !== "object") return { answers: {} };
    const answers = value.answers && typeof value.answers === "object" ? value.answers : {};
    const nurture = value.nurture && typeof value.nurture === "object"
      ? { ...value.nurture, touches: Array.isArray(value.nurture.touches) ? value.nurture.touches : [] }
      : undefined;
    const course = value.course && typeof value.course === "object"
      ? { ...value.course, completed: Array.isArray(value.course.completed) ? value.course.completed : [] }
      : undefined;
    const bonus = value.bonus && typeof value.bonus === "object"
      ? {
        balance: Number(value.bonus.balance) || 0,
        history: Array.isArray(value.bonus.history) ? value.bonus.history : [],
        ...(value.bonus.awards && typeof value.bonus.awards === "object"
          ? { awards: Object.fromEntries(Object.entries(value.bonus.awards)
            .filter(([, amount]) => typeof amount === "number" && Number.isFinite(amount) && amount > 0)) as Record<string, number> }
          : {}),
      }
      : undefined;
    const source = value.source && typeof value.source === "object" && value.source.value
      ? { value: String(value.source.value), at: String(value.source.at || "") }
      : undefined;
    const assistantUsage = value.assistantUsage && typeof value.assistantUsage === "object" && value.assistantUsage.day
      ? { day: String(value.assistantUsage.day), count: Number(value.assistantUsage.count) || 0 }
      : undefined;
    return {
      answers,
      ...(nurture ? { nurture } : {}),
      ...(course ? { course } : {}),
      ...(bonus ? { bonus } : {}),
      ...(source ? { source } : {}),
      ...(assistantUsage ? { assistantUsage } : {}),
      ...(value.homeworks && typeof value.homeworks === "object" && !Array.isArray(value.homeworks)
        ? { homeworks: Object.fromEntries(Object.entries(value.homeworks).filter(([, homework]: [string, any]) => (
          homework && typeof homework === "object" && typeof homework.stageId === "string"
          && ["pending_review", "approved", "rejected"].includes(homework.status)
        ))) as Record<string, HomeworkSubmission> }
        : {}),
    };
  }

  function hydrateUserState(chatId: number, value: any) {
    if (!value) return false;
    const funnelId = String(value.funnelId || value.funnel_id || "");
    if (!funnelId) return false;

    const state: UserStageState = {
      funnelId,
      persistedAt: value.persistedAt || value.updated_at || undefined,
      currentStageId: value.currentStageId || value.current_stage_id || undefined,
      currentStageIndex: Number(value.currentStageIndex ?? value.current_stage_index ?? 0),
      timeouts: [],
      finished: Boolean(value.finished),
      sentStages: toStringArray(value.sentStages || value.sent_stages),
      openedStages: toStringArray(value.openedStages || value.opened_stages),
      viewedStages: toStringArray(value.viewedStages || value.viewed_stages),
      completedStages: toStringArray(value.completedStages || value.completed_stages),
      profile: normalizeDossier(value.profile),
      lastActionAt: value.lastActionAt || value.last_action_at || new Date().toISOString(),
      purchaseStatus: value.purchaseStatus || value.purchase_status || 'none',
      events: normalizeEvents(value.events),
      reminderJobs: normalizeReminderJobs(value.reminderJobs || value.reminder_jobs),
    };

    const key = getUserStateKey(chatId, funnelId);
    const existing = userStates.get(key);
    if (!existing || new Date(state.persistedAt || state.lastActionAt).getTime()
      >= new Date(existing.persistedAt || existing.lastActionAt).getTime()) {
      userStates.set(key, state);
    }
    return true;
  }

  function collectProgressSnapshot() {
    const snapshot: Record<string, any> = {};
    userStates.forEach((state, key) => {
      if (!state.funnelId) return;
      const { chatId } = parseUserStateKey(key);
      snapshot[`${chatId}:${state.funnelId}`] = {
        chatId,
        ...serializeUserState(state),
      };
    });
    return snapshot;
  }

  function loadProgressSnapshot(snapshot: any) {
    if (!snapshot || typeof snapshot !== "object") return 0;
    let loaded = 0;
    for (const [key, raw] of Object.entries(snapshot)) {
      const chatId = Number((raw as any)?.chatId || String(key).split(":")[0]);
      if (!Number.isFinite(chatId)) continue;
      if (hydrateUserState(chatId, raw)) loaded += 1;
    }
    return loaded;
  }

  function isMissingProgressTable(error: any) {
    return error?.code === "42P01" || error?.code === "PGRST205";
  }

  async function loadProgressFromSupabase() {
    const supabase = getSupabase();
    if (!supabase) return 0;

    const { data, error } = await readAllRows(() => supabase
      .from("user_funnel_progress").select("*").order("chat_id").order("funnel_id"));
    if (error && !isMissingProgressTable(error)) {
      throw new Error("Failed to load funnel progress");
    }
    progressTableAvailable = !error;

    // Older releases could save newer data here after a transient table error.
    // Always read it, merge by persistence time and migrate before discarding it.
    const { data: fallbackRow, error: fallbackError } = await supabase
      .from("funnels").select("data,updated_at").eq("id", progressStateRowId).maybeSingle();
    if (fallbackError) throw new Error("Failed to load progress fallback");

    for (const row of data || []) {
      const chatId = Number(row.chat_id);
      if (Number.isSafeInteger(chatId)) hydrateUserState(chatId, row);
    }
    const recoveredKeys: string[] = [];
    for (const [key, raw] of Object.entries(fallbackRow?.data || {})) {
      if (!raw || typeof raw !== "object") continue;
      const value = raw as any;
      const chatId = Number(value.chatId || key.split(":")[0]);
      if (!Number.isSafeInteger(chatId)) continue;
      if (hydrateUserState(chatId, {
        ...value,
        persistedAt: value.persistedAt || fallbackRow?.updated_at || value.lastActionAt,
      })) recoveredKeys.push(getUserStateKey(chatId, String(value.funnelId || value.funnel_id)));
    }

    if (progressTableAvailable && recoveredKeys.length) {
      for (const key of recoveredKeys) {
        const state = userStates.get(key)!;
        await persistUserState(parseUserStateKey(key).chatId, state);
        if (!progressTableAvailable || !progressProfileColumn) {
          throw new Error("Progress recovery requires the current Supabase schema");
        }
      }
      // A failed migration leaves the snapshot intact for the next startup.
      const { error: cleanupError } = await supabase.from("funnels").delete().eq("id", progressStateRowId);
      if (cleanupError) throw new Error("Failed to finalize progress recovery");
    }
    return userStates.size;
  }

  async function persistUserState(chatId: number, state: UserStageState) {
    if (!state.funnelId) return;

    const savedAt = new Date().toISOString();
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      if (progressTableAvailable !== false) {
        const row: Record<string, unknown> = {
          chat_id: chatId,
          funnel_id: state.funnelId,
          current_stage_id: state.currentStageId || null,
          current_stage_index: state.currentStageIndex || 0,
          finished: state.finished,
          sent_stages: state.sentStages,
          opened_stages: state.openedStages,
          viewed_stages: state.viewedStages,
          completed_stages: state.completedStages,
          last_action_at: state.lastActionAt,
          purchase_status: state.purchaseStatus || 'none',
          events: state.events.slice(-100),
          reminder_jobs: state.reminderJobs.slice(-200),
          updated_at: savedAt,
        };
        if (progressProfileColumn) row.profile = state.profile || {};

        let { error } = await supabase
          .from("user_funnel_progress")
          .upsert(row, { onConflict: "chat_id,funnel_id" });

        // Профиль добавлен отдельной миграцией. Пока её нет, пишем прогресс без
        // него, а не роняем всю таблицу в JSON-фолбэк из-за одной колонки.
        if (error && progressProfileColumn && (error as any).code === "PGRST204") {
          progressProfileColumn = false;
          console.warn(
            "⚠️ В таблице user_funnel_progress нет колонки profile — ответы подписчиков "
            + "не сохранятся между перезапусками. Примените ALTER TABLE из supabase-schema.sql.",
          );
          delete row.profile;
          ({ error } = await supabase
            .from("user_funnel_progress")
            .upsert(row, { onConflict: "chat_id,funnel_id" }));
        }

        if (!error) {
          progressTableAvailable = true;
          state.persistedAt = savedAt;
          return;
        }

        if (!isMissingProgressTable(error)) throw new Error("Failed to persist funnel progress");
        progressTableAvailable = false;
        if (!warnedProgressTableFallback) {
          warnedProgressTableFallback = true;
          console.warn("⚠️ Failed to save progress to user_funnel_progress, using JSON row fallback:", error.message);
        }
      }

      const snapshot = collectProgressSnapshot();
      snapshot[getUserStateKey(chatId, state.funnelId)].persistedAt = savedAt;
      const { error: fallbackError } = await supabase.from("funnels").upsert({
        id: progressStateRowId,
        data: snapshot,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (fallbackError) {
        console.error("Failed to persist progress fallback in Supabase:", fallbackError);
        throw new Error("Failed to persist funnel progress");
      }
      state.persistedAt = savedAt;
      return;
    }

    const snapshot = collectProgressSnapshot();
    snapshot[getUserStateKey(chatId, state.funnelId)].persistedAt = savedAt;
    saveJSON(progressFile, snapshot);
    state.persistedAt = savedAt;
  }

  async function deleteUserState(chatId: number, funnelId?: string) {
    const statesToDelete = Array.from(userStates.entries()).filter(([key]) => {
      const parsed = parseUserStateKey(key);
      return parsed.chatId === chatId && (!funnelId || parsed.funnelId === funnelId);
    });
    const supabase = getSupabase();
    let deletedFromTable = false;
    if (getUseSupabase() && supabase && progressTableAvailable !== false) {
      let query = supabase.from("user_funnel_progress").delete().eq("chat_id", chatId);
      if (funnelId) query = query.eq("funnel_id", funnelId);
      const { error } = await query;
      if (error && !isMissingProgressTable(error)) throw new Error("Failed to delete funnel progress");
      progressTableAvailable = !error;
      deletedFromTable = !error;
    }
    if (!deletedFromTable) {
      const snapshot = collectProgressSnapshot();
      for (const [key] of statesToDelete) delete snapshot[key];
      if (getUseSupabase() && supabase) {
        const { error } = await supabase.from("funnels").upsert({
          id: progressStateRowId, data: snapshot, updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        if (error) throw new Error("Failed to delete funnel progress");
      } else {
        saveJSON(progressFile, snapshot);
      }
    }
    for (const [key, state] of statesToDelete) {
      for (const timeout of state.timeouts || []) clearTimeout(timeout);
      userStates.delete(key);
    }
  }

  function recordUserEvent(chatId: number, event: string, funnelId: string, stageId?: string): RecordUserEventResult {
    const funnel = activeFunnels.get(funnelId);
    const stage = funnel?.stages?.find((s: any) => s.id === stageId);
    const state = ensureUserState(chatId, funnelId, stage);
    const timestamp = new Date().toISOString();
    const alreadyRecorded = wasStageEventRecorded(state, event, stageId);

    if (alreadyRecorded) {
      console.log(`[TRACK] duplicate ${event} chatId=${chatId} funnel=${funnelId} stage=${stageId || '-'}`);
      return { alreadyRecorded: true, state };
    }

    state.funnelId = funnelId;
    state.lastActionAt = timestamp;
    state.events.push({ event, funnelId, stageId, timestamp });
    if (state.events.length > 100) state.events.splice(0, state.events.length - 100);

    if (stageId && stageId !== 'intro') {
      if (event === 'stage_sent') {
        state.currentStageId = stageId;
        state.currentStageIndex = stage?.index || state.currentStageIndex || 0;
        uniquePush(state.sentStages, stageId);
      }
      if (event === 'webapp_opened') {
        state.currentStageId = stageId;
        state.currentStageIndex = stage?.index || state.currentStageIndex || 0;
        uniquePush(state.openedStages, stageId);
      }
      if (event === 'lesson_viewed') {
        uniquePush(state.viewedStages, stageId);
      }
      if (event === 'stage_completed') {
        uniquePush(state.completedStages, stageId);
        state.finished = true;
      }
    }

    console.log(`[TRACK] ${event} chatId=${chatId} funnel=${funnelId} stage=${stageId || '-'}`);
    void persistUserState(chatId, state).catch((error) => {
      console.error("Failed to persist tracked funnel event:", error);
    });
    return { alreadyRecorded: false, state };
  }

  function shouldSendReminder(state: UserStageState, reminder: Reminder, stage: FunnelStage) {
    const stageId = stage.id;
    const sent = state.sentStages.includes(stageId);
    const opened = state.openedStages.includes(stageId);
    const viewed = state.viewedStages.includes(stageId);
    const completed = state.completedStages.includes(stageId);
    const paid = state.purchaseStatus === 'paid';
    const offerReached = state.events.some((event) => (
      event.stageId === stageId
      && (event.event === 'offer_viewed' || event.event === 'checkout_started')
    ));

    switch (reminder.condition || 'not_completed') {
      case 'not_opened':
        return sent && !opened;
      case 'opened_not_viewed':
        return opened && !viewed;
      case 'viewed_not_completed':
        return viewed && !completed;
      case 'not_paid':
        return !paid && offerReached;
      case 'not_completed':
      default:
        return !completed;
    }
  }

	  function buildFunnelStageAnalytics(funnelId: string) {
	    const funnel = activeFunnels.get(funnelId);
	    if (!funnel) return null;
	
	    const states = Array.from(userStates.entries())
	      .filter(([, state]) => state.funnelId === funnelId)
	      .map(([key, state]) => ({ chatId: parseUserStateKey(key).chatId, state }));

	    const hasEvent = (state: UserStageState, eventName: string) => (
	      state.events.some((event) => event.event === eventName)
	    );
	    const countUsersWithEvent = (eventName: string) => (
	      states.filter(({ state }) => hasEvent(state, eventName)).length
	    );

	    const profileOpened = countUsersWithEvent("profile_opened");
	    const menuButtonOpened = countUsersWithEvent("menu_button_opened");
	    const profileContinued = countUsersWithEvent("profile_continue_clicked");
	    const menuButtonOpenedNotContinued = states.filter(({ state }) => (
	      hasEvent(state, "menu_button_opened") && !hasEvent(state, "profile_continue_clicked")
	    )).length;

	    const profileAnalytics = {
	      menuButtonOpened,
	      profileOpened,
	      profileContinued,
	      continueRate: profileOpened ? Math.round((profileContinued / profileOpened) * 100) : 0,
	      segments: [
	        {
	          key: "profile_opened",
	          label: "Открыли профиль",
	          description: "Пользователи, которые открывали экран «Мой прогресс».",
	          count: profileOpened,
	        },
	        {
	          key: "profile_continue_clicked",
	          label: "Нажали продолжить",
	          description: "Пользователи, которые из профиля перешли к текущему уроку.",
	          count: profileContinued,
	        },
	        {
	          key: "menu_button_opened_not_continued",
	          label: "Открыл «Мой прогресс», но не продолжил",
	          description: "Открыли профиль через кнопку в чате, но не нажали «Продолжить».",
	          count: menuButtonOpenedNotContinued,
	        },
	      ],
	    };
	
	    const stages = (funnel.stages || []).map((stage: FunnelStage, index: number) => {
      const sent = states.filter(({ state }) => state.sentStages.includes(stage.id)).length;
      const opened = states.filter(({ state }) => state.openedStages.includes(stage.id)).length;
      const viewed = states.filter(({ state }) => state.viewedStages.includes(stage.id)).length;
      const completed = states.filter(({ state }) => state.completedStages.includes(stage.id)).length;
      const paid = states.filter(({ state }) => state.purchaseStatus === 'paid' && (state.currentStageId === stage.id || state.completedStages.includes(stage.id))).length;

      // Аналитика домашних заданий на данном этапе
      const homeworksOnStage = states
        .map(({ state }) => state.profile?.homeworks?.[stage.id])
        .filter(Boolean);
      const homework = {
        required: !!stage.requireHomework,
        submitted: homeworksOnStage.length,
        pending: homeworksOnStage.filter((h: any) => h.status === 'pending_review').length,
        approved: homeworksOnStage.filter((h: any) => h.status === 'approved').length,
        rejected: homeworksOnStage.filter((h: any) => h.status === 'rejected').length,
      };

      // Текущее распределение: сколько студентов находятся на этом этапе прямо сейчас
      const nowMs = Date.now();
      const currentUsers = states.filter(({ state }) => state.currentStageId === stage.id && !state.finished).length;
      const stuckUsers = states.filter(({ state }) => {
        if (state.currentStageId !== stage.id || state.finished) return false;
        const lastActionMs = new Date(state.lastActionAt || 0).getTime();
        return (nowMs - lastActionMs) > 48 * 3600 * 1000;
      }).length;

      const drops = [
        { key: 'sent_to_opened', label: 'получили → открыли', from: sent, to: opened, lost: Math.max(sent - opened, 0) },
        { key: 'opened_to_viewed', label: 'открыли → досмотрели', from: opened, to: viewed, lost: Math.max(opened - viewed, 0) },
        { key: 'viewed_to_completed', label: 'досмотрели → завершили', from: viewed, to: completed, lost: Math.max(viewed - completed, 0) },
      ];
      const biggestDrop = drops.sort((a, b) => b.lost - a.lost)[0];

      return {
        id: stage.id,
        index,
        title: stage.title || `Этап ${index + 1}`,
        sent,
        opened,
        viewed,
        completed,
        paid,
        homework,
        currentUsers,
        stuckUsers,
        rates: {
          openRate: sent ? Math.round((opened / sent) * 100) : 0,
          viewRate: opened ? Math.round((viewed / opened) * 100) : 0,
          videoRetentionRate: opened ? Math.round((viewed / opened) * 100) : 0,
          completeRate: viewed ? Math.round((completed / viewed) * 100) : 0,
          paidRate: completed ? Math.round((paid / completed) * 100) : 0,
        },
        biggestDrop,
      };
    });

    const allDrops = stages.flatMap((stage: any) => stage.biggestDrop ? [{
      stageId: stage.id,
      stageTitle: stage.title,
      ...stage.biggestDrop,
    }] : []);
    const biggestDrop = allDrops.sort((a, b) => b.lost - a.lost)[0] || null;

    // Уникальные пользователи по уровню вовлечённости (не сумма по этапам — один юзер
    // не считается несколько раз). Это «честная» воронка для верхнего обзора.
    const usersWith = (predicate: (state: UserStageState) => boolean) => (
      states.filter(({ state }) => predicate(state)).length
    );

    const nowMs = Date.now();
    const totalHomeworkSubmitted = states.reduce((acc, { state }) => {
      const hwCount = Object.keys(state.profile?.homeworks || {}).length;
      return acc + hwCount;
    }, 0);
    const totalHomeworkPending = states.reduce((acc, { state }) => {
      const pendingCount = Object.values(state.profile?.homeworks || {}).filter((h: any) => h?.status === 'pending_review').length;
      return acc + pendingCount;
    }, 0);
    const totalHomeworkApproved = states.reduce((acc, { state }) => {
      const approvedCount = Object.values(state.profile?.homeworks || {}).filter((h: any) => h?.status === 'approved').length;
      return acc + approvedCount;
    }, 0);

    const totalStuck = states.filter(({ state }) => {
      if (state.finished) return false;
      const lastActionMs = new Date(state.lastActionAt || 0).getTime();
      return (nowMs - lastActionMs) > 48 * 3600 * 1000;
    }).length;

    const totals = {
      audience: states.length,
      reached: usersWith((state) => state.sentStages.length > 0),
      opened: usersWith((state) => state.openedStages.length > 0),
      viewed: usersWith((state) => state.viewedStages.length > 0),
      completed: usersWith((state) => state.completedStages.length > 0),
      paid: usersWith((state) => state.purchaseStatus === 'paid'),
      homework: {
        submitted: totalHomeworkSubmitted,
        pending: totalHomeworkPending,
        approved: totalHomeworkApproved,
      },
      stuckUsers: totalStuck,
    };

    return {
      funnelId,
      title: funnel.title,
      totalTracked: states.length,
      totals,
      profileAnalytics,
      stages,
      biggestDrop,
    };

  }

  async function saveHomeworkSubmission(
    chatId: number,
    funnelId: string,
    submission: HomeworkSubmission
  ): Promise<UserStageState> {
    const funnel = activeFunnels.get(funnelId);
    const stage = funnel?.stages?.find((s: any) => s.id === submission.stageId);
    const state = ensureUserState(chatId, funnelId, stage);
    if (!state.profile.homeworks) {
      state.profile.homeworks = {};
    }
    state.profile.homeworks[submission.stageId] = submission;
    state.lastActionAt = new Date().toISOString();
    await persistUserState(chatId, state);
    return state;
  }

  async function updateHomeworkStatus(
    chatId: number,
    funnelId: string,
    stageId: string,
    status: 'approved' | 'rejected',
    reviewerComment?: string
  ): Promise<{ success: boolean; state?: UserStageState; nextStageId?: string }> {
    const key = getUserStateKey(chatId, funnelId);
    const state = userStates.get(key);
    if (!state) return { success: false };

    if (!state.profile.homeworks) {
      state.profile.homeworks = {};
    }
    let hw = state.profile.homeworks[stageId];
    if (!hw) {
      hw = {
        id: `hw-${Date.now()}`,
        stageId,
        submittedAt: new Date().toISOString(),
        content: '(Сдано куратору напрямую)',
        status,
      };
      state.profile.homeworks[stageId] = hw;
    }
    hw.status = status;
    hw.reviewedAt = new Date().toISOString();
    if (reviewerComment) hw.reviewerComment = reviewerComment;

    let nextStageId: string | undefined;
    if (status === 'approved') {
      uniquePush(state.completedStages, stageId);
      const funnel = activeFunnels.get(funnelId);
      const currentStage = funnel?.stages?.find((s: any) => s.id === stageId);
      const currentIndex = currentStage ? funnel?.stages?.indexOf(currentStage) ?? -1 : -1;
      if (currentIndex !== -1 && funnel && currentIndex + 1 < funnel.stages.length) {
        nextStageId = funnel.stages[currentIndex + 1].id;
        state.currentStageId = nextStageId;
        state.currentStageIndex = currentIndex + 1;
        uniquePush(state.openedStages, nextStageId);
      }
    }

    state.lastActionAt = new Date().toISOString();
    await persistUserState(chatId, state);
    return { success: true, state, nextStageId };
  }

  return {
    buildFunnelStageAnalytics,
    deleteUserState,
    ensureUserState,
    getUserState,
    getUserStateKey,
    getUserStatesForChat,
    loadProgressFromSupabase,
    loadProgressSnapshot,
    persistUserState,
    recordUserEvent,
    saveHomeworkSubmission,
    shouldSendReminder,
    updateHomeworkStatus,
    userStates,
  };
}
