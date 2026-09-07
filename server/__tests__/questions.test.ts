import { describe, expect, it } from "vitest";
import { createBotManager, isStartCommand } from "../services/botManager";
import type { BotEntry, Funnel } from "../types";
import type { UserStageState } from "../services/progress";

function buildFunnel(): Funnel {
  return {
    id: "f1",
    title: "Вайб-кодинг",
    status: "active",
    subscribers: 1,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    connectedBotId: "bot1",
    stages: [
      {
        id: "s1",
        index: 0,
        title: "Первый сайт",
        firstMessage: { text: "Смотри первый урок" },
        rules: [],
        reminders: [],
        questions: [
          {
            id: "q1",
            key: "goal",
            text: "{name}, зачем тебе сайт?",
            options: [
              { id: "o1", label: "Себе" },
              { id: "o2", label: "Делать на заказ", targetStageId: "s2" },
            ],
          },
          {
            id: "q2",
            key: "level",
            text: "Пробовал раньше кодить?",
            options: [{ id: "o1", label: "Никогда" }],
          },
        ],
      },
      {
        id: "s2",
        index: 1,
        title: "Заявки в Telegram",
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

function createQuestionHarness(funnel: Funnel = buildFunnel(), state: UserStageState = buildState()) {
  const sent: Array<{ text: string; buttons: string[] }> = [];
  const edited: string[] = [];
  const deliveredStages: string[] = [];
  const persisted: UserStageState[] = [];

  const bot = {
    sendMessage: async (_chatId: number, text: string, options?: any) => {
      const rows = options?.reply_markup?.inline_keyboard || [];
      sent.push({ text, buttons: rows.flat().map((b: any) => b.callback_data) });
    },
    editMessageText: async (text: string) => { edited.push(text); },
    answerCallbackQuery: async () => undefined,
  } as any;

  const manager = createBotManager({
    activeFunnels: new Map<string, Funnel>([[funnel.id, funnel]]),
    buildInlineKeyboard: () => [],
    deliverStageMessage: async (_bot, _chatId, _funnel, stage) => { deliveredStages.push(stage.id); },
    ensureUserState: () => state,
    getUserState: () => state,
    getSettings: () => ({
      bots: [], geminiApiKey: "", appUrl: "https://example.com", notifications: true, autoReminders: true,
    }),
    // Внешние модели в тестах не зовём: без ключей код идёт по запасному пути.
    getAssistantApiKey: () => "",
    getTranscriptionKeys: () => ({}),
    getTelegramWebhook: () => null,
    getWebAppUrl: () => "https://example.com",
    globalSubscribers: new Map([[42, { id: 42, firstName: "Нурлан", lastActive: new Date().toISOString() }]]),
    logMessage: async () => undefined,
    persistUserState: async (_chatId, next) => { persisted.push(next); },
    recordUserEvent: () => undefined,
    saveFunnel: async () => undefined,
    saveSettings: async () => undefined,
    saveSubscriber: async () => undefined,
    shouldSendReminder: () => false,
    userStates: new Map<string, UserStageState>(),
  });

  return { manager, bot, funnel, state, sent, edited, deliveredStages, persisted };
}

describe("вопросы в воронке", () => {
  it("задаёт первый вопрос после сообщения этапа и подставляет имя", async () => {
    const harness = createQuestionHarness();

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);

    expect(harness.deliveredStages).toEqual(["s1"]);
    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0].text).toBe("Нурлан, зачем тебе сайт?");
    expect(harness.sent[0].buttons).toEqual(["ans:q1:o1", "ans:q1:o2"]);
  });

  it("пропускает вопрос, на который человек уже ответил", async () => {
    const state = buildState({
      profile: { answers: { goal: { questionId: "q1", optionId: "o1", label: "Себе", at: new Date().toISOString() } } },
    });
    const harness = createQuestionHarness(buildFunnel(), state);

    await harness.manager.sendStageMessage(harness.bot, 42, harness.funnel, harness.funnel.stages[0]);

    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0].text).toBe("Пробовал раньше кодить?");
  });

  it("сохраняет ответ в профиль и показывает выбор в сообщении", async () => {
    const harness = createQuestionHarness();

    await harness.manager.handleQuestionAnswer(
      harness.bot, entry, 42, "ans:q1:o1", "cb1", { message_id: 7, text: "Зачем тебе сайт?" },
    );

    expect(harness.state.profile.answers.goal).toMatchObject({ questionId: "q1", optionId: "o1", label: "Себе" });
    expect(harness.persisted).toHaveLength(1);
    expect(harness.edited[0]).toContain("✅ Себе");
  });

  it("уводит на ветку, заданную вариантом ответа", async () => {
    const harness = createQuestionHarness();

    await harness.manager.handleQuestionAnswer(
      harness.bot, entry, 42, "ans:q1:o2", "cb1", { message_id: 7 },
    );

    expect(harness.state.profile.answers.goal.label).toBe("Делать на заказ");
    expect(harness.deliveredStages).toEqual(["s2"]);
  });

  it("задаёт следующий вопрос, когда ветка не указана", async () => {
    const harness = createQuestionHarness();

    await harness.manager.handleQuestionAnswer(
      harness.bot, entry, 42, "ans:q1:o1", "cb1", { message_id: 7 },
    );

    expect(harness.deliveredStages).toEqual([]);
    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0].text).toBe("Пробовал раньше кодить?");
  });

  it("молча игнорирует ответ на неизвестный вопрос", async () => {
    const harness = createQuestionHarness();

    await harness.manager.handleQuestionAnswer(
      harness.bot, entry, 42, "ans:qX:oX", "cb1", { message_id: 7 },
    );

    expect(harness.state.profile.answers).toEqual({});
    expect(harness.persisted).toHaveLength(0);
    expect(harness.sent).toHaveLength(0);
  });

  it("не отправляет вопрос, если идентификаторы не влезают в callback_data", async () => {
    const funnel = buildFunnel();
    funnel.stages[0].questions = [{
      id: "q".repeat(40),
      key: "goal",
      text: "Слишком длинный вопрос",
      options: [{ id: "o".repeat(40), label: "Вариант" }],
    }];
    const harness = createQuestionHarness(funnel);

    await harness.manager.sendStageMessage(harness.bot, 42, funnel, funnel.stages[0]);

    expect(harness.sent).toHaveLength(0);
  });
});

