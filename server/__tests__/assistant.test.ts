import { describe, expect, it } from "vitest";
import { createAssistantService } from "../services/assistant";
import type { Funnel, FunnelAssistant, MessageEntry, SubscriberProfile } from "../types";
import type { UserStageState } from "../services/progress";

function buildFunnel(assistant?: Partial<FunnelAssistant>): Funnel {
  return {
    id: "f1",
    title: "Курс по автоматизации",
    status: "active",
    subscribers: 1,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    connectedBotId: "bot1",
    ...(assistant ? { assistant: { enabled: true, ...assistant } } : {}),
    stages: [
      {
        id: "s1",
        index: 0,
        title: "Первый урок",
        firstMessage: { text: "Смотри первый урок" },
        rules: [],
        reminders: [],
      },
      {
        id: "s2",
        index: 1,
        title: "Оффер",
        firstMessage: { text: "Забирай пакет" },
        rules: [],
        reminders: [],
        webApp: {
          enabled: true,
          blocks: [],
          theme: "alice",
          pageEvents: [],
          paymentOffers: [
            { offerId: "offer-1", tier: "pkg-1", amount: 4900, currency: "RUB", product: "Полный курс" },
          ],
        },
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

function textResponse(text: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "deepseek-v4-flash",
    stop_reason: "end_turn",
    stop_sequence: null,
    content: [{ type: "text", text }],
    usage: { input_tokens: 10, output_tokens: 5 },
  } as any;
}

function toolResponse(name: string, input: Record<string, unknown> = {}) {
  return {
    id: "msg_tool",
    type: "message",
    role: "assistant",
    model: "deepseek-v4-flash",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "toolu_test", name, input }],
    usage: { input_tokens: 10, output_tokens: 5 },
  } as any;
}

interface HarnessOptions {
  funnel?: Funnel;
  state?: UserStageState;
  apiKey?: string;
  replies?: any[];
  history?: MessageEntry[];
}

function createAssistantHarness(options: HarnessOptions = {}) {
  const funnel = options.funnel || buildFunnel({ enabled: true });
  const activeFunnels = new Map<string, Funnel>([[funnel.id, funnel]]);
  const subscriber: SubscriberProfile = {
    id: 42,
    firstName: "Нурлан",
    lastActive: new Date().toISOString(),
  };
  const globalSubscribers = new Map<number, SubscriberProfile>([[42, subscriber]]);
  const messageHistory = new Map<string, MessageEntry[]>([["42", options.history || [{
    id: "m1",
    from: "user",
    text: "Привет, где мой урок?",
    timestamp: new Date().toISOString(),
  }]]]);

  const sentMessages: string[] = [];
  const loggedMessages: Array<{ from: string; text: string }> = [];
  const resentStages: string[] = [];
  const savedSubscribers: SubscriberProfile[] = [];
  const requests: any[] = [];

  const replies = [...(options.replies || [textResponse("Урок уже у тебя в чате — держи ещё раз.")])];

  // Состояние подписчика в приложении живёт в общей карте, а не создаётся заново
  // на каждый вызов: дневной счётчик ассистента пишется именно в него.
  const state = options.state ?? buildState();

  const service = createAssistantService({
    activeFunnels,
    createMessage: async (params) => {
      // Копируем: сервис переиспользует объект параметров между итерациями.
      requests.push(JSON.parse(JSON.stringify(params)));
      return replies.shift() || textResponse("");
    },
    getApiKey: () => (options.apiKey === undefined ? "test-key" : options.apiKey),
    getUserState: () => state,
    getWebAppUrl: (funnelId, stageId, chatId) => `https://example.com/?funnel=${funnelId}&stage=${stageId}&chatId=${chatId}`,
    globalSubscribers,
    logMessage: async (_chatId, from, text) => { loggedMessages.push({ from, text }); },
    messageHistory,
    persistUserState: async () => undefined,
    saveSubscriber: async (profile) => { savedSubscribers.push(profile); },
    sendStageMessage: async (_bot, _chatId, _funnel, stage) => { resentStages.push(stage.id); },
  });

  const bot = {
    sendMessage: async (_chatId: number, text: string) => { sentMessages.push(text); },
  } as any;

  return { service, bot, funnel, state, subscriber, sentMessages, loggedMessages, resentStages, savedSubscribers, requests };
}

describe("funnel assistant", () => {
  it("молчит, если ассистент у воронки не включён", async () => {
    const harness = createAssistantHarness({ funnel: buildFunnel() });

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);

    expect(answered).toBe(false);
    expect(harness.requests).toHaveLength(0);
    expect(harness.sentMessages).toHaveLength(0);
  });

  it("молчит, пока не задан ключ API", async () => {
    const harness = createAssistantHarness({ apiKey: "" });

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);

    expect(answered).toBe(false);
    expect(harness.requests).toHaveLength(0);
  });

  it("отвечает подписчику и сохраняет ответ в истории переписки", async () => {
    const harness = createAssistantHarness();

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "Где мой урок?", harness.funnel);

    expect(answered).toBe(true);
    expect(harness.sentMessages).toEqual(["Урок уже у тебя в чате — держи ещё раз."]);
    expect(harness.loggedMessages).toEqual([{ from: "bot", text: "Урок уже у тебя в чате — держи ещё раз." }]);
  });

  it("держит структуру воронки в общем префиксе, а состояние подписчика — вне его", async () => {
    const harness = createAssistantHarness();

    await harness.service.handleIncomingMessage(harness.bot, 42, "Где мой урок?", harness.funnel);

    const [request] = harness.requests;
    expect(request.model).toBe("deepseek-v4-flash");
    // Префикс одинаков для всех подписчиков воронки — на нём и держится кеш,
    // который DeepSeek считает автоматически.
    expect(request.system[1].text).toContain("Первый урок");
    expect(request.system[1].text).toContain("Полный курс — 4900 RUB");
    // Имя и прогресс меняются от человека к человеку, поэтому идут после кеша.
    expect(JSON.stringify(request.system)).not.toContain("Нурлан");
    expect(request.messages[0].content).toContain("Нурлан");
    expect(request.messages[0].content).toContain("Текущий этап");
  });

  it("даёт только эскалацию, пока остальные действия не разрешены", async () => {
    const harness = createAssistantHarness();

    await harness.service.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);

    expect(harness.requests[0].tools.map((tool: any) => tool.name)).toEqual(["escalate_to_human"]);
  });

  it("добавляет инструменты, когда владелец воронки их разрешил", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ allowResendStage: true, allowPaymentLink: true }),
    });

    await harness.service.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);

    expect(harness.requests[0].tools.map((tool: any) => tool.name))
      .toEqual(["escalate_to_human", "resend_stage", "send_payment_page"]);
  });

  it("повторно отправляет этап, который подписчик уже получал", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ allowResendStage: true }),
      replies: [toolResponse("resend_stage", { stageId: "s1" }), textResponse("Отправил ещё раз.")],
    });

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "Потерял урок", harness.funnel);

    expect(answered).toBe(true);
    expect(harness.resentStages).toEqual(["s1"]);
  });

  it("не выдаёт этап, до которого подписчик ещё не дошёл", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ allowResendStage: true }),
      replies: [toolResponse("resend_stage", { stageId: "s2" }), textResponse("Этот урок откроется позже.")],
    });

    await harness.service.handleIncomingMessage(harness.bot, 42, "Дай сразу второй урок", harness.funnel);

    expect(harness.resentStages).toEqual([]);
    const toolResult = harness.requests[1].messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("ещё не получал");
  });

  it("отдаёт ссылку на оплату и цену с сервера, а не от модели", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ allowPaymentLink: true }),
      state: buildState({ currentStageId: "s2", sentStages: ["s1", "s2"] }),
      replies: [toolResponse("send_payment_page"), textResponse("Вот ссылка на оплату.")],
    });

    await harness.service.handleIncomingMessage(harness.bot, 42, "Как оплатить?", harness.funnel);

    const toolResult = harness.requests[1].messages.at(-1).content[0];
    expect(toolResult.is_error).toBeUndefined();
    expect(toolResult.content).toContain("stage=s2");
    expect(toolResult.content).toContain("Полный курс — 4900 RUB");
  });

  it("отказывает в ссылке на оплату, если платный этап подписчику ещё не открыт", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ allowPaymentLink: true }),
      replies: [toolResponse("send_payment_page"), textResponse("Пока рано.")],
    });

    await harness.service.handleIncomingMessage(harness.bot, 42, "Хочу купить", harness.funnel);

    expect(harness.requests[1].messages.at(-1).content[0].is_error).toBe(true);
  });

  it("помечает подписчика как ожидающего оператора при эскалации", async () => {
    const harness = createAssistantHarness({
      replies: [toolResponse("escalate_to_human", { reason: "просит возврат" }), textResponse("Передал коллеге.")],
    });

    await harness.service.handleIncomingMessage(harness.bot, 42, "Верните деньги", harness.funnel);

    expect(harness.subscriber.awaitingHumanReply).toBeTruthy();
    expect(harness.savedSubscribers).toHaveLength(1);
  });

  it("не отправляет ничего, если модель отклонила запрос", async () => {
    const refusal = { ...textResponse("не должно уйти"), stop_reason: "refusal" };
    const harness = createAssistantHarness({ replies: [refusal] });

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "…", harness.funnel);

    expect(answered).toBe(false);
    expect(harness.sentMessages).toHaveLength(0);
  });

  it("держит дневной лимит после перезапуска", async () => {
    const state = buildState();
    const funnel = buildFunnel({ dailyMessageLimit: 1 });

    const before = createAssistantHarness({ funnel, state, replies: [textResponse("Первый ответ")] });
    expect(await before.service.handleIncomingMessage(before.bot, 42, "Раз", funnel)).toBe(true);
    // Счётчик лежит в досье, а не в памяти процесса.
    expect(state.profile.assistantUsage?.count).toBe(1);

    // Новый инстанс сервиса — как после деплоя. Состояние подписчика то же.
    const after = createAssistantHarness({ funnel, state, replies: [textResponse("Второй ответ")] });
    expect(await after.service.handleIncomingMessage(after.bot, 42, "Два", funnel)).toBe(false);
    expect(after.sentMessages).toEqual([]);
  });

  it("не отвечает подписчику сверх дневного лимита", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ dailyMessageLimit: 1 }),
      replies: [textResponse("Первый ответ"), textResponse("Второй ответ")],
    });

    const first = await harness.service.handleIncomingMessage(harness.bot, 42, "Раз", harness.funnel);
    const second = await harness.service.handleIncomingMessage(harness.bot, 42, "Два", harness.funnel);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(harness.sentMessages).toEqual(["Первый ответ"]);
  });

  it("переживает ошибку API, не роняя обработчик сообщений", async () => {
    const harness = createAssistantHarness();
    const failing = createAssistantService({
      activeFunnels: new Map([[harness.funnel.id, harness.funnel]]),
      createMessage: async () => { throw new Error("network down"); },
      getApiKey: () => "test-key",
      getUserState: () => buildState(),
      getWebAppUrl: () => "https://example.com",
      globalSubscribers: new Map(),
      logMessage: async () => undefined,
      messageHistory: new Map(),
      persistUserState: async () => undefined,
      saveSubscriber: async () => undefined,
      sendStageMessage: async () => undefined,
    });

    const answered = await failing.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);

    expect(answered).toBe(false);
    expect(harness.sentMessages).toHaveLength(0);
  });
});

