import { describe, expect, it, vi } from "vitest";
import { createAssistantService } from "../services/assistant";
import { createOrdersService } from "../services/orders";
import { transcribeVoiceNote } from "../services/audioTranscription";
import type { Funnel, SubscriberProfile } from "../types";

describe("Quick Wins: Telegram-алерты администратору", () => {
  it("отправляет алерт админу при эскалации ассистента человеку", async () => {
    const notifyAdmin = vi.fn().mockResolvedValue(undefined);
    const globalSubscribers = new Map<number, SubscriberProfile>();
    globalSubscribers.set(42, {
      id: 42,
      firstName: "Алексей",
      username: "alex_test",
      lastActive: new Date().toISOString(),
    });

    const funnel: Funnel = {
      id: "f1",
      title: "Тестовая воронка",
      status: "active",
      subscribers: 10,
      conversion: "15%",
      createdAt: new Date().toISOString(),
      connectedBotId: "b1",
      stages: [],
      assistant: { enabled: true },
    };



    const assistant = createAssistantService({
      activeFunnels: new Map([["f1", funnel]]),
      createMessage: vi.fn()
        .mockResolvedValueOnce({
          id: "msg1",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call1",
              name: "escalate_to_human",
              input: { reason: "просит вернуть деньги" },
            },
          ],
          model: "deepseek-v4-flash",
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 10 },
        })
        .mockResolvedValueOnce({
          id: "msg2",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Я передал вопрос оператору." }],
          model: "deepseek-v4-flash",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      getApiKey: () => "test-key",

      getUserState: () => undefined,
      getWebAppUrl: () => "https://example.com",
      globalSubscribers,
      logMessage: vi.fn().mockResolvedValue(undefined),
      messageHistory: new Map(),
      persistUserState: vi.fn().mockResolvedValue(undefined),
      saveSubscriber: vi.fn().mockResolvedValue(undefined),
      sendStageMessage: vi.fn().mockResolvedValue(undefined),
      notifyAdmin,
    });

    const mockBot = {
      sendMessage: vi.fn().mockResolvedValue({}),
    } as any;

    await assistant.handleIncomingMessage(mockBot, 42, "верните мне оплату", funnel);

    expect(notifyAdmin).toHaveBeenCalledTimes(1);
    expect(notifyAdmin.mock.calls[0][0]).toContain("Запрос оператора");
    expect(notifyAdmin.mock.calls[0][0]).toContain("Алексей");
    expect(notifyAdmin.mock.calls[0][0]).toContain("@alex_test");
    expect(notifyAdmin.mock.calls[0][0]).toContain("просит вернуть деньги");
  });

  it("отправляет алерт админу при создании оплаченного заказа", async () => {
    const notifyAdmin = vi.fn().mockResolvedValue(undefined);
    const orders: any[] = [];

    const ordersService = createOrdersService({
      ensureUserState: () => ({
        chatId: 42,
        funnelId: "f1",
        sentStages: [],
        openedStages: [],
        viewedStages: [],
        completedStages: [],
        events: [],
      }) as any,
      getSupabase: () => null,
      getUseSupabase: () => false,
      orders,
      ordersFile: "/tmp/orders.json",
      persistUserState: vi.fn().mockResolvedValue(undefined),
      notifyAdmin,
    });

    await ordersService.addOrder({
      id: "ord-123",
      customer: "Иван Иванов",
      username: "ivan_tg",
      product: "IT-Владелец",
      amount: 99,
      status: "paid",
      date: new Date().toISOString(),
      bot: "b1",
      currency: "USD",
      accessTier: "pkg-2",
      chatId: 42,
      funnelId: "f1",
    });


    expect(notifyAdmin).toHaveBeenCalledTimes(1);
    expect(notifyAdmin.mock.calls[0][0]).toContain("Новая оплата");
    expect(notifyAdmin.mock.calls[0][0]).toContain("99 USD");
    expect(notifyAdmin.mock.calls[0][0]).toContain("IT-Владелец");
    expect(notifyAdmin.mock.calls[0][0]).toContain("@ivan_tg");
  });
});

describe("Quick Wins: Транскрибация голосовых сообщений", () => {
  it("возвращает null, если ни один API ключ не задан", async () => {
    const fakeAudio = Buffer.from("fake ogg audio data");
    const result = await transcribeVoiceNote(fakeAudio, "audio/ogg", {});
    expect(result).toBeNull();
  });
});
