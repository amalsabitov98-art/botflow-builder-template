import crypto from "crypto";
import { LavaClient, PaymentSuccessData, WebhookHandler } from "lava-top-sdk";
import type { Funnel, LavaPaymentIntent, OrderEntry, Settings, SubscriberProfile } from "../types";
import type { AddOrderResult } from "./orders";

interface LavaServiceDeps {
  activeFunnels: Map<string, Funnel>;
  addOrder: (order: OrderEntry) => Promise<AddOrderResult>;
  deliverAccess: (order: OrderEntry) => Promise<void>;
  getPaymentIntent: (paymentId: string) => Promise<LavaPaymentIntent | null>;
  globalSubscribers: Map<number, SubscriberProfile>;
  getSettings: () => Settings;
}

function hashId(prefix: string, value: string) {
  return `${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0, 16).toUpperCase()}`;
}

function getLavaPaymentReference(data: PaymentSuccessData) {
  const payload = data as any;
  const candidateKeys = [
    "payment_id",
    "paymentId",
    "transaction_id",
    "transactionId",
    "invoice_id",
    "invoiceId",
    "order_id",
    "orderId",
    "contract_id",
    "contractId",
    "id",
  ];

  for (const key of candidateKeys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return crypto.createHash("sha256").update(JSON.stringify(payload || {})).digest("hex");
}

export function createLavaService({
  activeFunnels,
  addOrder,
  deliverAccess,
  getPaymentIntent,
  globalSubscribers,
  getSettings,
}: LavaServiceDeps) {
  let lavaClient: LavaClient | null = null;
  let lavaWebhookHandler: WebhookHandler | null = null;

  function createOrderFromPayment(data: PaymentSuccessData, intent: LavaPaymentIntent): OrderEntry {
    const settings = getSettings();
    const paymentReference = getLavaPaymentReference(data);
    const idempotencyKey = `lava:${paymentReference}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const subscriber = globalSubscribers.get(intent.chatId);
    let customerName = data.buyer?.email || intent.buyerEmail || 'Покупатель';
    let customerUsername = '';
    if (subscriber) {
      customerName = [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ');
      customerUsername = subscriber.username ? `@${subscriber.username}` : '';
    }

    const funnel = activeFunnels.get(intent.funnelId);
    const botEntry = funnel?.connectedBotId
      ? settings.bots.find((bot) => bot.id === funnel.connectedBotId)
      : null;
    const botName = botEntry ? `@${botEntry.name}` : '';

    return {
      id: hashId("LAVA", idempotencyKey),
      idempotencyKey,
      customer: customerName,
      username: customerUsername,
      product: intent.product,
      amount: intent.amount,
      currency: intent.currency,
      accessTier: intent.tier,
      stageId: intent.stageId,
      offerId: intent.offerId,
      status: 'paid',
      date: dateStr,
      createdAt: now.toISOString(),
      bot: botName || 'Прямая оплата',
      chatId: intent.chatId,
      funnelId: intent.funnelId,
    };
  }

  async function processPaymentSuccess(data: PaymentSuccessData) {
    const paymentReference = getLavaPaymentReference(data);
    const intent = await getPaymentIntent(paymentReference);
    if (!intent) {
      throw new Error(`Lava payment intent not found for contract ${paymentReference}`);
    }

    const paidAmount = Number(data.amount);
    const paidCurrency = String((data as any).currency || "").toUpperCase();
    if (!Number.isFinite(paidAmount) || paidAmount !== intent.amount || paidCurrency !== intent.currency) {
      throw new Error(`Lava payment does not match the server payment intent for contract ${paymentReference}`);
    }

    const result = await addOrder(createOrderFromPayment(data, intent));
    if (result.created || result.order.accessDelivery?.status === "pending") {
      await deliverAccess(result.order);
    }
    return result;
  }

  function initLavaClientAndWebhook() {
    const settings = getSettings();
    lavaClient = null;
    lavaWebhookHandler = null;

    if (settings.lavaApiKey) {
      lavaClient = new LavaClient({
        apiKey: settings.lavaApiKey,
        webhookSecretKey: settings.lavaWebhookSecret,
      });
    }

    if (settings.lavaWebhookSecret) {
      lavaWebhookHandler = new WebhookHandler({
        secretKey: settings.lavaWebhookSecret,
        onPaymentSuccess: async (data: PaymentSuccessData) => {
          console.log("--> Lava.top payment verified", {
            paymentReferenceHash: hashId("PAYMENT", getLavaPaymentReference(data)),
          });
          await processPaymentSuccess(data);
        },
      });
    }
  }

  async function handleWebhook(signature: string, rawBody: string) {
    if (!lavaWebhookHandler) {
      throw new Error("Lava webhook is not configured");
    }

    await lavaWebhookHandler.handleWebhook(signature, rawBody);
  }

  return {
    createOrderFromPayment,
    getLavaClient: () => lavaClient,
    handleWebhook,
    initLavaClientAndWebhook,
    isWebhookConfigured: () => !!lavaWebhookHandler,
    processPaymentSuccess,
  };
}
