import { describe, expect, it } from "vitest";
import { createNurtureService } from "../services/nurture";
import type { NurtureDecision } from "../services/assistant";
import type { Funnel, FunnelAssistant, SubscriberProfile } from "../types";
import type { UserStageState } from "../services/progress";

// Полдень: вне тихих часов, чтобы касание разрешалось.
const NOON = new Date("2026-08-27T12:00:00");
const HOUR = 3_600_000;

function buildFunnel(assistant: Partial<FunnelAssistant> = {}): Funnel {
  return {
    id: "f1",
    title: "Вайб-кодинг",
    status: "active",
    subscribers: 1,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    connectedBotId: "bot1",
    assistant: { enabled: true, nurtureEnabled: true, ...assistant },
    stages: [],
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
    // Молчит уже неделю — первое касание разрешено.
    lastActionAt: new Date(NOON.getTime() - 24 * 7 * HOUR).toISOString(),
    events: [],
    reminderJobs: [],
    profile: { answers: {} },
    ...partial,
  };
}

interface HarnessOptions {
  funnel?: Funnel;
  lastBotMessageAt?: string;
  state?: UserStageState;
  subscriber?: Partial<SubscriberProfile>;
  decision?: NurtureDecision;
  sendFails?: any;
  now?: Date;
}

function createNurtureHarness(options: HarnessOptions = {}) {
  const funnel = options.funnel || buildFunnel();
  const state = options.state || buildState();
  const sent: string[] = [];
  const logged: string[] = [];
  const planCalls: number[] = [];

  const bot = {
    sendMessage: async (_chatId: number, text: string) => {
      if (options.sendFails) throw options.sendFails;
      sent.push(text);
    },
  } as any;

  const service = createNurtureService({
    activeFunnels: new Map([[funnel.id, funnel]]),
    botInstances: new Map([["bot1", bot]]),
    globalSubscribers: new Map([[42, {
      id: 42,
      firstName: "Нурлан",
      lastActive: new Date().toISOString(),
      ...options.subscriber,
    }]]),
    logMessage: async (_chatId, _from, text) => { logged.push(text); },
    messageHistory: new Map(options.lastBotMessageAt
      ? [["42", [{ id: "m1", from: "bot" as const, text: "Рассылка", timestamp: options.lastBotMessageAt }]]]
      : []),
    now: () => options.now || NOON,
    persistUserState: async () => undefined,
    planNurtureTouch: async (_funnel, chatId) => {
      planCalls.push(chatId);
      return options.decision || { action: "send", message: "Персональное касание", reason: "человек застрял на первом уроке" };
    },
    userStates: new Map([["42:f1", state]]),
  });

  return { service, state, sent, logged, planCalls };
}

