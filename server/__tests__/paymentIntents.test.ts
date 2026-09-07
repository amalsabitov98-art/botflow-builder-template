import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { createPaymentIntentService } from "../services/paymentIntents";
import type { LavaPaymentIntent } from "../types";

describe("payment intent persistence", () => {
  it("записывает все NOT NULL поля свежей Supabase-схемы", async () => {
    let saved: Record<string, unknown> | null = null;
    const supabase = {
      from: () => ({
        upsert: async (payload: Record<string, unknown>) => {
          saved = payload;
          return { error: null };
        },
      }),
    } as any;
    const service = createPaymentIntentService({
      getSupabase: () => supabase,
      getUseSupabase: () => true,
      paymentIntentsFile: path.join(os.tmpdir(), `payment-intents-${Date.now()}.json`),
    });
    const intent: LavaPaymentIntent = {
      paymentId: "pay-1",
      chatId: 42,
      funnelId: "funnel-1",
      stageId: "stage-1",
      offerId: "offer-1",
      tier: "pkg-1",
      amount: 990,
      currency: "RUB",
      product: "Курс",
      buyerEmail: "buyer@example.com",
      createdAt: new Date().toISOString(),
    };

    await service.savePaymentIntent(intent);

    expect(saved).toMatchObject({
      tier: "pkg-1",
      amount: 990,
      currency: "RUB",
      product: "Курс",
    });
  });
});
