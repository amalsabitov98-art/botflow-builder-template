// Отбор аудитории поверх сегмента. Сегменты отвечают на вопрос «на каком шаге
// человек застрял», а этот фильтр — «что он про себя рассказал и откуда пришёл».
// Пусто — рассылка уходит всему сегменту, как было до появления фильтра.

// Псевдо-метка для тех, кто пришёл без диплинка: у них источника нет вовсе,
// и отличить их от «пришёл по метке X» иначе нельзя.
export const NO_SOURCE = "__none__";

// Пределы: фильтр приходит из админки, но проходит через API как обычные данные.
export const MAX_FILTER_KEYS = 10;
export const MAX_FILTER_VALUES = 30;
const MAX_VALUE_LENGTH = 64;

export interface AudienceFilter {
  // Ключ профиля (goal, level…) → подходящие варианты ответа (их id).
  // Внутри ключа варианты складываются по «или», между ключами — по «и»:
  // «цель = заказы И уровень = новичок».
  answers?: Record<string, string[]>;
  // Метки диплинков; NO_SOURCE — те, кто пришёл без метки.
  sources?: string[];
}

export function isEmptyAudienceFilter(filter?: AudienceFilter | null): boolean {
  if (!filter) return true;
  const hasAnswers = Object.values(filter.answers || {}).some((values) => values.length > 0);
  return !hasAnswers && !(filter.sources || []).length;
}

function cleanValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = String(item ?? "").trim().slice(0, MAX_VALUE_LENGTH);
    if (text) seen.add(text);
    if (seen.size >= MAX_FILTER_VALUES) break;
  }
  return Array.from(seen);
}

/**
 * Приводит фильтр к безопасной форме: обрезает длину, снимает дубли, выкидывает
 * пустые ключи. Возвращает undefined, если отбирать в итоге не по чему —
 * так пустой фильтр не сохраняется в кампанию и не путает историю рассылок.
 */
export function normalizeAudienceFilter(value: unknown): AudienceFilter | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;

  const answers: Record<string, string[]> = {};
  if (raw.answers && typeof raw.answers === "object") {
    for (const [key, values] of Object.entries(raw.answers as Record<string, unknown>)) {
      if (Object.keys(answers).length >= MAX_FILTER_KEYS) break;
      const cleanKey = String(key).trim().slice(0, MAX_VALUE_LENGTH);
      if (!cleanKey) continue;
      const cleaned = cleanValues(values);
      if (cleaned.length) answers[cleanKey] = cleaned;
    }
  }

  const sources = cleanValues(raw.sources);
  const filter: AudienceFilter = {
    ...(Object.keys(answers).length ? { answers } : {}),
    ...(sources.length ? { sources } : {}),
  };

  return isEmptyAudienceFilter(filter) ? undefined : filter;
}

// Досье в том виде, в каком фильтру нужно его знать. Сервер передаёт сюда
// профиль подписчика, а тесты — что угодно похожей формы.
interface FilterableProfile {
  answers?: Record<string, { optionId?: string } | undefined>;
  source?: { value?: string };
}

/**
 * Подходит ли подписчик под фильтр. Нет досье — значит, человек ничего о себе
 * не рассказал: под любое условие по ответам он не подходит.
 */
export function matchesAudienceFilter(profile: FilterableProfile | undefined | null, filter?: AudienceFilter | null): boolean {
  if (isEmptyAudienceFilter(filter)) return true;

  for (const [key, values] of Object.entries(filter?.answers || {})) {
    if (!values.length) continue;
    const answer = profile?.answers?.[key];
    if (!answer?.optionId || !values.includes(answer.optionId)) return false;
  }

  const sources = filter?.sources || [];
  if (sources.length) {
    const source = profile?.source?.value || "";
    const matches = source ? sources.includes(source) : sources.includes(NO_SOURCE);
    if (!matches) return false;
  }

  return true;
}