describe("длинный ИИ-дожим", () => {
  it("отправляет касание и записывает его в досье", async () => {
    const harness = createNurtureHarness();

    await harness.service.tick();

    expect(harness.sent).toEqual(["Персональное касание"]);
    expect(harness.logged).toEqual(["Персональное касание"]);
    const nurture = harness.state.profile.nurture!;
    expect(nurture.touches).toHaveLength(1);
    expect(nurture.touches[0].reason).toContain("застрял");
    expect(nurture.nextTouchAt).toBeTruthy();
  });


  it("не пишет следом за недавней рассылкой", async () => {
    // Рассылка ушла три часа назад — дожим ждёт, а не наслаивается сверху.
    const harness = createNurtureHarness({
      lastBotMessageAt: new Date(NOON.getTime() - 3 * HOUR).toISOString(),
    });

    await harness.service.tick();

    expect(harness.sent).toHaveLength(0);
    expect(harness.planCalls).toHaveLength(0);
    const gap = (new Date(harness.state.profile.nurture!.nextTouchAt!).getTime() - NOON.getTime()) / HOUR;
    expect(gap).toBeCloseTo(21, 5);
  });

  it("пишет, когда после прошлого сообщения бота прошли сутки", async () => {
    const harness = createNurtureHarness({
      lastBotMessageAt: new Date(NOON.getTime() - 30 * HOUR).toISOString(),
    });

    await harness.service.tick();

    expect(harness.sent).toEqual(["Персональное касание"]);
  });

  describe("кого не трогает вообще", () => {
    const skipCases: Array<[string, HarnessOptions]> = [
      ["дожим выключен у воронки", { funnel: buildFunnel({ nurtureEnabled: false }) }],
      ["ассистент выключен целиком", { funnel: buildFunnel({ enabled: false }) }],
      ["подписчик уже оплатил", { state: buildState({ purchaseStatus: "paid" }) }],
      ["подписчик заблокировал бота", { subscriber: { botBlockedAt: new Date().toISOString() } }],
      ["ждёт живого оператора", { subscriber: { awaitingHumanReply: new Date().toISOString() } }],
      ["дожим уже остановлен", {
        state: buildState({ profile: { answers: {}, nurture: { touches: [], stoppedReason: "просил не писать" } } }),
      }],
      ["молчит меньше минимального интервала", {
        state: buildState({ lastActionAt: new Date(NOON.getTime() - 2 * HOUR).toISOString() }),
      }],
      ["время следующего касания ещё не пришло", {
        state: buildState({
          profile: { answers: {}, nurture: { touches: [], nextTouchAt: new Date(NOON.getTime() + 5 * HOUR).toISOString() } },
        }),
      }],
    ];

    for (const [name, options] of skipCases) {
      it(name, async () => {
        const harness = createNurtureHarness(options);

        await harness.service.tick();

        expect(harness.sent).toHaveLength(0);
        // К модели даже не обращаемся: предохранители стоят до вызова.
        expect(harness.planCalls).toHaveLength(0);
      });
    }
  });

  it("не пишет ночью, а переносит касание на утро", async () => {
    const harness = createNurtureHarness({ now: new Date("2026-08-27T23:30:00") });

    await harness.service.tick();

    expect(harness.sent).toHaveLength(0);
    expect(harness.planCalls).toHaveLength(0);
    const next = new Date(harness.state.profile.nurture!.nextTouchAt!);
    expect(next.getHours()).toBe(10);
    expect(next.getDate()).toBe(28);
  });

  it("держит минимальный разрыв, даже если модель просит вернуться раньше", async () => {
    const harness = createNurtureHarness({
      funnel: buildFunnel({ nurtureMinGapHours: 48 }),
      decision: { action: "send", message: "Скоро вернусь", waitHours: 1, reason: "хочу написать завтра" },
    });

    await harness.service.tick();

    const gap = (new Date(harness.state.profile.nurture!.nextTouchAt!).getTime() - NOON.getTime()) / HOUR;
    expect(gap).toBe(48);
  });

  it("не откладывает касание дальше двух недель", async () => {
    const harness = createNurtureHarness({
      decision: { action: "wait", waitHours: 24 * 90, reason: "подожду до осени" },
    });

    await harness.service.tick();

    const gap = (new Date(harness.state.profile.nurture!.nextTouchAt!).getTime() - NOON.getTime()) / HOUR;
    expect(gap).toBe(24 * 14);
    expect(harness.sent).toHaveLength(0);
  });

  it("останавливает дожим, когда касания исчерпаны", async () => {
    const touches = Array.from({ length: 6 }, (_, index) => ({
      at: new Date(NOON.getTime() - (index + 1) * 72 * HOUR).toISOString(),
      message: `касание ${index + 1}`,
      reason: "напоминание",
    }));
    const harness = createNurtureHarness({
      state: buildState({ profile: { answers: {}, nurture: { touches, startedAt: NOON.toISOString() } } }),
    });

    await harness.service.tick();

    expect(harness.state.profile.nurture!.stoppedReason).toContain("лимит касаний");
    expect(harness.sent).toHaveLength(0);
    expect(harness.planCalls).toHaveLength(0);
  });

  it("останавливает дожим, когда закончилось окно", async () => {
    const harness = createNurtureHarness({
      state: buildState({
        profile: {
          answers: {},
          nurture: { touches: [], startedAt: new Date(NOON.getTime() - 24 * 40 * HOUR).toISOString() },
        },
      }),
    });

    await harness.service.tick();

    expect(harness.state.profile.nurture!.stoppedReason).toContain("окно дожима");
    expect(harness.sent).toHaveLength(0);
  });

  it("подчиняется решению модели прекратить", async () => {
    const harness = createNurtureHarness({
      decision: { action: "stop", reason: "человек трижды не ответил" },
    });

    await harness.service.tick();

    expect(harness.state.profile.nurture!.stoppedReason).toBe("человек трижды не ответил");
    expect(harness.sent).toHaveLength(0);
  });

  it("просто ждёт, если модель не дала текста", async () => {
    const harness = createNurtureHarness({
      decision: { action: "send", reason: "нечего сказать" },
    });

    await harness.service.tick();

    expect(harness.sent).toHaveLength(0);
    expect(harness.state.profile.nurture!.touches).toHaveLength(0);
    expect(harness.state.profile.nurture!.nextTouchAt).toBeTruthy();
  });

  it("прекращает дожим, если Telegram ответил 403", async () => {
    const blocked: any = new Error("Forbidden: bot was blocked by the user");
    blocked.response = { body: { error_code: 403 } };
    const harness = createNurtureHarness({ sendFails: blocked });

    await harness.service.tick();

    expect(harness.state.profile.nurture!.stoppedReason).toContain("заблокировал бота");
    expect(harness.state.profile.nurture!.touches).toHaveLength(0);
  });
});
