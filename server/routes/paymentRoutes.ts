import crypto from "crypto";
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { Currency, LavaClient } from "lava-top-sdk";
import type { Funnel, LavaPaymentIntent, OrderEntry, Settings, SubscriberProfile } from "../types";
import { resolveStagePaymentOffer } from "../services/paymentOffers";

interface PaymentRoutesContext {
  activeFunnels: Map<string, Funnel>;
  botInstances: Map<string, TelegramBot>;
  deliverAccess: (order: OrderEntry) => Promise<void>;
  globalSubscribers: Map<number, SubscriberProfile>;
  isProduction: boolean;
  getLavaClient: () => LavaClient | null;
  getRequestAuthValue: (req: express.Request, key: string) => unknown;
  getSettings: () => Settings;
  addOrder: (order: OrderEntry) => Promise<{ created: boolean; order: OrderEntry }>;
  savePaymentIntent: (intent: LavaPaymentIntent) => Promise<void>;
  validateWebAppActionAuth: (req: express.Request, funnelId: string, stageId: string, chatId: number) => boolean;
}

function hashOrderId(prefix: string, value: string) {
  return `${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0, 16).toUpperCase()}`;
}

export function registerPaymentRoutes(app: express.Express, ctx: PaymentRoutesContext) {
  app.post("/api/payments/create", async (req, res) => {
    const { email, offerId, chatId, funnelId, stageId } = req.body;
    const numericChatId = Number(chatId);

    if (!offerId || typeof offerId !== "string") {
      return res.status(400).json({ error: "Missing offerId" });
    }
    if (!funnelId || !stageId || typeof funnelId !== "string" || typeof stageId !== "string") {
      return res.status(400).json({ error: "Missing funnel or stage id" });
    }
    if (!Number.isSafeInteger(numericChatId) || numericChatId <= 0) {
      return res.status(400).json({ error: "Invalid chatId" });
    }
    if (!ctx.validateWebAppActionAuth(req, funnelId, stageId, numericChatId)) {
      return res.status(401).json({ error: "Invalid WebApp authentication" });
    }
    const offer = resolveStagePaymentOffer(ctx.activeFunnels, funnelId, stageId, offerId);
    if (!offer) {
      return res.status(400).json({ error: "Offer is not available for this funnel stage" });
    }

    const lavaClient = ctx.getLavaClient();
    if (!lavaClient) {
      console.log(`[PAYMENT] Lava client not configured. Generating mock checkout URL for offerId: ${offer.offerId}, chatId: ${chatId}`);
      const authTs = String(ctx.getRequestAuthValue(req, "authTs") || "");
      const authSig = String(ctx.getRequestAuthValue(req, "authSig") || "");
      const mockUrl = `/mock-checkout?offerId=${encodeURIComponent(offer.offerId)}&amount=${offer.amount}&currency=${encodeURIComponent(offer.currency)}&chatId=${numericChatId}&funnelId=${encodeURIComponent(funnelId)}&stageId=${encodeURIComponent(stageId)}&authTs=${encodeURIComponent(authTs)}&authSig=${encodeURIComponent(authSig)}`;
      return res.json({ success: true, paymentUrl: mockUrl });
    }

    try {
      const payment = await lavaClient.createOneTimePayment(
        email || 'customer@example.com',
        offer.offerId,
        offer.currency as Currency
      );

      if (!payment.id || !payment.paymentUrl) {
        throw new Error("Lava.top returned an incomplete payment response");
      }

      await ctx.savePaymentIntent({
        paymentId: payment.id,
        chatId: numericChatId,
        funnelId,
        stageId,
        offerId: offer.offerId,
        tier: offer.tier,
        amount: offer.amount,
        currency: offer.currency,
        product: offer.product,
        buyerEmail: typeof email === "string" ? email : "",
        createdAt: new Date().toISOString(),
      });

      res.json({ success: true, paymentUrl: payment.paymentUrl });
    } catch (e: any) {
      console.error("Payment create error:", e);
      res.status(500).json({ error: "Payment generation failed" });
    }
  });

  app.post("/api/payments/mock-success", async (req, res) => {
    if (ctx.isProduction) {
      return res.status(404).json({ error: "Mock payments are disabled in production" });
    }

    const { offerId, chatId, funnelId: bodyFunnelId, stageId } = req.body;
    console.log(`[PAYMENT] Received mock-success: offerId=${offerId}, chatId=${chatId}`);
    const numericChatId = Number(chatId);

    if (!bodyFunnelId || !stageId || typeof bodyFunnelId !== "string" || typeof stageId !== "string") {
      return res.status(400).json({ error: "Missing funnel or stage id" });
    }
    if (!Number.isSafeInteger(numericChatId) || numericChatId <= 0) {
      return res.status(400).json({ error: "Invalid chatId" });
    }
    if (!ctx.validateWebAppActionAuth(req, bodyFunnelId, stageId, numericChatId)) {
      return res.status(401).json({ error: "Invalid WebApp authentication" });
    }
    const offer = resolveStagePaymentOffer(ctx.activeFunnels, bodyFunnelId, stageId, offerId);
    if (!offer) {
      return res.status(400).json({ error: "Offer is not available for this funnel stage" });
    }

    const authTs = String(ctx.getRequestAuthValue(req, "authTs") || "");
    const authSig = String(ctx.getRequestAuthValue(req, "authSig") || "");
    const idempotencyKey = [
      "mock",
      numericChatId,
      bodyFunnelId,
      stageId,
      offer.offerId,
      authTs,
      authSig,
    ].join(":");
    const orderId = hashOrderId("MOCK", idempotencyKey);
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    let customerName = 'Покупатель (Тест)';
    let customerUsername = '';
    let botName = '';
    const funnelId = bodyFunnelId;

    const subscriber = ctx.globalSubscribers.get(numericChatId);
    if (subscriber) {
      customerName = [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ');
      customerUsername = subscriber.username ? `@${subscriber.username}` : '';
    }

    const funnel = ctx.activeFunnels.get(funnelId);
    if (funnel?.connectedBotId) {
      const botEntry = ctx.getSettings().bots.find(b => b.id === funnel.connectedBotId);
      botName = botEntry ? `@${botEntry.name}` : '';
    }

    const order = {
      id: orderId,
      idempotencyKey,
      customer: customerName,
      username: customerUsername,
      product: offer.product,
      amount: offer.amount,
      currency: offer.currency,
      accessTier: offer.tier,
      stageId,
      offerId: offer.offerId,
      status: 'paid' as const,
      date: dateStr,
      createdAt: now.toISOString(),
      bot: botName || 'Прямая оплата (Мок)',
      chatId: numericChatId,
      funnelId,
    };

    const result = await ctx.addOrder(order);
    if (!result.created) {
      if (result.order.accessDelivery?.status === "pending") await ctx.deliverAccess(result.order);
      return res.json({ success: true, duplicate: true, orderId: result.order.id });
    }

    console.log("✅ Added mock order:", orderId);

    await ctx.deliverAccess(result.order);

    res.json({ success: true, orderId });
  });
}
