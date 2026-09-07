import { describe, expect, it } from "vitest";
import { escapeTelegramHtml } from "../services/telegram";
import { isIncomingBusinessMessage, selectFunnelForChat } from "../services/botManager";
import type { Funnel } from "../types";

describe("Экранирование текста для Telegram", () => {
  it("не даёт чужому тексту сломать отправку", () => {
    // Один "<" в домашнем задании раньше приводил к 400 от Telegram, и карточка
    // куратору не уходила вовсе — работа зависала молча.
    expect(escapeTelegramHtml("if (x < 5) return;")).toBe("if (x &lt; 5) return;");
  });

  it("не даёт подрисовать разметку в чужое сообщение", () => {
    // Имя в профиле Telegram задаёт сам человек.
    expect(escapeTelegramHtml("<b>ОДОБРЕНО</b>")).toBe("&lt;b&gt;ОДОБРЕНО&lt;/b&gt;");
    expect(escapeTelegramHtml('<a href="https://зло.example">клик</a>'))
      .toBe("&lt;a href=\"https://зло.example\"&gt;клик&lt;/a&gt;");
  });

  it("экранирует амперсанд первым, без двойного экранирования", () => {
    expect(escapeTelegramHtml("Тарифы & цены")).toBe("Тарифы &amp; цены");
    expect(escapeTelegramHtml("&lt;")).toBe("&amp;lt;");
  });

  it("пустое значение остаётся пустым", () => {
    expect(escapeTelegramHtml("")).toBe("");
    expect(escapeTelegramHtml(undefined as unknown as string)).toBe("");
  });

  it("обычный текст не портит", () => {
    expect(escapeTelegramHtml("Сделал сайт, вот ссылка: https://site.example"))
      .toBe("Сделал сайт, вот ссылка: https://site.example");
  });
});

describe("Сообщения Telegram Business", () => {
  const owner = 100;
  const student = 42;

  it("обрабатывает сообщение собеседника", () => {
    expect(isIncomingBusinessMessage({ chat: { id: student }, from: { id: student } })).toBe(true);
  });

  it("пропускает то, что владелец написал сам", () => {
    // Иначе ответ владельца засчитывался как сдача домашки, и на него отвечал ИИ.
    expect(isIncomingBusinessMessage({ chat: { id: student }, from: { id: owner } })).toBe(false);
  });

  it("не падает на обновлении без чата или отправителя", () => {
    expect(isIncomingBusinessMessage({ from: { id: student } })).toBe(false);
    expect(isIncomingBusinessMessage({ chat: { id: student } })).toBe(false);
    expect(isIncomingBusinessMessage(undefined)).toBe(false);
  });
});

describe("Выбор воронки для личного чата", () => {
  function makeFunnel(id: string, connectedBotId: string): Funnel {
    return {
      id,
      title: id,
      status: "active",
      subscribers: 0,
      conversion: "0%",
      createdAt: new Date().toISOString(),
      connectedBotId,
      stages: [],
    };
  }

  const own = makeFunnel("f-own", "bot-1");
  const second = makeFunnel("f-second", "bot-1");
  const foreign = makeFunnel("f-foreign", "bot-2");

  it("берёт единственную воронку бота, даже если человек в ней ещё не отметился", () => {
    expect(selectFunnelForChat([own, foreign], "bot-1", () => undefined)).toBe(own);
  });

  it("не отдаёт воронку чужого бота", () => {
    expect(selectFunnelForChat([foreign], "bot-1", () => undefined)).toBeUndefined();
  });

  it("из нескольких воронок бота выбирает ту, где человек уже идёт", () => {
    // Business-чат не несёт ничего, кроме собеседника: без этого человек
    // попадал в первую попавшуюся воронку и мог закрыть этап в чужом курсе.
    const states: Record<string, { lastActionAt?: string }> = {
      "f-second": { lastActionAt: "2026-09-01T10:00:00.000Z" },
    };
    expect(selectFunnelForChat([own, second], "bot-1", (funnelId) => states[funnelId])).toBe(second);
  });

  it("при следах в нескольких воронках берёт самую свежую", () => {
    const states: Record<string, { lastActionAt?: string }> = {
      "f-own": { lastActionAt: "2026-09-01T10:00:00.000Z" },
      "f-second": { lastActionAt: "2026-09-05T10:00:00.000Z" },
    };
    expect(selectFunnelForChat([own, second], "bot-1", (funnelId) => states[funnelId])).toBe(second);
  });

  it("переживает состояние с битой датой", () => {
    const states: Record<string, { lastActionAt?: string }> = {
      "f-second": { lastActionAt: "не дата" },
    };
    expect(selectFunnelForChat([own, second], "bot-1", (funnelId) => states[funnelId])).toBe(second);
  });

  it("не угадывает курс, когда воронок несколько и следов человека нет", () => {
    expect(selectFunnelForChat([own, second], "bot-1", () => undefined)).toBeUndefined();
  });
});
