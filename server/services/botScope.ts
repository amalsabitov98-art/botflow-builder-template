import type { MessageEntry, SubscriberProfile } from "../types";

export function getMessageHistoryKey(chatId: number, botId?: string) {
  return botId ? `${botId}:${chatId}` : `legacy:${chatId}`;
}

export function getScopedMessageHistory(
  history: Map<string, MessageEntry[]>,
  chatId: number,
  botId?: string,
) {
  const scoped = history.get(getMessageHistoryKey(chatId, botId)) || [];
  const legacy = history.get(getMessageHistoryKey(chatId)) || history.get(String(chatId)) || [];
  if (!botId || legacy.length === 0) return [...scoped];
  return [...legacy, ...scoped]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-200);
}

function getExplicitBotState(profile: SubscriberProfile, botId?: string) {
  return botId ? profile.botStates?.[botId] : undefined;
}

export function isBotBlocked(profile: SubscriberProfile | undefined, botId?: string) {
  if (!profile) return false;
  const explicit = getExplicitBotState(profile, botId);
  if (explicit) return Boolean(explicit.blockedAt);
  return !profile.botStates && Boolean(profile.botBlockedAt);
}

export function isAwaitingHumanReply(profile: SubscriberProfile | undefined, botId?: string) {
  if (!profile) return false;
  const explicit = getExplicitBotState(profile, botId);
  if (explicit) return Boolean(explicit.awaitingHumanReply);
  return !profile.botStates && Boolean(profile.awaitingHumanReply);
}

export function updateSubscriberBotState(
  profile: SubscriberProfile,
  botId: string | undefined,
  patch: { blockedAt?: string | null; awaitingHumanReply?: string | null },
) {
  if (!botId) {
    if (patch.blockedAt !== undefined) profile.botBlockedAt = patch.blockedAt || undefined;
    if (patch.awaitingHumanReply !== undefined) {
      profile.awaitingHumanReply = patch.awaitingHumanReply || undefined;
    }
    return profile;
  }

  const next = { ...(profile.botStates || {}) };
  const state = { ...(next[botId] || {}) };
  if (patch.blockedAt !== undefined) state.blockedAt = patch.blockedAt || undefined;
  if (patch.awaitingHumanReply !== undefined) {
    state.awaitingHumanReply = patch.awaitingHumanReply || undefined;
  }
  if (!state.blockedAt && !state.awaitingHumanReply) delete next[botId];
  else next[botId] = state;
  profile.botStates = next;
  // Денормализованные поля сохраняют совместимость со старой админкой и
  // экспортами. Рабочая логика всегда читает botStates конкретного бота.
  profile.botBlockedAt = Object.values(next).find(item => item.blockedAt)?.blockedAt;
  profile.awaitingHumanReply = Object.values(next).find(item => item.awaitingHumanReply)?.awaitingHumanReply;
  return profile;
}