describe("персонализация дожима", () => {
  const TEMPLATE = "Нурлан, ты открыл урок, но не дошёл до конца. Вернись на пару минут.";

  it("не трогает шаблон, пока персонализация не включена", async () => {
    const harness = createAssistantHarness();

    const text = await harness.service.personalizeReminder(harness.funnel, 42, TEMPLATE);

    expect(text).toBe(TEMPLATE);
    expect(harness.requests).toHaveLength(0);
  });

  it("переписывает напоминание под подписчика", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ personalizeReminders: true }),
      replies: [textResponse("Нурлан, ты остановился на первом уроке — там осталось пять минут до результата.")],
    });

    const text = await harness.service.personalizeReminder(harness.funnel, 42, TEMPLATE);

    expect(text).toContain("пять минут");
    expect(text).not.toBe(TEMPLATE);
    // Тот же общий префикс, что и у ответов — кеш работает на оба сценария.
    expect(harness.requests[0].system[1].text).toContain("Первый урок");
    expect(harness.requests[0].messages[0].content).toContain("Состояние подписчика");
    expect(harness.requests[0].messages[0].content).toContain(TEMPLATE);
  });

  it("снимает кавычки, в которые модель любит заворачивать ответ", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ personalizeReminders: true }),
      replies: [textResponse('"Нурлан, вернись к уроку"')],
    });

    const text = await harness.service.personalizeReminder(harness.funnel, 42, TEMPLATE);

    expect(text).toBe("Нурлан, вернись к уроку");
  });

  it("отдаёт шаблон, если ИИ недоступен", async () => {
    const harness = createAssistantHarness({ funnel: buildFunnel({ personalizeReminders: true }) });
    const failing = createAssistantService({
      activeFunnels: new Map([[harness.funnel.id, harness.funnel]]),
      createMessage: async () => { throw new Error("network down"); },
      getApiKey: () => "test-key",
      getUserState: () => buildState(),
      getWebAppUrl: () => "https://example.com",
      globalSubscribers: new Map(),
      logMessage: async () => undefined,
      messageHistory: new Map(),
      persistUserState: async () => undefined,
      saveSubscriber: async () => undefined,
      sendStageMessage: async () => undefined,
    });

    await expect(failing.personalizeReminder(harness.funnel, 42, TEMPLATE)).resolves.toBe(TEMPLATE);
  });

  it("отдаёт шаблон, если модель вернула пустоту, простыню или отказ", async () => {
    const cases = [
      textResponse(""),
      textResponse("а".repeat(700)),
      { ...textResponse("не важно"), stop_reason: "refusal" },
    ];

    for (const reply of cases) {
      const harness = createAssistantHarness({
        funnel: buildFunnel({ personalizeReminders: true }),
        replies: [reply],
      });
      await expect(harness.service.personalizeReminder(harness.funnel, 42, TEMPLATE)).resolves.toBe(TEMPLATE);
    }
  });

  it("работает, даже когда ответы на входящие выключены", async () => {
    const harness = createAssistantHarness({
      funnel: buildFunnel({ personalizeReminders: true, replyToMessages: false }),
      replies: [textResponse("Персональный текст"), textResponse("Ответ на сообщение")],
    });

    const answered = await harness.service.handleIncomingMessage(harness.bot, 42, "Привет", harness.funnel);
    expect(answered).toBe(false);
    expect(harness.sentMessages).toHaveLength(0);

    const text = await harness.service.personalizeReminder(harness.funnel, 42, TEMPLATE);
    expect(text).toBe("Персональный текст");
  });
});
