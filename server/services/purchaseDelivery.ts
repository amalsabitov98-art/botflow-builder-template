import type { OrderEntry } from "../types";

interface PurchaseDeliveryDeps {
  getOrders: () => OrderEntry[];
  saveDelivery: (order: OrderEntry, delivery: NonNullable<OrderEntry["accessDelivery"]>) => Promise<void>;
  send: (order: OrderEntry) => Promise<void>;
  now?: () => number;
}

// A single-process durable outbox, stored in each order's product envelope.
// Delivery is at-least-once: a crash after Telegram accepted a message but
// before the sent marker was saved can result in a duplicate notification.
export function createPurchaseDeliveryService({ getOrders, saveDelivery, send, now = Date.now }: PurchaseDeliveryDeps) {
  const inFlight = new Map<string, Promise<void>>();
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let flushing: Promise<void> | null = null;

  async function attempt(order: OrderEntry) {
    const delivery = order.accessDelivery;
    if (order.status !== "paid" || delivery?.status !== "pending") return;
    if (delivery.nextAttemptAt && Date.parse(delivery.nextAttemptAt) > now()) return;
    const attempts = delivery.attempts + 1;
    try {
      // Save the retry deadline before sending, so failed delivery also survives
      // restarts and a temporarily offline bot does not cause a busy loop.
      await saveDelivery(order, {
        status: "pending", attempts,
        nextAttemptAt: new Date(now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(attempts - 1, 6))).toISOString(),
      });
      await send(order);
      await saveDelivery(order, { status: "sent", attempts, sentAt: new Date(now()).toISOString() });
    } catch {
      console.warn(`[ACCESS] Purchase notification pending retry for order ${order.id}`);
    }
  }

  function deliver(order: OrderEntry): Promise<void> {
    if (stopped) return Promise.resolve();
    const existing = inFlight.get(order.id);
    if (existing) return existing;
    const task = attempt(order).finally(() => { inFlight.delete(order.id); });
    inFlight.set(order.id, task);
    return task;
  }

  function flush(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      const due = getOrders().filter((order) => order.status === "paid"
        && order.accessDelivery?.status === "pending"
        && (!order.accessDelivery.nextAttemptAt || Date.parse(order.accessDelivery.nextAttemptAt) <= now()));
      for (const order of due.slice(0, 20)) {
        if (stopped) break;
        await deliver(order);
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }

  function start() {
    if (timer) return;
    stopped = false;
    void flush();
    timer = setInterval(() => { void flush(); }, 30_000);
    timer.unref?.();
  }

  async function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = undefined;
    await Promise.allSettled([...inFlight.values(), ...(flushing ? [flushing] : [])]);
  }

  return { deliver, flush, start, stop };
}
