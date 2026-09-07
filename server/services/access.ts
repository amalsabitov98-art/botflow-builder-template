import type { OrderEntry } from "../types";

export type AccessTier = "pkg-1" | "pkg-2";

export interface ChatAccess {
  paid: boolean;
  tier: AccessTier | null;
  products: string[];
  orderIds: string[];
}

// Source of truth for entitlements: paid orders for this chatId (loaded from Supabase at startup).
export function getChatAccess(orders: OrderEntry[], chatId: number, funnelId: string): ChatAccess {
  const paidOrders = orders.filter((order) => (
    order.chatId === chatId
    && order.funnelId === funnelId
    && order.status === "paid"
    && (order.accessTier === "pkg-1" || order.accessTier === "pkg-2")
  ));

  if (paidOrders.length === 0) {
    return { paid: false, tier: null, products: [], orderIds: [] };
  }

  const tier: AccessTier = paidOrders.some((order) => order.accessTier === "pkg-2") ? "pkg-2" : "pkg-1";

  return {
    paid: true,
    tier,
    products: paidOrders.map((order) => order.product).filter(Boolean),
    orderIds: paidOrders.map((order) => order.id),
  };
}
