import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createProgressService } from "../services/progress";
import { createOrdersService } from "../services/orders";
import { getChatAccess } from "../services/access";
import { createAppStorage } from "../storage/appStorage";
import { readAllRows } from "../storage/pagination";
import { memorySupabase } from "./helpers/memorySupabase";
import type { Funnel, MessageEntry, OrderEntry, SubscriberProfile } from "../types";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function tempDir() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-storage-")); dirs.push(dir); return dir; }
const stage = { id: "s", title: "Lesson", index: 0 };
function progressHarness(db?: ReturnType<typeof memorySupabase>, dir = tempDir()) {
  return createProgressService({
    activeFunnels: new Map([["f", { id: "f", stages: [stage] } as Funnel]]),
    getSupabase: () => db?.client || null, getUseSupabase: () => !!db,
    progressFile: path.join(dir, "progress.json"), progressStateRowId: "__progress__",
  });
}
function order(index: number): OrderEntry {
  return { id: `order-${index}`, chatId: index, funnelId: "f", status: "paid", accessTier: "pkg-1",
    customer: "Buyer", username: "", product: "Course", amount: 10, date: "today", bot: "bot" };
}
function ordersHarness(db?: ReturnType<typeof memorySupabase>, dir = tempDir()) {
  const orders: OrderEntry[] = [];
  const progress = progressHarness(undefined, dir);
  const service = createOrdersService({ orders, ordersFile: path.join(dir, "orders.json"),
    getSupabase: () => db?.client || null, getUseSupabase: () => !!db,
    ensureUserState: progress.ensureUserState, persistUserState: progress.persistUserState });
  return { orders, service };
}

describe("complete data loading", () => {
  it("continues through pages smaller than the requested size and discards partial results on error", async () => {
    const db = memorySupabase({ rows: Array.from({ length: 1005 }, (_, id) => ({ id })) }, 37);
    const result = await readAllRows(() => db.client.from("rows").select("*").order("id"));
    expect(result.data).toHaveLength(1005);
    expect(result.data![1004].id).toBe(1004);
    let call = 0;
    const failed = await readAllRows(() => ({ range: async () => ++call === 1
      ? { data: [{ id: 1 }], error: null } : { data: null, error: { code: "08006" } } }));
    expect(failed).toEqual({ data: null, error: { code: "08006" } });
  });

  it("retains paid access beyond 1000 orders, including after local restart", async () => {
    const dir = tempDir();
    const { orders, service } = ordersHarness(undefined, dir);
    service.loadOrdersSnapshot(Array.from({ length: 1000 }, (_, i) => order(i + 1)));
    await service.addOrder(order(1001));
    expect(orders).toHaveLength(1001);
    expect(getChatAccess(orders, 1000, "f").paid).toBe(true);
    const restarted = ordersHarness(undefined, dir);
    restarted.service.loadOrdersSnapshot(JSON.parse(fs.readFileSync(path.join(dir, "orders.json"), "utf8")));
    expect(restarted.orders).toHaveLength(1001);
    expect(getChatAccess(restarted.orders, 1000, "f").paid).toBe(true);
  });

  it("loads all Supabase orders and all progress records with a capped API", async () => {
    const db = memorySupabase({
      orders: Array.from({ length: 1201 }, (_, i) => ({ ...order(i + 1), chat_id: i + 1 })),
      user_funnel_progress: Array.from({ length: 1201 }, (_, i) => ({
        chat_id: i + 1, funnel_id: "f", current_stage_id: "s", last_action_at: "2026-01-01T00:00:00Z",
        reminder_jobs: [{ id: `job-${i}`, funnelId: "f", stageId: "s", reminderId: "r", status: "pending", dueAt: "2026-10-01T00:00:00Z" }],
      })),
    });
    const { orders, service } = ordersHarness(db);
    expect(await service.loadOrdersFromSupabase()).toBe(1201);
    expect(getChatAccess(orders, 1201, "f").paid).toBe(true);
    const progress = progressHarness(db);
    expect(await progress.loadProgressFromSupabase()).toBe(1201);
    expect(progress.getUserState(1201, "f")?.reminderJobs[0].id).toBe("job-1200");
  });

  it("loads and refreshes an audience larger than one page without removing valid users", async () => {
    const dir = tempDir();
    const db = memorySupabase({ settings: [{ id: "main" }],
      subscribers: Array.from({ length: 1201 }, (_, i) => ({ id: i + 1, first_name: "Buyer" })),
      funnels: Array.from({ length: 1001 }, (_, i) => ({ id: `f-${i}`, data: { stages: [] } })),
    });
    const activeFunnels = new Map<string, Funnel>();
    const globalSubscribers = new Map<number, SubscriberProfile>();
    const storage = createAppStorage({ activeFunnels, globalSubscribers,
      defaultSettings: { bots: [], geminiApiKey: "", appUrl: "https://example.com", notifications: true, autoReminders: true },
      files: { funnels: `${dir}/funnels`, messages: `${dir}/messages`, orders: `${dir}/orders`, progress: `${dir}/progress`,
        settings: `${dir}/settings`, subscribers: `${dir}/subscribers`, tgCache: `${dir}/cache` },
      getSupabase: () => db.client, getUseSupabase: () => true, isProduction: true, setUseSupabase: () => undefined,
      loadOrdersFromSupabase: async () => 0, loadOrdersSnapshot: () => 0, ordersCount: () => 0,
      loadProgressFromSupabase: async () => 0, loadProgressSnapshot: () => 0,
      messageHistory: new Map<string, MessageEntry[]>(), progressStateRowId: "__progress__",
    });
    await storage.loadInitialData();
    expect(globalSubscribers.size).toBe(1201);
    expect(activeFunnels.size).toBe(1001);
    db.tables.subscribers.push({ id: 1202, first_name: "New buyer" });
    await storage.refreshAudienceData();
    expect(globalSubscribers.size).toBe(1202);
    expect(globalSubscribers.has(1201)).toBe(true);
  });
});

