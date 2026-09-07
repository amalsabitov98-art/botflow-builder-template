import type { BonusReward, Funnel } from "../types";
import type { UserStageState } from "./progress";

// История не должна расти бесконечно: держим последние движения.
const MAX_HISTORY = 200;

export interface BonusResult {
  awarded: boolean;
  balance: number;
}

export interface SpendResult {
  ok: boolean;
  balance: number;
  error?: string;
  reward?: BonusReward;
}

function ensureBonus(state: UserStageState) {
  if (!state.profile) state.profile = { answers: {} };
  if (!state.profile.bonus) state.profile.bonus = { balance: 0, history: [] };
  // Migrate older profiles before their bounded history loses award keys.
  if (!state.profile.bonus.awards) {
    state.profile.bonus.awards = Object.fromEntries(state.profile.bonus.history
      .filter((entry) => entry.amount > 0).map((entry) => [entry.id, entry.amount]));
  }
  return state.profile.bonus;
}

export function createBonusService({ activeFunnels }: { activeFunnels: Map<string, Funnel> }) {
  function getConfig(funnelId: string) {
    return activeFunnels.get(funnelId)?.platform?.bonus;
  }

  function isEnabled(funnelId: string) {
    return Boolean(getConfig(funnelId)?.enabled);
  }

  function getBalance(state: UserStageState) {
    return state.profile?.bonus?.balance || 0;
  }

  /**
   * Начисляет бонусы за действие. Ключ делает операцию идемпотентной:
   * повторный вызов с тем же ключом ничего не меняет, сколько бы раз
   * клиент ни отправил запрос.
   */
  function award(state: UserStageState, funnelId: string, key: string, amount: number, reason: string): BonusResult {
    if (!isEnabled(funnelId) || !Number.isFinite(amount) || amount <= 0) {
      return { awarded: false, balance: getBalance(state) };
    }

    const bonus = ensureBonus(state);
    if (Object.hasOwn(bonus.awards!, key)) {
      return { awarded: false, balance: bonus.balance };
    }

    bonus.balance += Math.round(amount);
    bonus.awards![key] = Math.round(amount);
    bonus.history.push({ id: key, at: new Date().toISOString(), amount: Math.round(amount), reason });
    if (bonus.history.length > MAX_HISTORY) bonus.history.splice(0, bonus.history.length - MAX_HISTORY);

    return { awarded: true, balance: bonus.balance };
  }

  // Снятие начисления, если действие отменили: урок сняли с отметки «пройден».
  function revoke(state: UserStageState, key: string): BonusResult {
    if (!state.profile?.bonus) return { awarded: false, balance: 0 };
    const bonus = ensureBonus(state);
    const amount = Object.hasOwn(bonus.awards!, key) ? bonus.awards![key] : 0;
    // Spent credit cannot be revoked without debt. Keep its award key so
    // unchecking/rechecking the lesson cannot create another spendable credit.
    if (!amount || bonus.balance < amount) return { awarded: false, balance: bonus.balance };
    delete bonus.awards![key];
    bonus.history = bonus.history.filter((entry) => entry.id !== key);
    bonus.balance -= amount;
    return { awarded: true, balance: bonus.balance };
  }

  function awardForLesson(state: UserStageState, funnelId: string, lessonId: string) {
    const amount = getConfig(funnelId)?.perLesson || 0;
    return award(state, funnelId, `lesson:${lessonId}`, amount, "Урок пройден");
  }

  function revokeForLesson(state: UserStageState, lessonId: string) {
    return revoke(state, `lesson:${lessonId}`);
  }

  function awardForQuestion(state: UserStageState, funnelId: string, questionKey: string) {
    const amount = getConfig(funnelId)?.perQuestion || 0;
    return award(state, funnelId, `question:${questionKey}`, amount, "Ответ на вопрос");
  }

  function rewardsForTier(funnelId: string, tier: 'pkg-1' | 'pkg-2'): BonusReward[] {
    const rewards = getConfig(funnelId)?.rewards || [];
    return rewards.filter((reward) => tier === "pkg-2" || (reward.minTier || "pkg-1") === "pkg-1");
  }

  /**
   * Обменивает бонусы на награду. Списание идёт по серверной цене:
   * сколько стоит награда, решает конфигурация воронки, а не клиент.
   */
  function spend(state: UserStageState, funnelId: string, rewardId: string, tier: 'pkg-1' | 'pkg-2'): SpendResult {
    if (!isEnabled(funnelId)) {
      return { ok: false, balance: getBalance(state), error: "Бонусы не подключены" };
    }

    const reward = rewardsForTier(funnelId, tier).find((item) => item.id === rewardId);
    if (!reward) {
      return { ok: false, balance: getBalance(state), error: "Награда недоступна" };
    }

    const bonus = ensureBonus(state);
    const price = Math.max(0, Math.round(reward.price || 0));
    if (bonus.balance < price) {
      return { ok: false, balance: bonus.balance, error: "Не хватает бонусов" };
    }

    bonus.balance -= price;
    bonus.history.push({
      id: `reward:${reward.id}:${Date.now()}`,
      at: new Date().toISOString(),
      amount: -price,
      reason: `Обмен: ${reward.title}`,
    });
    if (bonus.history.length > MAX_HISTORY) bonus.history.splice(0, bonus.history.length - MAX_HISTORY);

    return { ok: true, balance: bonus.balance, reward };
  }

  function summary(state: UserStageState, funnelId: string, tier: 'pkg-1' | 'pkg-2') {
    const config = getConfig(funnelId);
    if (!config?.enabled) return null;
    const bonus = state.profile?.bonus;
    return {
      balance: bonus?.balance || 0,
      currencyLabel: config.currencyLabel || "бонусов",
      perLesson: config.perLesson || 0,
      perQuestion: config.perQuestion || 0,
      history: (bonus?.history || []).slice(-20).reverse(),
      rewards: rewardsForTier(funnelId, tier).map((reward) => ({
        id: reward.id,
        title: reward.title,
        description: reward.description || "",
        price: reward.price,
        // Содержимое награды отдаём только после обмена.
        unlocked: (bonus?.history || []).some((entry) => entry.id.startsWith(`reward:${reward.id}:`)),
      })),
    };
  }

  return { award, awardForLesson, awardForQuestion, getBalance, isEnabled, revokeForLesson, spend, summary };
}
