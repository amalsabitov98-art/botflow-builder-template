// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudienceFilterPicker from "./AudienceFilterPicker";
import { NO_SOURCE, type AudienceFilter } from "../../../shared/audience";

const options = {
  answers: [{
    key: "goal",
    label: "Зачем тебе сайт?",
    options: [{ id: "o1", label: "Себе" }, { id: "o2", label: "На заказ" }],
  }],
  sources: [{ value: "ad_vk_01", count: 12 }],
  withoutSource: 3,
};

function mockOptions(payload: unknown = options, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as any);
}

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderPicker(value: AudienceFilter = {}) {
  const onChange = vi.fn();
  render(<AudienceFilterPicker value={value} onChange={onChange} />);
  await waitFor(() => expect(screen.getByText("Зачем тебе сайт?")).toBeInTheDocument());
  return onChange;
}

describe("AudienceFilterPicker", () => {
  it("показывает вопросы воронки и метки источников", async () => {
    mockOptions();
    await renderPicker();

    expect(screen.getByRole("button", { name: /Себе/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ad_vk_01/ })).toBeInTheDocument();
    // Пришедшие без метки — тоже отбираемая группа.
    expect(screen.getByRole("button", { name: /Без метки/ })).toBeInTheDocument();
    expect(screen.getByText(/уйдёт всему сегменту/)).toBeInTheDocument();
  });

  it("добавляет вариант ответа в отбор", async () => {
    mockOptions();
    const onChange = await renderPicker();

    fireEvent.click(screen.getByRole("button", { name: /На заказ/ }));

    expect(onChange).toHaveBeenCalledWith({ answers: { goal: ["o2"] } });
  });

  it("снимает выбранный вариант и не оставляет пустой ключ", async () => {
    mockOptions();
    const onChange = await renderPicker({ answers: { goal: ["o2"] } });

    fireEvent.click(screen.getByRole("button", { name: /На заказ/ }));

    expect(onChange).toHaveBeenCalledWith({ answers: {} });
  });

  it("отбирает пришедших без метки", async () => {
    mockOptions();
    const onChange = await renderPicker();

    fireEvent.click(screen.getByRole("button", { name: /Без метки/ }));

    expect(onChange).toHaveBeenCalledWith({ sources: [NO_SOURCE] });
  });

  it("сбрасывает отбор целиком", async () => {
    mockOptions();
    const onChange = await renderPicker({ answers: { goal: ["o1"] }, sources: ["ad_vk_01"] });

    fireEvent.click(screen.getByRole("button", { name: /Сбросить/ }));

    expect(onChange).toHaveBeenCalledWith({});
  });

  it("объясняет пустоту, когда отбирать не по чему", async () => {
    mockOptions({ answers: [], sources: [], withoutSource: 0 });
    render(<AudienceFilterPicker value={{}} onChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText(/Отбирать пока не по чему/)).toBeInTheDocument());
  });
});