describe("progress recovery", () => {
  it.each([false, true])("restores reviewed homework including content and comments (Supabase=%s)", async (remote) => {
    const db = remote ? memorySupabase() : undefined;
    const dir = tempDir();
    const first = progressHarness(db, dir);
    await first.saveHomeworkSubmission(1, "f", {
      id: "hw", stageId: "s", content: "My homework", submittedAt: "2026-01-01T00:00:00Z",
      status: "pending_review", mediaUrl: "https://example.com/homework", aiFeedback: "Feedback",
    });
    await first.updateHomeworkStatus(1, "f", "s", "approved", "Good work");
    const restarted = progressHarness(db, dir);
    if (db) await restarted.loadProgressFromSupabase();
    else restarted.loadProgressSnapshot(JSON.parse(fs.readFileSync(path.join(dir, "progress.json"), "utf8")));
    expect(restarted.getUserState(1, "f")?.profile.homeworks?.s).toMatchObject({
      content: "My homework", status: "approved", reviewerComment: "Good work", aiFeedback: "Feedback",
      mediaUrl: "https://example.com/homework",
    });
  });

  it("migrates a newer legacy fallback and preserves newer table records", async () => {
    const db = memorySupabase({
      user_funnel_progress: [
        { chat_id: 1, funnel_id: "f", completed_stages: [], updated_at: "2026-01-01T00:00:00Z" },
        { chat_id: 2, funnel_id: "f", completed_stages: ["new"], updated_at: "2026-03-01T00:00:00Z" },
      ],
      funnels: [{ id: "__progress__", updated_at: "2026-02-01T00:00:00Z", data: {
        "1:f": { chatId: 1, funnelId: "f", completedStages: ["s"] },
        "2:f": { chatId: 2, funnelId: "f", completedStages: ["old"] },
      } }],
    });
    const first = progressHarness(db);
    await first.loadProgressFromSupabase();
    expect(first.getUserState(1, "f")?.completedStages).toEqual(["s"]);
    expect(first.getUserState(2, "f")?.completedStages).toEqual(["new"]);
    expect(db.tables.funnels).toEqual([]);
    const restarted = progressHarness(db);
    await restarted.loadProgressFromSupabase();
    expect(restarted.getUserState(1, "f")?.completedStages).toEqual(["s"]);
    expect(restarted.getUserState(2, "f")?.completedStages).toEqual(["new"]);
  });

  it("reports transient failures without switching storage, and retries the table on the next save", async () => {
    const db = memorySupabase();
    const progress = progressHarness(db);
    const state = progress.ensureUserState(1, "f");
    state.completedStages = ["s"];
    db.failures.set("user_funnel_progress:upsert", { code: "08006" });
    await expect(progress.persistUserState(1, state)).rejects.toThrow("persist funnel progress");
    expect(db.calls.some((call) => call.table === "funnels" && call.action === "upsert")).toBe(false);
    db.failures.clear();
    await progress.persistUserState(1, state);
    const restarted = progressHarness(db);
    await restarted.loadProgressFromSupabase();
    expect(restarted.getUserState(1, "f")?.completedStages).toEqual(["s"]);
    db.failures.set("user_funnel_progress:select", { code: "08006" });
    await expect(progressHarness(db).loadProgressFromSupabase()).rejects.toThrow("load funnel progress");
  });

  it("keeps the fallback intact if migration cannot be completed", async () => {
    const db = memorySupabase({ funnels: [{ id: "__progress__", data: {
      "1:f": { chatId: 1, funnelId: "f", completedStages: ["s"] },
    } }] });
    db.failures.set("user_funnel_progress:upsert", { code: "08006" });
    await expect(progressHarness(db).loadProgressFromSupabase()).rejects.toThrow();
    expect(db.tables.funnels).toHaveLength(1);
    db.failures.clear();
    const restarted = progressHarness(db);
    await restarted.loadProgressFromSupabase();
    expect(restarted.getUserState(1, "f")?.completedStages).toEqual(["s"]);
  });

  it("can still save to the legacy row while the progress table is missing and later migrate", async () => {
    const db = memorySupabase();
    db.failures.set("user_funnel_progress:select", { code: "42P01" });
    const progress = progressHarness(db);
    await progress.loadProgressFromSupabase();
    const state = progress.ensureUserState(1, "f"); state.completedStages = ["s"];
    await progress.persistUserState(1, state);
    expect(db.tables.funnels).toHaveLength(1);
    db.failures.clear();
    const restarted = progressHarness(db);
    await restarted.loadProgressFromSupabase();
    expect(restarted.getUserState(1, "f")?.completedStages).toEqual(["s"]);
    expect(db.tables.funnels).toHaveLength(0);
  });
});
