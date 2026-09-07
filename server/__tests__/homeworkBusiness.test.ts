import { describe, expect, it, vi } from "vitest";
import { createProgressService } from "../services/progress";
import type { Funnel, SubscriberProfile } from "../types";

describe("Интерактивный челлендж: Домашние задания и Telegram Business", () => {
  const activeFunnels = new Map<string, Funnel>();

  const testFunnel: Funnel = {
    id: "f-challenge",
    title: "Практикум по вайб-кодингу",
    status: "active",
    subscribers: 5,
    conversion: "20%",
    createdAt: new Date().toISOString(),
    connectedBotId: "b1",
    stages: [
      {
        id: "stage-1",
        index: 0,
        title: "Урок 1: Первый сайт",
        firstMessage: { text: "Привет! Сделай сайт." },
        rules: [],
        reminders: [],
        requireHomework: true,
        homeworkCriteria: "Должна быть ссылка на сайт.",
      },
      {
        id: "stage-2",
        index: 1,
        title: "Урок 2: Интеграция с Telegram",
        firstMessage: { text: "Теперь привяжем бота." },
        rules: [],
        reminders: [],
        requireHomework: true,
      },
    ],
  };

  activeFunnels.set("f-challenge", testFunnel);

  it("сохраняет сданную домашку в досье студента со статусом pending_review", async () => {
    const progress = createProgressService({
      activeFunnels,
      getSupabase: () => null,
      getUseSupabase: () => false,
      progressFile: "/tmp/test_progress.json",
      progressStateRowId: "test",
    });

    const state = await progress.saveHomeworkSubmission(12345, "f-challenge", {
      id: "hw-1",
      stageId: "stage-1",
      stageTitle: "Урок 1: Первый сайт",
      submittedAt: new Date().toISOString(),
      content: "Вот мой сайт: https://mysite.netlify.app",
      aiFeedback: "Ссылка корректна, сайт работает.",
      status: "pending_review",
    });

    expect(state.profile.homeworks).toBeDefined();
    expect(state.profile.homeworks!["stage-1"]).toBeDefined();
    expect(state.profile.homeworks!["stage-1"].status).toBe("pending_review");
    expect(state.profile.homeworks!["stage-1"].content).toContain("netlify.app");
  });

  it("при одобрении домашки куратором продвигает этап и переводит статус в approved", async () => {
    const progress = createProgressService({
      activeFunnels,
      getSupabase: () => null,
      getUseSupabase: () => false,
      progressFile: "/tmp/test_progress.json",
      progressStateRowId: "test",
    });

    // Сначала сдаем работу
    await progress.saveHomeworkSubmission(54321, "f-challenge", {
      id: "hw-2",
      stageId: "stage-1",
      stageTitle: "Урок 1: Первый сайт",
      submittedAt: new Date().toISOString(),
      content: "Сдал проект",
      status: "pending_review",
    });

    // Одобряем куратором
    const result = await progress.updateHomeworkStatus(
      54321,
      "f-challenge",
      "stage-1",
      "approved",
      "Отличный проект!",
    );

    expect(result.success).toBe(true);
    expect(result.nextStageId).toBe("stage-2");
    expect(result.state?.currentStageId).toBe("stage-2");
    expect(result.state?.completedStages).toContain("stage-1");
    expect(result.state?.profile.homeworks!["stage-1"].status).toBe("approved");
    expect(result.state?.profile.homeworks!["stage-1"].reviewerComment).toBe("Отличный проект!");
  });

  it("при отправке на доработку сохраняет статус rejected без продвижения этапа", async () => {
    const progress = createProgressService({
      activeFunnels,
      getSupabase: () => null,
      getUseSupabase: () => false,
      progressFile: "/tmp/test_progress.json",
      progressStateRowId: "test",
    });

    await progress.saveHomeworkSubmission(99999, "f-challenge", {
      id: "hw-3",
      stageId: "stage-1",
      stageTitle: "Урок 1",
      submittedAt: new Date().toISOString(),
      content: "забыл прикрепить ссылку",
      status: "pending_review",
    });

    const result = await progress.updateHomeworkStatus(
      99999,
      "f-challenge",
      "stage-1",
      "rejected",
      "Пришли ссылку",
    );

    expect(result.success).toBe(true);
    expect(result.nextStageId).toBeUndefined();
    expect(result.state?.completedStages).not.toContain("stage-1");
    expect(result.state?.profile.homeworks!["stage-1"].status).toBe("rejected");
  });
});
