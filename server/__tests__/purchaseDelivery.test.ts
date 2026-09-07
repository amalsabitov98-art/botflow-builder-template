import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrdersService } from "../services/orders";
import { createPurchaseDeliveryService } from "../services/purchaseDelivery";
import { createProgressService } from "../services/progress";
import { createLavaService } from "../services/lava";
import { memorySupabase } from "./helpers/memorySupabase";
import type { OrderEntry } from "../types";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function tempDir() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "purchase-delivery-")); dirs.push(dir); return dir; }
const newOrder = (): OrderEntry => ({ id: "o", status: "paid", chatId: 1, funnelId: "f", accessTier: "pkg-1",
  customer: "Buyer", username: "", product: "Course", amount: 10, currency: "RUB", date: "today", bot: "bot" });

function harness(dir: string, db: ReturnType<typeof memorySupabase> | undefined, send: (order: OrderEntry) => Promise<void>, now: () => number) {
  const orders: OrderEntry[] = [];
  const progress = createProgressService({ activeFunnels: new Map(), getSupabase: () => null, getUseSupabase: () => false,
    progressFile: path.join(dir, "progress.json"), progressStateRowId: "__progress__" });
  const storage = createOrdersService({ orders, ordersFile: path.join(dir, "orders.json"),
    getSupabase: () => db?.client || null, getUseSupabase: () => !!db,
    ensureUserState: progress.ensureUserState, persistUserState: progress.persistUserState });
  const queue = createPurchaseDeliveryService({ getOrders: () => orders, saveDelivery: storage.saveAccessDelivery, send, now });
  const load = async () => {
    if (db) await storage.loadOrdersFromSupabase();
    else storage.loadOrdersSnapshot(JSON.parse(fs.readFileSync(path.join(dir, "orders.json"), "utf8")));
  };
  return { orders, storage, queue, load };
}

describe("durable purchase notification delivery", () => {
  it.each([false, true])("retries a failed send after restart and does not resend completed jobs (Supabase=%s)", async (remote) => {
    const dir = tempDir(); const db = remote ? memorySupabase() : undefined;
    let time = Date.UTC(2026, 0, 1);
    const fail = vi.fn(async () => { throw new Error("Bot offline"); });
    const first = harness(dir, db, fail, () => time);
    const { order } = await first.storage.addOrder(newOrder());
    expect(order.accessDelivery?.status).toBe("pending");
    await first.queue.deliver(order);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(order.accessDelivery).toMatchObject({ status: "pending", attempts: 1 });

    const send = vi.fn(async () => undefined);
    const restarted = harness(dir, db, send, () => time);
    await restarted.load();
    await restarted.queue.flush();
    expect(send).not.toHaveBeenCalled();
    time += 60_000;
    await restarted.queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(restarted.orders[0].accessDelivery).toMatchObject({ status: "sent", attempts: 2 });
    const third = harness(dir, db, send, () => time);
    await third.load();
    await third.queue.flush();
    await third.queue.deliver(third.orders[0]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent webhook and scheduler attempts for the same order", async () => {
    const send = vi.fn(async () => { await Promise.resolve(); });
    const h = harness(tempDir(), undefined, send, () => Date.UTC(2026, 0, 1));
    const { order } = await h.storage.addOrder(newOrder());
    await Promise.all([h.queue.deliver(order), h.queue.deliver(order), h.queue.flush()]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not replay legacy purchases or refunded orders", async () => {
    const send = vi.fn(async () => undefined);
    const h = harness(tempDir(), undefined, send, Date.now);
    h.storage.loadOrdersSnapshot([newOrder(), { ...newOrder(), id: "refund", status: "refund",
      accessDelivery: { status: "pending", attempts: 0 } }]);
    await h.queue.flush();
    await h.queue.deliver(h.orders[0]);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send when persisting the retry deadline fails", async () => {
    const db = memorySupabase();
    const send = vi.fn(async () => undefined);
    const h = harness(tempDir(), db, send, Date.now);
    const { order } = await h.storage.addOrder(newOrder());
    db.failures.set("orders:update", { code: "08006" });
    await h.queue.deliver(order);
    expect(send).not.toHaveBeenCalled();
    expect(order.accessDelivery).toEqual({ status: "pending", attempts: 0 });
    db.failures.clear();
    await h.queue.deliver(order);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("uses a repeated Lava webhook to retry a pending delivery without creating another purchase", async () => {
    let time = Date.UTC(2026, 0, 1);
    const send = vi.fn().mockRejectedValueOnce(new Error("Temporary Telegram failure")).mockResolvedValue(undefined);
    const h = harness(tempDir(), memorySupabase(), send, () => time);
    const lava = createLavaService({ activeFunnels: new Map(), globalSubscribers: new Map(),
      addOrder: h.storage.addOrder, deliverAccess: h.queue.deliver,
      getSettings: () => ({ bots: [], geminiApiKey: "", appUrl: "https://example.com", autoReminders: true, notifications: true }),
      getPaymentIntent: async () => ({ paymentId: "payment", chatId: 1, funnelId: "f", stageId: "s",
        offerId: "offer", tier: "pkg-1", amount: 10, currency: "RUB", product: "Course", buyerEmail: "", createdAt: "2026-01-01" }),
    });
    const payment = { contractId: "payment", amount: 10, currency: "RUB", buyer: { email: "buyer@example.com" } } as any;
    const first = await lava.processPaymentSuccess(payment);
    expect(first.created).toBe(true);
    time += 60_000;
    const second = await lava.processPaymentSuccess(payment);
    expect(second.created).toBe(false);
    expect(h.orders).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(second.order.accessDelivery?.status).toBe("sent");
    await lava.processPaymentSuccess(payment);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
