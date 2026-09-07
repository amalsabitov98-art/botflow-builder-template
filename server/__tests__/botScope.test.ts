import { describe, expect, it } from "vitest";
import { getMessageHistoryKey, getScopedMessageHistory, isBotBlocked, updateSubscriberBotState } from "../services/botScope";
import type { MessageEntry, SubscriberProfile } from "../types";

const message = (id: string, timestamp: string): MessageEntry => ({
  id,
  from: "user",
  text: id,
  timestamp,
});

describe("multi-bot scope", () => {
  it("не смешивает новые диалоги двух ботов с одинаковым chatId", () => {
    const history = new Map<string, MessageEntry[]>([
      [getMessageHistoryKey(42, "bot-a"), [message("a", "2026-01-01T00:00:01.000Z")]],
      [getMessageHistoryKey(42, "bot-b"), [message("b", "2026-01-01T00:00:02.000Z")]],
    ]);

    expect(getScopedMessageHistory(history, 42, "bot-a").map(item => item.id)).toEqual(["a"]);
    expect(getScopedMessageHistory(history, 42, "bot-b").map(item => item.id)).toEqual(["b"]);
  });

  it("блокирует только конкретного бота", () => {
    const profile: SubscriberProfile = {
      id: 42,
      firstName: "Test",
      lastActive: new Date().toISOString(),
    };
    updateSubscriberBotState(profile, "bot-a", { blockedAt: new Date().toISOString() });

    expect(isBotBlocked(profile, "bot-a")).toBe(true);
    expect(isBotBlocked(profile, "bot-b")).toBe(false);
  });
});
