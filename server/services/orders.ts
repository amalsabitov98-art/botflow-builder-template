import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderEntry } from "../types";
import type { UserStageState } from "./progress";
import { saveJSON } from "../storage/jsonStore";
import { readAllRows } from "../storage/pagination";
import { escapeTelegramHtml } from "./telegram";

export type AddOrderResult = {
  created: boolean;
  order: OrderEntry;
};

interface OrdersServiceDeps {
  ensureUserState: (chatId: number, funnelId: string, stage?: any) => UserStageState;
  getSupabase: () => SupabaseClient | null;
  getUseSupabase: () => boolean;
  orders: OrderEntry[];
  ordersFile: string;
  persistUserState: (chatId: number, state: UserStageState) => Promise<void>;
  notifyAdmin?: (message: string) => Promise<void>;
}


const ORDER_PRODUCT_ENVELOPE = "__BOTFLOW_ORDER_V1__:";

function decodeOrderProduct(value: unknown) {
  const raw = String(value || "");
  if (!raw.startsWith(ORDER_PRODUCT_ENVELOPE)) return null;
  try {
    return JSON.parse(raw.slice(ORDER_PRODUCT_ENVELOPE.length));
  } catch {
    return null;
  }
}

function encodeOrderProduct(order: OrderEntry) {
  return `${ORDER_PRODUCT_ENVELOPE}${JSON.stringify({
    product: order.product,
    stageId: order.stageId,
    offerId: order.offerId,
    accessTier: order.accessTier,
    currency: order.currency,
    accessDelivery: order.accessDelivery,
  })}`;
}

function normalizeOrder(value: any): OrderEntry | null {
  if (!value || !value.id) return null;
  const rawChatId = value.chat_id ?? value.chatId ?? null;
  const chatId = rawChatId === null || rawChatId === undefined ? null : Number(rawChatId);
  const productSnapshot = decodeOrderProduct(value.product);

  return {
    id: String(value.id),
    idempotencyKey: value.idempotency_key || value.idempotencyKey || undefined,
    customer: String(value.customer || ""),
    username: String(value.username || ""),
    product: String(productSnapshot?.product ?? value.product ?? ""),
    amount: Number(value.amount) || 0,
    status: value.status || "paid",
    date: String(value.date || ""),
    createdAt: value.created_at || value.createdAt || undefined,
    bot: String(value.bot || ""),
    chatId: Number.isSafeInteger(chatId) ? chatId : null,
    funnelId: value.funnel_id || value.funnelId || undefined,
    stageId: productSnapshot?.stageId || value.stage_id || value.stageId || undefined,
    offerId: productSnapshot?.offerId || value.offer_id || value.offerId || undefined,
    accessTier: productSnapshot?.accessTier === "pkg-2" || value.access_tier === "pkg-2" || value.accessTier === "pkg-2"
      ? "pkg-2"
      : productSnapshot?.accessTier === "pkg-1" || value.access_tier === "pkg-1" || value.accessTier === "pkg-1"
        ? "pkg-1"
        : undefined,
    currency: String(productSnapshot?.currency ?? value.currency ?? "").toUpperCase() || undefined,
    accessDelivery: productSnapshot?.accessDelivery || value.accessDelivery || undefined,
  };
}

