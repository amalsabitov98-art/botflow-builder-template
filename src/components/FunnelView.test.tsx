// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FunnelView from "./FunnelView";

const legacyFunnel = {
  id: "funnel-legacy",
  title: "Старая воронка",
  status: "draft",
  stages: [],
  platform: {
    lessons: [
      { id: "l1", module: "Модуль 1", title: "Первый", minTier: "pkg-1" },
      { id: "l2", module: "Модуль 1", title: "Второй", minTier: "pkg-1" },
    ],
    sessions: [{ id: "s1", title: "Эфир" }],
  },
};

beforeEach(() => {
  // Редактор при открытии спрашивает ботов и список воронок.
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ bots: [] }),
  })) as any);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FunnelView", () => {
  it("показывает сводку по платформе и ведёт в её настройки", () => {
    const onOpenPlatform = vi.fn();
    render(<FunnelView onBack={() => undefined} initialData={legacyFunnel} onOpenPlatform={onOpenPlatform} />);

    expect(screen.getByText(/Программа: 2 уроков/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Открыть настройки/ }));
    expect(onOpenPlatform).toHaveBeenCalledWith("funnel-legacy");
  });

  it("не теряет настройки платформы у воронки старого формата", () => {
    const onUpdateFunnel = vi.fn();
    render(<FunnelView onBack={() => undefined} initialData={legacyFunnel} onUpdateFunnel={onUpdateFunnel} />);

    fireEvent.click(screen.getByTitle("Переименовать воронку"));
    const input = screen.getByDisplayValue("Старая воронка");
    fireEvent.change(input, { target: { value: "Новое имя" } });
    fireEvent.blur(input);

    expect(onUpdateFunnel).toHaveBeenCalledTimes(1);
    const saved = onUpdateFunnel.mock.calls[0][0];
    expect(saved.title).toBe("Новое имя");
    expect(saved.platform.lessons).toHaveLength(2);
    expect(saved.platform.sessions).toHaveLength(1);
  });

  it("даёт владельцу включить режим Telegram Mini App", () => {
    // Раньше режим был зашит в коде по id воронки, и включить его для своей
    // воронки было нельзя.
    const onUpdateFunnel = vi.fn();
    render(<FunnelView onBack={() => undefined} initialData={legacyFunnel} onUpdateFunnel={onUpdateFunnel} />);

    fireEvent.click(screen.getByRole("button", { name: /Открывать внутри Telegram/ }));

    expect(onUpdateFunnel).toHaveBeenCalledTimes(1);
    expect(onUpdateFunnel.mock.calls[0][0].telegramMiniApp).toBe(true);
  });
});
