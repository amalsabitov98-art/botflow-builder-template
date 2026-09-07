import { describe, expect, it } from "vitest";
import {
  MAX_FILTER_VALUES,
  NO_SOURCE,
  isEmptyAudienceFilter,
  matchesAudienceFilter,
  normalizeAudienceFilter,
} from "../../shared/audience";

function profile(answers: Record<string, string>, source?: string) {
  return {
    answers: Object.fromEntries(
      Object.entries(answers).map(([key, optionId]) => [key, { optionId }]),
    ),
    ...(source ? { source: { value: source } } : {}),
  };
}

describe("отбор аудитории: нормализация", () => {
  it("выкидывает пустой фильтр целиком", () => {
    expect(normalizeAudienceFilter(undefined)).toBeUndefined();
    expect(normalizeAudienceFilter({})).toBeUndefined();
    expect(normalizeAudienceFilter({ answers: {}, sources: [] })).toBeUndefined();
    // Ключ без вариантов ничего не отбирает — значит, фильтра нет.
    expect(normalizeAudienceFilter({ answers: { goal: [] } })).toBeUndefined();
  });

  it("снимает дубли и обрезает длину", () => {
    const filter = normalizeAudienceFilter({
      answers: { goal: ["o1", "o1", " o2 "] },
      sources: ["vk", "vk"],
    });

    expect(filter).toEqual({ answers: { goal: ["o1", "o2"] }, sources: ["vk"] });
  });

  it("не даёт раздуть фильтр через API", () => {
    const many = Array.from({ length: MAX_FILTER_VALUES + 20 }, (_value, index) => `o${index}`);
    const filter = normalizeAudienceFilter({ answers: { goal: many } });

    expect(filter?.answers?.goal).toHaveLength(MAX_FILTER_VALUES);
  });

  it("переживает мусор вместо фильтра", () => {
    expect(normalizeAudienceFilter("нет")).toBeUndefined();
    expect(normalizeAudienceFilter({ answers: "нет", sources: 5 })).toBeUndefined();
    expect(isEmptyAudienceFilter(null)).toBe(true);
  });
});

describe("отбор аудитории: совпадение", () => {
  it("без фильтра подходит кто угодно", () => {
    expect(matchesAudienceFilter(undefined, undefined)).toBe(true);
    expect(matchesAudienceFilter(profile({}), {})).toBe(true);
  });

  it("внутри вопроса варианты складываются по «или»", () => {
    const filter = { answers: { goal: ["o1", "o2"] } };

    expect(matchesAudienceFilter(profile({ goal: "o1" }), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({ goal: "o2" }), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({ goal: "o3" }), filter)).toBe(false);
  });

  it("между вопросами — по «и»", () => {
    const filter = { answers: { goal: ["o1"], level: ["beginner"] } };

    expect(matchesAudienceFilter(profile({ goal: "o1", level: "beginner" }), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({ goal: "o1", level: "pro" }), filter)).toBe(false);
    // На второй вопрос человек просто не ответил.
    expect(matchesAudienceFilter(profile({ goal: "o1" }), filter)).toBe(false);
  });

  it("человек без досье не подходит под условие по ответам", () => {
    expect(matchesAudienceFilter(undefined, { answers: { goal: ["o1"] } })).toBe(false);
  });

  it("отбирает по метке диплинка", () => {
    const filter = { sources: ["ad_vk_01"] };

    expect(matchesAudienceFilter(profile({}, "ad_vk_01"), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({}, "ad_tg_02"), filter)).toBe(false);
    expect(matchesAudienceFilter(profile({}), filter)).toBe(false);
  });

  it("умеет отобрать пришедших без метки", () => {
    const filter = { sources: [NO_SOURCE] };

    expect(matchesAudienceFilter(profile({}), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({}, "ad_vk_01"), filter)).toBe(false);
  });

  it("ответы и источник тоже складываются по «и»", () => {
    const filter = { answers: { goal: ["o1"] }, sources: ["ad_vk_01"] };

    expect(matchesAudienceFilter(profile({ goal: "o1" }, "ad_vk_01"), filter)).toBe(true);
    expect(matchesAudienceFilter(profile({ goal: "o1" }, "ad_tg_02"), filter)).toBe(false);
    expect(matchesAudienceFilter(profile({ goal: "o9" }, "ad_vk_01"), filter)).toBe(false);
  });
});
