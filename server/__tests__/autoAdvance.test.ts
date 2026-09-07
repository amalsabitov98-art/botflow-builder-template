import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBotManager } from "../services/botManager";
import type { BotEntry, Funnel, SubscriberProfile } from "../types";
import type { UserStageState } from "../services/progress";

const HOUR_MS = 60 * 60 * 1000;

// targetStageId: "" — этап, за которым ничего нет (конец воронки).
function buildFunnel(autoAdvanceMinutes?: number, targetStageId = "s2"): Funnel {
  return {
    id: "f1",
    title: "Мини-курс",
    status: "active",
    subscribers: 1,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    connectedBotId: "bot1",
    stages: [
      {
        id: "s1",
        index: 0,
        title: "Урок 1",
        firstMessage: { text: "Первый урок" },
        rules: [],
        reminders: [],
        nextStage: {
          targetStageId: targetStageId || undefined,
          label: "Далее: Урок 2",
          ...(autoAdvanceMinutes ? { autoAdvanceMinutes } : {}),
        },
      },
      {
        id: "s2",
        index: 1,
        title: "Урок 2",
        firstMessage: { text: "Второй урок" },
        rules: [],
        reminders: [],
      },
    ],
  };
}

function buildState(partial: Partial<UserStageState> = {}): UserStageState {
  return {
    funnelId: "f1",
    currentStageId: "s1",
    currentStageIndex: 0,
    timeouts: [],
    finished: false,
    sentStages: ["s1"],
    openedStages: [],
    viewedStages: [],
    completedStages: [],
    lastActionAt: new Date().toISOString(),
    events: [],
    reminderJobs: [],
    profile: { answers: {} },
    ...partial,
  };
}

const entry: BotEntry = {
  id: "bot1",
  token: "token",
  name: "test_bot",
  firstName: "Test",
  active: true,
  addedAt: new Date().toISOString(),
};

function createHarness(funnel: Funnel, state: UserStageState, subscriber?: Partial<SubscriberProfile>) {
  const deliveredStages: string[] = [];
  // Ключ тот же, что и в приложении: chatId:funnelId. По нему восстановление
  // после рестарта находит отложенные задачи.
  const userStates = new Map<string, UserStageState>([["42:f1", state]]);
  const bot = {
    sendMessage: async () => undefined,
    answerCallbackQuery: async () => undefined,
  } as any;

  const manager = createBotManager({
    activeFunnels: new Map<string, Funnel>([[funnel.id, funnel]]),
    buildInlineKeyboard: () => [],
    deliverStageMessage: async (_bot, _chatId, _funnel, stage) => { deliveredStages.push(stage.id); },
    ensureUserState: () => state,
    getUserState: () => state,
    getSettings: () => ({
      bots: [entry], geminiApiKey: "", appUrl: "https://example.com", notifications: true, autoReminders: true,
    }),
    // Внешние модели в тестах не зовём: без ключей код идёт по запасному пути.
    getAssistantApiKey: () => "",
    getTranscriptionKeys: () => ({}),
    getTelegramWebhook: () => null,
    getWebAppUrl: () => "https://example.com",
    globalSubscribers: new Map<number, SubscriberProfile>([[42, {
      id: 42,
      firstName: "Нурлан",
      lastActive: new Date().toISOString(),
      ...subscriber,
    }]]),
    logMessage: async () => undefined,
    persistUserState: async () => undefined,
    recordUserEvent: () => undefined,
    saveFunnel: async () => undefined,
    saveSettings: async () => undefined,
    saveSubscriber: async () => undefined,
    shouldSendReminder: () => false,
    userStates,
  });

  return { manager, bot, funnel, state, deliveredStages };
}

function advanceJobs(state: UserStageState) {
  return state.reminderJobs.filter((job) => job.kind === "advance");
}

describe("автопереход на следующий этап", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("ставит отложенную задачу на следующий этап", async () => {
    const harness = createHarness(buildFunnel(1440), buildState());

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);

    const jobs = advanceJobs(harness.state);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("pending");
    expect(jobs[0].stageId).toBe("s1");
    // 24 часа от момента отправки этапа.
    expect(new Date(jobs[0].dueAt).getTime() - Date.now()).toBe(24 * HOUR_MS);
  });

  it("не ставит задачу, если автопереход не настроен", async () => {
    const harness = createHarness(buildFunnel(), buildState());

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);

    expect(advanceJobs(harness.state)).toHaveLength(0);
  });

  it("не ставит задачу, если следующего этапа нет", async () => {
    const harness = createHarness(buildFunnel(1440, ""), buildState());

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);

    expect(advanceJobs(harness.state)).toHaveLength(0);
  });

  it("присылает следующий этап, когда время пришло", async () => {
    const harness = createHarness(buildFunnel(1440), buildState());

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);
    expect(harness.deliveredStages).toEqual(["s1"]);

    await vi.advanceTimersByTimeAsync(24 * HOUR_MS);

    expect(harness.deliveredStages).toEqual(["s1", "s2"]);
    expect(harness.state.currentStageId).toBe("s2");
    expect(advanceJobs(harness.state)[0].status).toBe("sent");
  });

  it("молчит, если человек ушёл с этапа сам", async () => {
    const harness = createHarness(buildFunnel(1440), buildState());

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);
    // Нажал кнопку и ушёл дальше раньше срока.
    harness.state.currentStageId = "s2";
    harness.state.sentStages = ["s1", "s2"];

    await vi.advanceTimersByTimeAsync(24 * HOUR_MS);

    expect(harness.deliveredStages).toEqual(["s1"]);
    expect(advanceJobs(harness.state)[0].status).toBe("skipped");
  });

  it("не пишет тому, кто заблокировал бота", async () => {
    const harness = createHarness(
      buildFunnel(1440),
      buildState(),
      { botBlockedAt: new Date().toISOString() },
    );

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);
    await vi.advanceTimersByTimeAsync(24 * HOUR_MS);

    expect(harness.deliveredStages).toEqual(["s1"]);
    expect(advanceJobs(harness.state)[0].status).toBe("skipped");
  });

  it("восстанавливает задачу после перезапуска сервера", async () => {
    // Сервер поднялся заново: таймеров в памяти нет, задача осталась в досье.
    const dueAt = new Date(Date.now() + 2 * HOUR_MS).toISOString();
    const state = buildState({
      reminderJobs: [{
        id: "42:f1:s1:__advance__",
        kind: "advance",
        funnelId: "f1",
        stageId: "s1",
        reminderId: "__advance__",
        dueAt,
        status: "pending",
        createdAt: new Date().toISOString(),
      }],
    });
    const harness = createHarness(buildFunnel(1440), state);
    // Бот уже поднят рестартом — подставляем его напрямую, без сети.
    harness.manager.botInstances.set("bot1", harness.bot);

    harness.manager.resumePendingReminders();
    await vi.advanceTimersByTimeAsync(2 * HOUR_MS);

    expect(harness.deliveredStages).toEqual(["s2"]);
  });
});