export function createOrdersService({
  ensureUserState,
  getSupabase,
  getUseSupabase,
  orders,
  ordersFile,
  persistUserState,
  notifyAdmin,
}: OrdersServiceDeps) {

  function findExistingOrder(order: OrderEntry) {
    return orders.find((existing) => (
      existing.id === order.id
      || (!!order.idempotencyKey && existing.idempotencyKey === order.idempotencyKey)
    ));
  }

  function loadOrdersSnapshot(snapshot: any) {
    orders.length = 0;
    if (!Array.isArray(snapshot)) return 0;

    for (const raw of snapshot) {
      const order = normalizeOrder(raw);
      if (order) orders.push(order);
    }

    return orders.length;
  }

  async function loadOrdersFromSupabase() {
    const supabase = getSupabase();
    if (!supabase) return 0;

    const { data, error } = await readAllRows(() => supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id"));

    if (error) {
      console.error("Failed to load orders from Supabase:", error);
      throw new Error("Failed to load orders from Supabase");
    }

    return loadOrdersSnapshot(data || []);
  }

  async function addOrder(order: OrderEntry): Promise<AddOrderResult> {
    const existingOrder = findExistingOrder(order);
    if (existingOrder) {
      console.log(`[ORDER] Duplicate order skipped: ${order.id}`);
      return { created: false, order: existingOrder };
    }

    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { data: existingRemoteOrder, error: lookupError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .maybeSingle();

      if (lookupError) {
        console.error("Failed to check Lava order idempotency in Supabase:", lookupError);
        throw new Error("Failed to check order idempotency");
      }

      if (!lookupError && existingRemoteOrder) {
        console.log(`[ORDER] Duplicate Supabase order skipped: ${order.id}`);
        const storedOrder = normalizeOrder(existingRemoteOrder)!;
        if (!orders.some((item) => item.id === storedOrder.id)) orders.push(storedOrder);
        return { created: false, order: storedOrder };
      }
    }

    // Persist the delivery job together with the purchase. Older orders without
    // this field are not replayed on deployment.
    if (order.status === "paid" && order.chatId && order.funnelId) {
      order = { ...order, accessDelivery: { status: "pending", attempts: 0 } };
    }

    if (getUseSupabase() && supabase) {
      const { error } = await supabase.from("orders").insert({
        id: order.id,
        customer: order.customer,
        username: order.username,
        product: encodeOrderProduct(order),
        amount: order.amount,
        status: order.status,
        date: order.date,
        created_at: order.createdAt || new Date().toISOString(),
        bot: order.bot,
        chat_id: order.chatId || null,
        funnel_id: order.funnelId || null,
      });
      if (error) {
        console.error("Failed to persist order in Supabase:", error);
        throw new Error("Failed to persist order");
      }
    } else {
      const nextOrders = [order, ...orders];
      saveJSON(ordersFile, nextOrders);
    }

    orders.unshift(order);

    if (order.chatId && order.funnelId) {
      const state = ensureUserState(order.chatId, order.funnelId, undefined);
      state.purchaseStatus = order.status;
      state.lastActionAt = new Date().toISOString();
      state.events.push({
        event: `purchase_${order.status}`,
        funnelId: order.funnelId,
        timestamp: state.lastActionAt,
      });
      if (state.events.length > 100) state.events.splice(0, state.events.length - 100);
      try {
        await persistUserState(order.chatId, state);
      } catch (error) {
        console.error("Order was saved, but purchase progress could not be persisted:", error);
      }
    }

    if (order.status === "paid" && notifyAdmin) {
      const buyer = order.username ? `@${order.username}` : (order.customer || `ID: ${order.chatId || "не указан"}`);
      const tierStr = order.accessTier ? ` (${order.accessTier})` : "";
      void notifyAdmin(
        `💰 <b>Новая оплата!</b>\n` +
        `Сумма: <b>${order.amount} ${order.currency || "RUB"}</b>\n` +
        `Товар: <b>${escapeTelegramHtml(order.product)}${tierStr}</b>\n` +
        `Покупатель: <b>${escapeTelegramHtml(buyer)}</b>\n` +
        `Заказ: <code>${escapeTelegramHtml(order.id)}</code>`
      );
    }

    return { created: true, order };

  }

  async function saveAccessDelivery(order: OrderEntry, delivery: NonNullable<OrderEntry["accessDelivery"]>) {
    const nextOrder = { ...order, accessDelivery: delivery };
    const supabase = getSupabase();
    if (getUseSupabase() && supabase) {
      const { error } = await supabase.from("orders")
        .update({ product: encodeOrderProduct(nextOrder) }).eq("id", order.id);
      if (error) throw new Error("Failed to persist purchase delivery");
    } else {
      saveJSON(ordersFile, orders.map((item) => item.id === order.id ? nextOrder : item));
    }
    order.accessDelivery = delivery;
  }

  return {
    addOrder,
    findExistingOrder,
    loadOrdersFromSupabase,
    loadOrdersSnapshot,
    saveAccessDelivery,
  };
}
