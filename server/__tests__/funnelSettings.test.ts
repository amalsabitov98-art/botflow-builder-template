import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { DEEPSEEK_API_BASE_URL } from "../services/deepseek";
import { isTelegramMiniAppFunnel } from "../services/telegram";
import { getStagePaymentOffers } from "../services/paymentOffers";
import type { Funnel } from "../types";

function funnel(overrides: Partial<Funnel> & { id: string }): Funnel {
  return {
    title: "Тестовая воронка",
    status: "active",
    subscribers: 0,
    conversion: "0%",
    createdAt: new Date().toISOString(),
    stages: [],
    ...overrides,
  } as Funnel;
}

describe("Режим Telegram Mini App", () => {
  it("берётся из поля воронки", () => {
    expect(isTelegramMiniAppFunnel(funnel({ id: "f1", telegramMiniApp: true }))).toBe(true);
    expect(isTelegramMiniAppFunnel(funnel({ id: "f1", telegramMiniApp: false }))).toBe(false);
  });

  it("по умолчанию выключен: страница открывается обычной ссылкой", () => {
    expect(isTelegramMiniAppFunnel(funnel({ id: "новая-воронка" }))).toBe(false);
    expect(isTelegramMiniAppFunnel(undefined)).toBe(false);
  });

  it("не зависит от идентификатора воронки", () => {
    // Раньше режим включался по совпадению id со строкой в коде.
    expect(isTelegramMiniAppFunnel(funnel({ id: "demo-funnel-copy" }))).toBe(false);
    expect(isTelegramMiniAppFunnel(funnel({ id: "demo-funnel-copy", telegramMiniApp: true }))).toBe(true);
  });
});

describe("Офферы этапа", () => {
  const stageWithOffers = (paymentOffers?: any[]) => funnel({
    id: "demo-funnel",
    stages: [{
      id: "stage-3",
      index: 0,
      title: "Продажа",
      firstMessage: { text: "" },
      rules: [],
      reminders: [],
      webApp: {
        enabled: true,
        blocks: [],
        theme: "cosmic",
        pageEvents: [],
        ...(paymentOffers ? { paymentOffers } : {}),
      },
    }],
  });

  it("берутся из настроек этапа", () => {
    const funnels = new Map([["demo-funnel", stageWithOffers([
      { offerId: "offer-pkg-1", tier: "pkg-1", amount: 49, currency: "USD", product: "Пакет 1" },
      { offerId: "offer-pkg-2", tier: "pkg-2", amount: 99, currency: "USD", product: "Пакет 2" },
    ])]]);

    const offers = getStagePaymentOffers(funnels, "demo-funnel", "stage-3");
    expect(offers.map((offer) => offer.offerId)).toEqual(["offer-pkg-1", "offer-pkg-2"]);
    expect(offers[0]).toMatchObject({ amount: 49, currency: "USD", tier: "pkg-1" });
  });

  it("не подставляются по идентификатору воронки", () => {
    // Цены жили в коде и появлялись у двух воронок сами собой.
    const funnels = new Map([["demo-funnel", stageWithOffers()]]);
    expect(getStagePaymentOffers(funnels, "demo-funnel", "stage-3")).toEqual([]);
  });

  it("у новой воронки офферов нет, пока их не завели", () => {
    const funnels = new Map([["своя-воронка", funnel({
      id: "своя-воронка",
      stages: [{
        id: "stage-3",
        index: 0,
        title: "Продажа",
        firstMessage: { text: "" },
        rules: [],
        reminders: [],
        webApp: { enabled: true, blocks: [], theme: "cosmic", pageEvents: [] },
      }],
    })]]);

    expect(getStagePaymentOffers(funnels, "своя-воронка", "stage-3")).toEqual([]);
  });
});

// Весь серверный код: server/ без тестов, общие типы и точка входа.
const projectRoot = path.resolve(__dirname, "..", "..");

function serverSourcesContaining(needle: string, allowed: string[]): string[] {
  const offenders: string[] = [];
  const allowedPaths = allowed.map((item) => path.resolve(projectRoot, item));

  const check = (full: string) => {
    if (!full.endsWith(".ts") || allowedPaths.includes(full)) return;
    if (fs.readFileSync(full, "utf8").includes(needle)) {
      offenders.push(path.relative(projectRoot, full));
    }
  };

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
      } else {
        check(full);
      }
    }
  };

  walk(path.join(projectRoot, "server"));
  walk(path.join(projectRoot, "shared"));
  check(path.join(projectRoot, "server.ts"));

  return offenders;
}

describe("Сервер ничего не знает про конкретные воронки", () => {
  it("ни один модуль не упоминает идентификатор воронки", () => {
    expect(serverSourcesContaining("vibecoding", [])).toEqual([]);
  });
});

describe("Адрес DeepSeek", () => {
  it("ведёт на Anthropic-совместимый эндпоинт", () => {
    // SDK дописывает /v1/messages, поэтому без /anthropic запрос уходит в никуда:
    // именно так молча ломался ИИ-разбор домашних заданий.
    expect(DEEPSEEK_API_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });

  it("не задан отдельно ни в одном другом модуле сервера", () => {
    expect(serverSourcesContaining("api.deepseek.com", ["server/services/deepseek.ts"])).toEqual([]);
  });
});
