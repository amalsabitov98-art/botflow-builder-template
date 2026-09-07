// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FunnelsPage from "./FunnelsPage";

function funnel(id: string, title: string, type?: string) {
  return { id, title, type, status: "draft", stages: [], createdAt: "2026-08-27" };
}

beforeEach(() => {
  // Страница подтягивает ботов, чтобы подписать карточки.
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ bots: [] }) })) as any);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderPage(funnels: any[]) {
  render(
    <FunnelsPage
      funnels={funnels}
      onOpenFunnel={() => undefined}
      onCreateFunnel={() => undefined}
      onDeleteFunnel={() => undefined}
    />,
  );
}

describe("FunnelsPage: вид воронки", () => {
  it("подписывает карточку видом оффера", () => {
    renderPage([funnel("f1", "Мини-курс", "lead")]);

    expect(screen.getByText("Лид-магнит")).toBeInTheDocument();
  });

  it("не придумывает вид тем, у кого его нет", () => {
    renderPage([funnel("f1", "Старая воронка")]);

    expect(screen.getByText("Без вида")).toBeInTheDocument();
  });

  it("не показывает фильтр, пока вид у всех один", () => {
    renderPage([funnel("f1", "Первая", "lead"), funnel("f2", "Вторая", "lead")]);

    expect(screen.queryByRole("button", { name: /^Все/ })).not.toBeInTheDocument();
  });

  it("оставляет только воронки выбранного вида", async () => {
    renderPage([
      funnel("f1", "Мини-курс", "lead"),
      funnel("f2", "Консультация", "sales"),
      funnel("f3", "Древняя"),
    ]);

    expect(screen.getByText("Мини-курс")).toBeInTheDocument();
    expect(screen.getByText("Консультация")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Продажа услуги/ }));

    await waitFor(() => expect(screen.queryByText("Мини-курс")).not.toBeInTheDocument());
    expect(screen.getByText("Консультация")).toBeInTheDocument();
    expect(screen.queryByText("Древняя")).not.toBeInTheDocument();
  });

  it("умеет собрать воронки без вида", async () => {
    renderPage([funnel("f1", "Мини-курс", "lead"), funnel("f2", "Древняя")]);

    fireEvent.click(screen.getByRole("button", { name: /Без вида/ }));

    await waitFor(() => expect(screen.queryByText("Мини-курс")).not.toBeInTheDocument());
    expect(screen.getByText("Древняя")).toBeInTheDocument();
  });
});