describe("источник подписчика", () => {
  it("вынимает метку из /start", () => {
    const { manager } = createQuestionHarness();

    expect(manager.parseStartPayload('/start ad_vk_01')).toBe('ad_vk_01');
    expect(manager.parseStartPayload('/start')).toBe('');
    expect(manager.parseStartPayload('/start   ')).toBe('');
  });

  it("вычищает посторонние символы и режет длину", () => {
    const { manager } = createQuestionHarness();

    // payload приходит из внешнего мира, доверять ему нельзя.
    expect(manager.parseStartPayload('/start ad<script>')).toBe('adscript');
    expect(manager.parseStartPayload('/start ' + 'a'.repeat(100))).toHaveLength(64);
  });

  it("запоминает первый источник и не перезаписывает его", () => {
    const { manager } = createQuestionHarness();
    const state = buildState();

    expect(manager.rememberSource(state, 'ad_vk_01')).toBe(true);
    expect(state.profile.source?.value).toBe('ad_vk_01');

    // Человек вернулся через месяц по другой ссылке — источник остаётся прежним.
    expect(manager.rememberSource(state, 'ad_tg_09')).toBe(false);
    expect(state.profile.source?.value).toBe('ad_vk_01');
  });

  it("не записывает пустую метку", () => {
    const { manager } = createQuestionHarness();
    const state = buildState();

    expect(manager.rememberSource(state, '')).toBe(false);
    expect(state.profile.source).toBeUndefined();
  });
});

describe("распознавание /start", () => {
  it("узнаёт команду вместе с меткой диплинка", () => {
    // Раньше сюда проваливался «/start ad_vk_01»: человек получал этап и следом
    // ответ ассистента на текст самой команды.
    expect(isStartCommand("/start")).toBe(true);
    expect(isStartCommand("/start ad_vk_01")).toBe(true);
    expect(isStartCommand("/start@my_bot")).toBe(true);
    expect(isStartCommand("/start@my_bot ad_vk_01")).toBe(true);
  });

  it("не считает командой обычный текст с упоминанием /start", () => {
    expect(isStartCommand("а где /start?")).toBe(false);
    expect(isStartCommand("/startup")).toBe(false);
    expect(isStartCommand("")).toBe(false);
    expect(isStartCommand(undefined)).toBe(false);
  });
});
