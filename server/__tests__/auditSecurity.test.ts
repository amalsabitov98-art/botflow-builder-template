import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequireAdminAuth } from "../services/adminAuth";
import { createAuditMiddleware } from "../services/httpSecurity";
import { createProgressService } from "../services/progress";
import { createBonusService } from "../services/bonus";
import { registerPlatformRoutes } from "../routes/platformRoutes";
import type { Funnel, OrderEntry } from "../types";

const dirs: string[] = [];
function tempDir() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-security-")); dirs.push(dir); return dir; }
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe("administrative route authorization", () => {
  it.each(["/api/settings", "/API/settings", "/Api/settings/", "/API/SETTINGS/", "/API/media/cache/"])(
    "requires a token for GET, POST and DELETE %s", async (url) => {
      const app = express();
      app.use(createRequireAdminAuth({ isProduction: true, getSupabase: () => ({} as any) }));
      app.all("/api/settings", (_req, res) => res.json({ mutated: true }));
      app.all("/api/media/cache", (_req, res) => res.json({ private: true }));
      await request(app).get(url).expect(401);
      await request(app).post(url).expect(401);
      await request(app).delete(url).expect(401);
    },
  );

  it("also enforces admin email and MFA for mixed-case URLs", async () => {
    const supabase = { auth: {
      getUser: async () => ({ data: { user: { email: "other@example.com" } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1" }, error: null }) },
    } };
    const app = express();
    app.use(createRequireAdminAuth({ isProduction: true, adminEmail: "admin@example.com", requireMfa: true,
      getSupabase: () => supabase as any }));
    app.get("/api/settings", (_req, res) => res.json({}));
    await request(app).get("/API/settings").set("Authorization", "Bearer test").expect(403);
    supabase.auth.getUser = async () => ({ data: { user: { email: "admin@example.com" } }, error: null });
    const response = await request(app).get("/Api/settings").set("Authorization", "Bearer test").expect(403);
    expect(response.body.code).toBe("mfa_required");
  });

  it("logs rejected requests with mixed-case paths and preserves public routes", async () => {
    const dir = tempDir();
    const app = express();
    app.use(createAuditMiddleware(dir));
    app.use(createRequireAdminAuth({ isProduction: true, getSupabase: () => ({} as any) }));
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
    await request(app).get("/API/health/").expect(200);
    await request(app).post("/API/settings/").expect(401);
    await vi.waitFor(() => {
      const entries = fs.readFileSync(path.join(dir, "audit/admin-actions.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ action: "admin_api_auth_failed", status: 401, path: "/API/settings/" });
    });
  });
});

function bonusHarness(customLessons = true) {
  const dir = tempDir();
  const funnel = { id: "f", stages: [], platform: {
    ...(customLessons ? { lessons: [
      { id: "real", title: "Lesson", module: "Module", minTier: "pkg-1" },
      { id: "vip", title: "VIP", module: "Module", minTier: "pkg-2" },
    ] } : {}),
    bonus: { enabled: true, perLesson: 10, rewards: [{ id: "r", title: "Reward", price: 10, payload: "reward" }] },
  } } as Funnel;
  const activeFunnels = new Map([["f", funnel]]);
  const progress = createProgressService({ activeFunnels, getSupabase: () => null, getUseSupabase: () => false,
    progressFile: path.join(dir, "progress.json"), progressStateRowId: "__progress__" });
  const bonus = createBonusService({ activeFunnels });
  const app = express(); app.use(express.json());
  registerPlatformRoutes(app, { activeFunnels, bonus,
    orders: [{ chatId: 1, funnelId: "f", status: "paid", accessTier: "pkg-1" } as OrderEntry],
    ensureUserState: progress.ensureUserState, persistUserState: progress.persistUserState,
    validateTelegramWebAppAuth: () => true,
  });
  const body = { chatId: 1, funnelId: "f" };
  return { app, body, bonus, progress, dir };
}

describe("course completion and bonus abuse", () => {
  it("rejects unknown and higher-tier lessons before changing progress or balance", async () => {
    const { app, body, progress } = bonusHarness();
    for (const lessonId of ["invented", "vip", "m1-setup"]) {
      await request(app).post("/api/platform/lesson").send({ ...body, lessonId }).expect(403);
    }
    expect(progress.getUserState(1, "f")).toBeUndefined();
    const accepted = await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "real" }).expect(200);
    expect(accepted.body.bonus.balance).toBe(10);
  });

  it("uses the built-in catalog with tier checks when no custom program exists", async () => {
    const { app, body } = bonusHarness(false);
    await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "m1-setup" }).expect(200);
    await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "bonus-source" }).expect(403);
  });

  it("does not recreate spent credit after unchecking, restart and rechecking", async () => {
    const { app, body, progress, bonus, dir } = bonusHarness();
    await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "real" }).expect(200);
    await request(app).post("/api/platform/reward").send({ ...body, rewardId: "r" }).expect(200);
    await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "real", done: false }).expect(200);
    progress.userStates.clear();
    progress.loadProgressSnapshot(JSON.parse(fs.readFileSync(path.join(dir, "progress.json"), "utf8")));
    const result = await request(app).post("/api/platform/lesson").send({ ...body, lessonId: "real" }).expect(200);
    expect(result.body.bonus.balance).toBe(0);
    expect(bonus.getBalance(progress.getUserState(1, "f")!)).toBe(0);
    await request(app).post("/api/platform/reward").send({ ...body, rewardId: "r" }).expect(400);
  });

  it("retains award keys after the visible history has been trimmed", () => {
    const { progress, bonus } = bonusHarness();
    const state = progress.ensureUserState(1, "f");
    bonus.awardForLesson(state, "f", "real");
    for (let i = 0; i < 210; i++) bonus.award(state, "f", `test-${i}`, 1, "Test");
    expect(state.profile.bonus!.history).toHaveLength(200);
    expect(bonus.awardForLesson(state, "f", "real").awarded).toBe(false);
    expect(bonus.getBalance(state)).toBe(220);
  });
});
