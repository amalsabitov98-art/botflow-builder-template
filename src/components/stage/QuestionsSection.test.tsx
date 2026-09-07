// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuestionsSection from "./QuestionsSection";
import type { FunnelStage } from "../../types/funnel";

afterEach(cleanup);

function buildStage(partial: Partial<FunnelStage> = {}): FunnelStage {
  return {
    id: "s1",
    index: 0,
    title: "Первый урок",
    firstMessage: { text: "Смотри урок" },
    rules: [],
    reminders: [],
    ...partial,
  };
}

const stages: FunnelStage[] = [buildStage(), buildStage({ id: "s2", index: 1, title: "Второй урок" })];

describe("QuestionsSection", () => {
  it("показывает пустое состояние, пока вопросов нет", () => {
    render(<QuestionsSection stage={buildStage()} stages={stages} onUpdate={() => undefined} />);

    expect(screen.getByText(/Пока вопросов нет/)).toBeInTheDocument();
  });

  it("добавляет вопрос с короткими идентификаторами", () => {
    const onUpdate = vi.fn();
    render(<QuestionsSection stage={buildStage()} stages={stages} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /Вопрос/ }));

    const next: FunnelStage = onUpdate.mock.calls[0][0];
    const question = next.questions![0];
    // Идентификаторы уезжают в callback_data, поэтому должны быть короткими.
    expect(question.id).toBe("q1");
    expect(question.options.map(option => option.id)).toEqual(["o1", "o2"]);
    expect(`ans:${question.id}:${question.options[0].id}`.length).toBeLessThan(64);
  });

  it("правит текст вопроса и чистит ключ профиля от лишних символов", () => {
    const onUpdate = vi.fn();
    const stage = buildStage({
      questions: [{ id: "q1", key: "goal", text: "Зачем тебе сайт?", options: [{ id: "o1", label: "Себе" }] }],
    });
    render(<QuestionsSection stage={stage} stages={stages} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByDisplayValue("Зачем тебе сайт?"), { target: { value: "{name}, зачем сайт?" } });
    expect(onUpdate.mock.calls[0][0].questions[0].text).toBe("{name}, зачем сайт?");

    fireEvent.change(screen.getByDisplayValue("goal"), { target: { value: "my goal!" } });
    expect(onUpdate.mock.calls[1][0].questions[0].key).toBe("mygoal");
  });

  it("не даёт удалить единственный вариант ответа", () => {
    const stage = buildStage({
      questions: [{ id: "q1", key: "goal", text: "Вопрос", options: [{ id: "o1", label: "Себе" }] }],
    });
    render(<QuestionsSection stage={stage} stages={stages} onUpdate={() => undefined} />);

    expect(screen.getByRole("button", { name: "Удалить вариант" })).toBeDisabled();
  });
});
