import type { AccessTier } from "./access";
import type { Funnel } from "../types";

export interface PaymentOffer {
  offerId: string;
  tier: AccessTier;
  amount: number;
  currency: string;
  product: string;
}

function normalizeTier(value: unknown): AccessTier {
  return value === "pkg-2" ? "pkg-2" : "pkg-1";
}

function normalizeConfiguredOffer(value: any): PaymentOffer | null {
  const offerId = String(value?.offerId || "").trim();
  const amount = Number(value?.amount);
  const currency = String(value?.currency || "RUB").trim().toUpperCase();
  if (!offerId || !Number.isFinite(amount) || amount <= 0 || !currency) return null;

  return {
    offerId,
    tier: normalizeTier(value?.tier ?? value?.accessTier),
    amount,
    currency,
    product: String(value?.product ?? value?.offerTitle ?? offerId).trim() || offerId,
  };
}

export function getStagePaymentOffers(
  activeFunnels: Map<string, Funnel>,
  funnelId: string,
  stageId: string,
): PaymentOffer[] {
  const funnel = activeFunnels.get(funnelId);
  const stage = funnel?.stages?.find((item: any) => item.id === stageId);
  if (!funnel || !stage) return [];

  const configuredOffers = Array.isArray(stage.webApp?.paymentOffers)
    ? stage.webApp.paymentOffers.map(normalizeConfiguredOffer).filter(Boolean) as PaymentOffer[]
    : [];
  const blockOffers = Array.isArray(stage.webApp?.blocks)
    ? stage.webApp.blocks
      .filter((block: any) => block?.content?.isPayment === true)
      .map((block: any) => normalizeConfiguredOffer(block.content))
      .filter(Boolean) as PaymentOffer[]
    : [];
  const uniqueOffers = new Map<string, PaymentOffer>();
  for (const offer of [...blockOffers, ...configuredOffers]) {
    uniqueOffers.set(offer.offerId, offer);
  }
  return [...uniqueOffers.values()];
}

export function resolveStagePaymentOffer(
  activeFunnels: Map<string, Funnel>,
  funnelId: string,
  stageId: string,
  offerId: unknown,
): PaymentOffer | null {
  const requestedOfferId = String(offerId || "").trim();
  if (!requestedOfferId) return null;
  return getStagePaymentOffers(activeFunnels, funnelId, stageId)
    .find((offer) => offer.offerId === requestedOfferId) || null;
}
