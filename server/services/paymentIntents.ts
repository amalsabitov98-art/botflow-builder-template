import type { SupabaseClient } from "@supabase/supabase-js";
import type { LavaPaymentIntent } from "../types";
import { loadJSON, saveJSON } from "../storage/jsonStore";

interface PaymentIntentServiceDeps {
  getSupabase: () => SupabaseClient | null;
  getUseSupabase: () => boolean;
  paymentIntentsFile: string;
}

const PAYMENT_OFFER_ENVELOPE = "__BOTFLOW_PAYMENT_OFFER_V1__:";

function decodeOfferSnapshot(value: unknown) {
  const raw = String(value || "");
  if (!raw.startsWith(PAYMENT_OFFER_ENVELOPE)) return null;
  try {
    return JSON.parse(raw.slice(PAYMENT_OFFER_ENVELOPE.length));
  } catch {
    return null;
  }
}

function encodeOfferSnapshot(intent: LavaPaymentIntent) {
  return `${PAYMENT_OFFER_ENVELOPE}${JSON.stringify({
    offerId: intent.offerId,
    tier: intent.tier,
    amount: intent.amount,
    currency: intent.currency,
    product: intent.product,
  })}`;
}

function normalizePaymentIntent(value: any): LavaPaymentIntent | null {
  const paymentId = String(value?.payment_id ?? value?.paymentId ?? "").trim();
  const chatId = Number(value?.chat_id ?? value?.chatId);
  const funnelId = String(value?.funnel_id ?? value?.funnelId ?? "").trim();
  const stageId = String(value?.stage_id ?? value?.stageId ?? "").trim();
  const rawOfferId = value?.offer_id ?? value?.offerId ?? "";
  const snapshot = decodeOfferSnapshot(rawOfferId);
  const offerId = String(snapshot?.offerId ?? rawOfferId).trim();
  const rawTier = snapshot?.tier ?? value?.tier;
  const tier = rawTier === "pkg-2" ? "pkg-2" : rawTier === "pkg-1" ? "pkg-1" : null;
  const amount = Number(snapshot?.amount ?? value?.amount);
  const currency = String(snapshot?.currency ?? value?.currency ?? "").trim().toUpperCase();
  const product = String(snapshot?.product ?? value?.product ?? "").trim();

  if (!paymentId || !Number.isSafeInteger(chatId) || chatId <= 0 || !funnelId || !stageId || !offerId
    || !tier || !Number.isFinite(amount) || amount <= 0 || !currency || !product) {
    return null;
  }

  return {
    paymentId,
    chatId,
    funnelId,
    stageId,
    offerId,
    tier,
    amount,
    currency,
    product,
    buyerEmail: String(value?.buyer_email ?? value?.buyerEmail ?? ""),
    createdAt: String(value?.created_at ?? value?.createdAt ?? new Date().toISOString()),
  };
}

export function createPaymentIntentService({
  getSupabase,
  getUseSupabase,
  paymentIntentsFile,
}: PaymentIntentServiceDeps) {
  const paymentIntents = new Map<string, LavaPaymentIntent>();
  const localSnapshot = loadJSON(paymentIntentsFile, {});

  if (localSnapshot && typeof localSnapshot === "object" && !Array.isArray(localSnapshot)) {
    for (const raw of Object.values(localSnapshot)) {
      const intent = normalizePaymentIntent(raw);
      if (intent) paymentIntents.set(intent.paymentId, intent);
    }
  }

  function saveLocalSnapshot(nextIntent: LavaPaymentIntent) {
    const next = new Map(paymentIntents);
    next.set(nextIntent.paymentId, nextIntent);
    saveJSON(paymentIntentsFile, Object.fromEntries(next));
    paymentIntents.set(nextIntent.paymentId, nextIntent);
  }

  async function savePaymentIntent(intent: LavaPaymentIntent) {
    const normalized = normalizePaymentIntent(intent);
    if (!normalized) {
      throw new Error("Invalid Lava payment intent");
    }

    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { error } = await supabase.from("payment_intents").upsert({
        payment_id: normalized.paymentId,
        chat_id: normalized.chatId,
        funnel_id: normalized.funnelId,
        stage_id: normalized.stageId,
        offer_id: encodeOfferSnapshot(normalized),
        tier: normalized.tier,
        amount: normalized.amount,
        currency: normalized.currency,
        product: normalized.product,
        buyer_email: normalized.buyerEmail,
        created_at: normalized.createdAt,
      }, { onConflict: "payment_id" });

      if (error) {
        console.error("Failed to persist Lava payment intent in Supabase:", error);
        throw new Error("Failed to persist Lava payment intent");
      }

      paymentIntents.set(normalized.paymentId, normalized);
      return;
    }

    saveLocalSnapshot(normalized);
  }

  async function getPaymentIntent(paymentId: string): Promise<LavaPaymentIntent | null> {
    const normalizedPaymentId = paymentId.trim();
    if (!normalizedPaymentId) return null;

    const cached = paymentIntents.get(normalizedPaymentId);
    if (cached) return cached;

    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("payment_id", normalizedPaymentId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load Lava payment intent from Supabase:", error);
        throw new Error("Failed to load Lava payment intent");
      }

      const intent = normalizePaymentIntent(data);
      if (intent) paymentIntents.set(intent.paymentId, intent);
      return intent;
    }

    return null;
  }

  return {
    getPaymentIntent,
    savePaymentIntent,
  };
}
