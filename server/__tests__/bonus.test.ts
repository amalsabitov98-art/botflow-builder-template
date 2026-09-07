import { describe, expect, it } from "vitest";
import { createBonusService } from "../services/bonus";
import type { Funnel, FunnelBonus } from "../types";
import type { UserStageState } from "../services/progress";

function buildFunnel(bonus?: Partial<FunnelBonus>): Funnel {
  return {
    id: "f1",
    title: "Курс",
    status: "active",
    subscribers: 0,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    stages: [],
    platform: {
      bonus: {
        enabled: true,
        perLesson: 200,
        perQuestion: 50,
        rewards: [
          { id: "r1", title: "Шаблон КП", price: 300, payload: "https://example.com/kp" },
          { id: "r2", title: "Разбор с куратором", price: 1000, minTier: "pkg-2" },
        ],
        ...bonus,
      },
    },
  };
}

function buildState(): UserStageState {
  return {
    funnelId: "f1",
    currentStageIndex: 0,
    timeouts: [],
    finished: false,
    sentStages: [],
    openedStages: [],
    viewedStages: [],
    completedStages: [],
    lastActionAt: new Date().toISOString(),
    events: [],
    reminderJobs: [],
    profile: { answers: {} },
  };
}

function createHarness(funnel: Funnel = buildFunnel()) {
  return createBonusService({ activeFunnels: new Map([[funnel.id, funnel]]) });
}

describe("бонусы", () => {
  it("начисляет за пройденный урок", () => {
    const service = createHarness();
    const state = buildState();

    const result = service.awardForLesson(state, "f1", "m1");

    expect(result).toEqual({ awarded: true, balance: 200 });
    expect(state.profile.bonus?.history[0].reason).toBe("Урок пройден");
  });

  it("не начисляет дважды за то же самое действие", () => {
    const service = createHarness();
    const state = buildState();

    service.awardForLesson(state, "f1", "m1");
    const second = service.awardForLesson(state, "f1", "m1");

    expect(second).toEqual({ awarded: false, balance: 200 });
    expect(state.profile.bonus?.history).toHaveLength(1);
  });

  it("снимает начисление, если урок разотметили", () => {
    const service = createHarness();
    const state = buildState();

    service.awardForLesson(state, "f1", "m1");
    service.revokeForLesson(state, "m1");

    expect(state.profile.bonus?.balance).toBe(0);
    // После снятия за тот же урок можно начислить снова.
    expect(service.awardForLesson(state, "f1", "m1")).toEqual({ awarded: true, balance: 200 });
  });

  it("не уводит баланс в минус, когда бонусы уже потрачены", () => {
    const service = createHarness();
    const state = buildState();

    service.award(state, "f1", "manual", 300, "Тест");
    service.awardForLesson(state, "f1", "m1");
    service.spend(state, "f1", "r1", "pkg-1");
    expect(state.profile.bonus?.balance).toBe(200);

    // Снимаем начисление за урок, хотя его уже частично потратили.
    service.revokeForLesson(state, "m1");
    expect(state.profile.bonus?.balance).toBe(0);
  });

  it("молчит, когда бонусы у воронки выключены", () => {
    const service = createHarness(buildFunnel({ enabled: false }));
    const state = buildState();

    expect(service.awardForLesson(state, "f1", "m1")).toEqual({ awarded: false, balance: 0 });
    expect(service.summary(state, "f1", "pkg-1")).toBeNull();
  });

  it("обменивает бонусы на награду по серверной цене", () => {
    const service = createHarness();
    const state = buildState();
    service.award(state, "f1", "manual", 500, "Тест");

    const result = service.spend(state, "f1", "r1", "pkg-1");

    expect(result.ok).toBe(true);
    expect(result.balance).toBe(200);
    expect(result.reward?.payload).toBe("https://example.com/kp");
  });

  it("отказывает, когда бонусов не хватает", () => {
    const service = createHarness();
    const state = buildState();
    service.award(state, "f1", "manual", 100, "Тест");

    const result = service.spend(state, "f1", "r1", "pkg-1");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("хватает");
    expect(state.profile.bonus?.balance).toBe(100);
  });

  it("не отдаёт награду чужого тарифа", () => {
    const service = createHarness();
    const state = buildState();
    service.award(state, "f1", "manual", 5000, "Тест");

    const denied = service.spend(state, "f1", "r2", "pkg-1");
    expect(denied.ok).toBe(false);
    expect(state.profile.bonus?.balance).toBe(5000);

    const allowed = service.spend(state, "f1", "r2", "pkg-2");
    expect(allowed.ok).toBe(true);
    expect(allowed.balance).toBe(4000);
  });

  it("показывает баланс, курс начислений и награды по тарифу", () => {
    const service = createHarness();
    const state = buildState();
    service.awardForQuestion(state, "f1", "goal");

    const summary = service.summary(state, "f1", "pkg-1")!;

    expect(summary.balance).toBe(50);
    expect(summary.perLesson).toBe(200);
    expect(summary.rewards.map(reward => reward.id)).toEqual(["r1"]);
    // Содержимое награды до обмена не раскрывается.
    expect(JSON.stringify(summary.rewards)).not.toContain("example.com");
  });
});
