// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StageCard from "./StageCard";
import type { FunnelStage } from "../types/funnel";

afterEach(cleanup);

function buildStage(partial: Partial<FunnelStage> = {}): FunnelStage {
  return {
    id: "s1",
    index: 0,
    title: "Урок 1",
    firstMessage: { text: "Смотри урок" },
    rules: [],
    reminders: [],
    ...partial,
  };
}

const stages: FunnelStage[] = [
  buildStage(),
  buildStage({ id: "s2", index: 1, title: "Урок 2" }),
  buildStage({ id: "s3", index: 2, title: "Урок 3" }),
];

function renderCard(stage: FunnelStage, onUpdate = vi.fn()) {
  render(
    <StageCard
      stage={stage}
      stages={stages}
      funnelId="f1"
      onUpdate={onUpdate}
      onDelete={() => undefined}
    />,
  );
  return onUpdate;
}

describe("StageCard: автопереход", () => {
  it("не предлагает автопереход, пока не выбран следующий этап", () => {
    renderCard(buildStage());

    expect(screen.queryByLabelText("Автопереход на следующий этап")).not.toBeInTheDocument();
  });

  it("по умолчанию воронка ждёт нажатия кнопки", () => {
    renderCard(buildStage({ nextStage: { targetStageId: "s2", label: "Далее: Урок 2" } }));

    expect(screen.getByLabelText("Автопереход на следующий этап")).toHaveTextContent("Ждать нажатия кнопки");
    expect(screen.getByText(/без нажатия он останется на этом этапе/)).toBeInTheDocument();
  });

  it("сохраняет выбранную задержку в переходе", () => {
    const onUpdate = renderCard(buildStage({ nextStage: { targetStageId: "s2", label: "Далее: Урок 2" } }));

    fireEvent.click(screen.getByLabelText("Автопереход на следующий этап"));
    fireEvent.click(screen.getByRole("option", { name: "Через 24 часа" }));

    const next: FunnelStage = onUpdate.mock.calls[0][0];
    expect(next.nextStage?.autoAdvanceMinutes).toBe(1440);
    expect(next.nextStage?.autoAdvanceLabel).toBe("24 часа");
  });

  it("не теряет задержку при смене этапа-получателя", () => {
    const onUpdate = renderCard(buildStage({
      nextStage: { targetStageId: "s2", label: "Далее: Урок 2", autoAdvanceMinutes: 1440, autoAdvanceLabel: "24 часа" },
    }));

    fireEvent.click(screen.getByLabelText("Переход на этап"));
    fireEvent.click(screen.getByRole("option", { name: /Урок 3/ }));

    const next: FunnelStage = onUpdate.mock.calls[0][0];
    expect(next.nextStage?.targetStageId).toBe("s3");
    expect(next.nextStage?.autoAdvanceMinutes).toBe(1440);
  });
});
