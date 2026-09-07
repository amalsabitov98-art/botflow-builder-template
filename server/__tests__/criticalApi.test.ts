import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRequireAdminAuth, isPublicApiPath } from "../services/adminAuth";
import { createProgressService } from "../services/progress";
import { createWebAppAuth } from "../services/webappAuth";
import { registerAudienceRoutes } from "../routes/audienceRoutes";
import { registerFunnelRoutes } from "../routes/funnelRoutes";
import { registerMediaRoutes } from "../routes/mediaRoutes";
import { registerPaymentRoutes } from "../routes/paymentRoutes";
import { registerPlatformAdminRoutes } from "../routes/platformAdminRoutes";
import { registerPlatformRoutes } from "../routes/platformRoutes";
import { createBonusService } from "../services/bonus";
import { registerSettingsRoutes } from "../routes/settingsRoutes";
import { registerTrackingRoutes } from "../routes/trackingRoutes";
import { registerWebAppRoutes } from "../routes/webappRoutes";
import { createLavaService } from "../services/lava";
import { createTelegramDeliveryService } from "../services/telegram";
import { createMediaUpload } from "../services/media";
import { applyHttpSecurity } from "../services/httpSecurity";
import { createOrdersService } from "../services/orders";
import { getChatAccess } from "../services/access";
import type { Funnel, FunnelStage, LavaPaymentIntent, OrderEntry, Settings } from "../types";

// Фикстуры воронок в тестах намеренно частичные: проверяем поведение API,
// а не полноту схемы, поэтому приводим их к типу явно.
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U> ? Array<DeepPartial<U>>
    : T[K] extends object ? DeepPartial<T[K]>
    : T[K];
};
const asFunnel = (value: DeepPartial<Funnel>) => value as Funnel;
const asStage = (value: DeepPartial<FunnelStage>) => value as FunnelStage;

const WEBAPP_SECRET = "test-webapp-signing-secret-32-chars";

// Восстановление прерванных рассылок и планировщик запускаются при регистрации
// роутов, поэтому в тестах ждём результат, а не фиксированную паузу.
async function waitFor(condition: () => boolean, timeoutMs = 4000) {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Условие не выполнилось за отведённое время");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function buildCampaign(partial: Record<string, unknown>) {
  return {
    id: `campaign-${Math.random().toString(36).slice(2, 8)}`,
    type: "manual",
    segmentKey: "all",
    segmentLabel: "Все",
    text: "Привет, {name}",
    createdAt: new Date().toISOString(),
    recipients: [],
    result: { total: 0, attempted: 0, sent: 0, failed: 0, skipped: 0, blocked: 0 },
    ...partial,
  } as any;
}

interface HarnessSeed {
  campaigns?: any[];
  subscribers?: Array<{ id: number; firstName?: string }>;
}

function createCriticalApiHarness(isProduction = true, seed: HarnessSeed = {}) {
  const app = express();
  app.use(express.json());

  const activeFunnels = new Map<string, any>([
    ["f1", {
      id: "f1",
      title: "Test Funnel",
      connectedBotId: "bot1",
      subscriberIds: [42],
      stages: [
        {
          id: "s1",
          index: 0,
          title: "Lesson One",
          webApp: {
            enabled: true,
            type: "lesson",
            content: "Hello",
            internalPrompt: "never expose this",
            paymentOffers: [
              { offerId: "offer-1", tier: "pkg-1", amount: 4900, currency: "RUB", product: "Paid course" },
              { offerId: "offer-pkg-1", tier: "pkg-1", amount: 49, currency: "USD", product: "Пакет 1: «IT-Архитектор»" },
              { offerId: "offer-pkg-2", tier: "pkg-2", amount: 99, currency: "USD", product: "Пакет 2: «IT-Владелец»" },
            ],
          },
        },
      ],
    }],
    ["f2", {
      id: "f2",
      title: "Second Funnel",
      connectedBotId: "bot2",
      subscriberIds: [42],
      stages: [
        {
          id: "s1",
          index: 0,
          title: "Second Lesson One",
          webApp: { enabled: true, type: "lesson", content: "Hello again" },
        },
      ],
    }],
    ["demo-funnel-copy", {
      id: "demo-funnel-copy",
      title: "Copied WebApp Funnel",
      // Режим Mini App — поле воронки, а не совпадение идентификатора.
      telegramMiniApp: true,
      connectedBotId: "bot1",
      subscriberIds: [42],
      stages: [
        {
          id: "stage-0",
          index: 0,
          title: "Lesson One",
          webApp: { enabled: true, type: "lesson", content: "Hello" },
          nextStage: { targetStageId: "stage-1", label: "Next" },
        },
        {
          id: "stage-1",
          index: 1,
          title: "Lesson Two",
          webApp: { enabled: true, type: "lesson", content: "Hello again" },
        },
      ],
    }],
  ]);

  const settings: Settings = {
    bots: [{
      id: "bot1",
      token: "test-token",
      name: "test_bot",
      firstName: "Test Bot",
      active: true,
      addedAt: new Date().toISOString(),
    }, {
      id: "bot2",
      token: "test-token-2",
      name: "second_test_bot",
      firstName: "Second Test Bot",
      active: true,
      addedAt: new Date().toISOString(),
    }],
    geminiApiKey: "",
    appUrl: "https://example.com",
    notifications: true,
    autoReminders: true,
    lavaApiKey: "",
    lavaWebhookSecret: "",
  };

  const fakeSupabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error("invalid token") }),
    },
  };

  app.use(createRequireAdminAuth({
    allowDevBypass: !isProduction,
    getSupabase: () => fakeSupabase as any,
    isProduction,
  }));

  const progress = createProgressService({
    activeFunnels,
    getSupabase: () => null,
    getUseSupabase: () => false,
    progressFile: `/tmp/critical-api-progress-${Date.now()}-${Math.random()}.json`,
    progressStateRowId: "__progress__",
  });

  const webAppAuth = createWebAppAuth({
    activeFunnels,
    getSettings: () => settings,
    getIsProduction: () => isProduction,
    getWebAppSigningSecret: () => WEBAPP_SECRET,
  });

  const orders = new Map<string, OrderEntry>();
  const sentMessages: Array<{ chatId: number; text: string }> = [];
  const sentPhotos: Array<{ chatId: number; source: string; caption?: string }> = [];
  const sentVideos: Array<{ chatId: number; source: string; caption?: string }> = [];
  const loggedMessages: Array<{ chatId: number; text: string }> = [];
  const deliveredStages: Array<{ chatId: number; funnelId: string; stageId: string }> = [];
  const broadcastCampaigns: any[] = [...(seed.campaigns || [])];
  const broadcastRules: any[] = [];
  const messageHistory = new Map<string, import("../types").MessageEntry[]>();
  const globalSubscribers = new Map<number, import("../types").SubscriberProfile>([[42, {
    id: 42,
    firstName: "Test",
    lastName: "User",
    username: "test_user",
    lastActive: new Date().toISOString(),
  }]]);
  for (const extra of seed.subscribers || []) {
    globalSubscribers.set(extra.id, {
      id: extra.id,
      firstName: extra.firstName || `Contact ${extra.id}`,
      lastActive: new Date().toISOString(),
    });
    activeFunnels.get("f1").subscriberIds.push(extra.id);
  }

  const botInstances = new Map<string, any>([["bot1", {
    sendMessage: async (chatId: number, text: string) => {
      sentMessages.push({ chatId, text });
    },
    sendPhoto: async (chatId: number, source: string, options?: { caption?: string }) => {
      sentPhotos.push({ chatId, source, caption: options?.caption });
    },
    sendVideo: async (chatId: number, source: string, options?: { caption?: string }) => {
      sentVideos.push({ chatId, source, caption: options?.caption });
    },
  }], ["bot2", {
    sendMessage: async (chatId: number, text: string) => {
      sentMessages.push({ chatId, text });
    },
    sendPhoto: async (chatId: number, source: string, options?: { caption?: string }) => {
      sentPhotos.push({ chatId, source, caption: options?.caption });
    },
    sendVideo: async (chatId: number, source: string, options?: { caption?: string }) => {
      sentVideos.push({ chatId, source, caption: options?.caption });
    },
  }]]);

  registerFunnelRoutes(app, {
    activeFunnels,
    buildFunnelStageAnalytics: () => null,
    deleteFunnel: async () => undefined,
    getWebAppUrl: (funnelId, stageId, chatId) => webAppAuth.getWebAppUrl(settings.appUrl, funnelId, stageId, chatId),
    recordUserEvent: progress.recordUserEvent,
    saveFunnel: async () => undefined,
    saveSubscriber: async () => undefined,
  });

  registerTrackingRoutes(app, {
    activeFunnels,
    botInstances: botInstances as any,
    cancelStageReminders: () => undefined,
    recordUserEvent: progress.recordUserEvent,
    schedulePaymentReminders: () => undefined,
    sendStageMessage: async (_bot, chatId, funnel, stage) => {
      deliveredStages.push({ chatId, funnelId: funnel.id, stageId: stage.id });
    },
    validateWebAppActionAuth: webAppAuth.validateWebAppActionAuth,
    getBotUsername: (botId) => settings.bots.find((bot) => bot.id === botId)?.name,
  });

  const orderList: OrderEntry[] = [];

  registerPaymentRoutes(app, {
    activeFunnels,
    botInstances,
    deliverAccess: async () => undefined,
    globalSubscribers,
    isProduction,
    getLavaClient: () => null,
    getRequestAuthValue: webAppAuth.getRequestAuthValue,
    getSettings: () => settings,
    savePaymentIntent: async () => undefined,
    addOrder: async (order) => {
      const existing = orders.get(order.id);
      if (existing) return { created: false, order: existing };

      orders.set(order.id, order);
      orderList.push(order);
      return { created: true, order };
    },
    validateWebAppActionAuth: webAppAuth.validateWebAppActionAuth,
  });

  registerPlatformRoutes(app, {
    activeFunnels,
    bonus: createBonusService({ activeFunnels }),
    orders: orderList,
    ensureUserState: (chatId, funnelId) => progress.ensureUserState(chatId, funnelId),
    persistUserState: progress.persistUserState,
    validateTelegramWebAppAuth: (req, funnelId, chatId) => {
      return funnelId === "f1" && chatId === 42 && req.body?.telegramInitData === "valid-telegram-init-data";
    },
  });

  registerPlatformAdminRoutes(app, {
    activeFunnels,
    botInstances: botInstances as any,
    globalSubscribers,
    orders: orderList,
    userStates: progress.userStates,
    sendStageMessage: async (_bot, chatId, funnel, stage) => {
      deliveredStages.push({ chatId, funnelId: funnel.id, stageId: stage.id });
    },
    updateHomeworkStatus: progress.updateHomeworkStatus,
  });

  registerWebAppRoutes(app, {
    activeFunnels,
    getUserState: progress.getUserState,
    userStates: progress.userStates,
    validateWebAppActionAuth: webAppAuth.validateWebAppActionAuth,
  });
  registerAudienceRoutes(app, {
    activeFunnels,
    sendIntervalMs: 0,
    broadcastCampaigns,
    broadcastRules,
    botInstances,
    globalSubscribers,
    getSettings: () => settings,
    messageHistory,
    orders: orderList,
    userStates: progress.userStates,
    getUserState: progress.getUserState,
    getUserStatesForChat: progress.getUserStatesForChat,
    logMessage: async (chatId, _from, text) => {
      loggedMessages.push({ chatId, text });
    },
    saveBroadcasts: async () => undefined,
    saveFunnel: async () => undefined,
    saveSubscriber: async () => undefined,
    deleteSubscriber: async (chatId) => { globalSubscribers.delete(chatId); },
    deleteUserState: progress.deleteUserState,
  });

  function signedBody(stageId: string, extra: Record<string, unknown> = {}) {
    const funnelId = typeof extra.funnelId === "string" ? extra.funnelId : "f1";
    const url = webAppAuth.getWebAppUrl(settings.appUrl, funnelId, stageId, 42);
    const params = new URL(url).searchParams;
    return {
      chatId: 42,
      funnelId,
      stageId,
      authTs: params.get("authTs"),
      authSig: params.get("authSig"),
      ...extra,
    };
  }

  function signedStageBody(extra: Record<string, unknown> = {}) {
    return signedBody("s1", extra);
  }

  function telegramPlatformBody(extra: Record<string, unknown> = {}) {
    return {
      chatId: 42,
      funnelId: "f1",
      stageId: "platform",
      telegramInitData: "valid-telegram-init-data",
      ...extra,
    };
  }

  return { app, orders, progress, activeFunnels, broadcastCampaigns, botInstances, globalSubscribers, messageHistory, signedStageBody, signedBody, telegramPlatformBody, sentMessages, sentPhotos, sentVideos, loggedMessages, deliveredStages };
}

describe("critical API behavior", () => {
  it("keeps production CSP strict while allowing the Vite refresh preamble in development", async () => {
    const productionApp = express();
    applyHttpSecurity(productionApp, true);
    productionApp.get("/", (_req, res) => res.send("ok"));
    const production = await request(productionApp).get("/").expect(200);
    expect(production.headers["content-security-policy"]).not.toContain("script-src 'self' https://telegram.org 'unsafe-inline'");
    expect(production.headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(production.headers["content-security-policy"]).not.toContain("frame-ancestors 'none'");
    expect(production.headers["x-frame-options"]).toBe("SAMEORIGIN");

    const developmentApp = express();
    applyHttpSecurity(developmentApp, false);
    developmentApp.get("/", (_req, res) => res.send("ok"));
    const development = await request(developmentApp).get("/").expect(200);
    expect(development.headers["content-security-policy"]).toContain("script-src 'self' https://telegram.org 'unsafe-inline'");
  });

  it("rejects admin API without auth in production", async () => {
    const { app } = createCriticalApiHarness(true);

    await request(app)
      .get("/api/funnels")
      .expect(401);
  });

  it("does not enable the development auth bypass unless explicitly requested", async () => {
    const app = express();
    app.use(createRequireAdminAuth({
      allowDevBypass: false,
      getSupabase: () => null,
      isProduction: false,
    }));
    app.get("/api/settings", (_req, res) => res.json({ unsafe: true }));

    await request(app).get("/api/settings").expect(503);
  });

  it("returns a storage error and rolls back an unsaved funnel", async () => {
    const app = express();
    app.use(express.json());
    const activeFunnels = new Map<string, any>();

    registerFunnelRoutes(app, {
      activeFunnels,
      buildFunnelStageAnalytics: () => null,
      deleteFunnel: async () => undefined,
      getWebAppUrl: () => "https://example.com",
      recordUserEvent: () => ({ alreadyRecorded: false, state: {} as any }),
      saveFunnel: async () => {
        throw new Error("Supabase write failed");
      },
      saveSubscriber: async () => undefined,
    });

    await request(app)
      .post("/api/funnels")
      .send({ id: "unsaved", title: "Unsaved funnel", stages: [] })
      .expect(503);

    expect(activeFunnels.has("unsaved")).toBe(false);
  });

  it("requires an aal2 token for protected admin APIs when MFA is enabled", async () => {
    const createApp = (currentLevel: "aal1" | "aal2") => {
      const app = express();
      const fakeSupabase = {
        auth: {
          getUser: async () => ({
            data: { user: { id: "admin-id", email: "owner@example.com" } },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: async () => ({
              data: { currentLevel, nextLevel: "aal2" },
              error: null,
            }),
          },
        },
      };
      app.use(createRequireAdminAuth({
        adminEmail: "owner@example.com",
        getSupabase: () => fakeSupabase as any,
        isProduction: true,
        requireMfa: true,
      }));
      app.get("/api/settings", (_req, res) => res.json({ ok: true }));
      return app;
    };

    await request(createApp("aal1"))
      .get("/api/settings")
      .set("Authorization", "Bearer valid-aal1")
      .expect(403, {
        code: "mfa_required",
        error: "Two-factor authentication is required",
      });

    await request(createApp("aal2"))
      .get("/api/settings")
      .set("Authorization", "Bearer valid-aal2")
      .expect(200, { ok: true });
  });

  it("keeps WebApp stage data public", async () => {
    const { app } = createCriticalApiHarness(true);

    const response = await request(app)
      .get("/api/webapp/f1/s1")
      .expect(200);

    expect(response.body).toMatchObject({
      title: "Lesson One",
      enabled: true,
      type: "lesson",
    });
    expect(response.body.internalPrompt).toBeUndefined();
  });

  it("does not expose Telegram media cache through the public media prefix", () => {
    expect(isPublicApiPath("GET", "/api/media/example.jpg")).toBe(true);
    expect(isPublicApiPath("GET", "/api/media/cache")).toBe(false);
    expect(isPublicApiPath("GET", "/api/admin/media/cache")).toBe(false);
    expect(isPublicApiPath("GET", "/api/subscribers/42/avatar")).toBe(false);
    expect(isPublicApiPath("GET", "/api/admin/media/library")).toBe(false);
  });

  it("lists project media and accepts PDF files in the admin gallery", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botflow-gallery-"));
    const imagesDir = path.join(tempRoot, "images");
    const mediaDir = path.join(tempRoot, "media");
    fs.mkdirSync(imagesDir);
    fs.mkdirSync(mediaDir);
    fs.writeFileSync(path.join(imagesDir, "cover.png"), Buffer.from("png"));

    try {
      const app = express();
      app.use(express.json());
      registerMediaRoutes(app, {
        getFunnels: () => [{
          id: "f1",
          title: "Test Funnel",
          stages: [{ firstMessage: { photo: "/api/images/cover.png" } }],
        }],
        imagesDir,
        mediaDir,
        mediaUpload: createMediaUpload(mediaDir),
        getSupabase: () => null,
        getTgCache: () => ({}),
        getUseSupabase: () => false,
      });

      const upload = await request(app)
        .post("/api/media/upload")
        .field("type", "document")
        .attach("file", Buffer.from("%PDF-1.4 test"), "guide.pdf")
        .expect(200);

      expect(upload.body).toMatchObject({
        originalName: "guide.pdf",
        mimeType: "application/pdf",
      });

      await request(app)
        .post("/api/media/upload")
        .field("type", "photo")
        .attach("file", Buffer.from("<script>alert(1)</script>"), "fake.png")
        .expect(400);

      const library = await request(app)
        .get("/api/admin/media/library")
        .expect(200);

      expect(library.body.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: "guide.pdf",
          type: "pdf",
          source: "upload",
        }),
        expect.objectContaining({
          name: "cover.png",
          type: "image",
          source: "project",
          usedIn: [{ id: "f1", title: "Test Funnel" }],
        }),
      ]));

      const uploadedPdf = library.body.items.find((item: any) => item.name === "guide.pdf");
      await request(app)
        .delete("/api/admin/media/library")
        .send({ id: uploadedPdf.id })
        .expect(200);

      const libraryAfterDelete = await request(app)
        .get("/api/admin/media/library")
        .expect(200);
      expect(libraryAfterDelete.body.items).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "guide.pdf" }),
      ]));

      await request(app)
        .delete("/api/admin/media/library")
        .send({ id: "project:cover.png" })
        .expect(400);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps contact avatars behind admin authentication", async () => {
    const { app } = createCriticalApiHarness(true);

    await request(app)
      .get("/api/subscribers/42/avatar")
      .expect(401);
  });

  it("proxies a Telegram contact avatar without exposing the bot token", async () => {
    const { app, botInstances } = createCriticalApiHarness(false);
    const bot = botInstances.get("bot1");
    bot.getUserProfilePhotos = async () => ({
      total_count: 1,
      photos: [[{
        file_id: "avatar-file",
        file_unique_id: "avatar-file-unique",
        width: 1,
        height: 1,
        file_size: 43,
      }]],
    });
    bot.getFileLink = async () => (
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    );

    const response = await request(app)
      .get("/api/subscribers/42/avatar")
      .expect(200)
      .expect("Content-Type", "image/gif");

    expect(response.headers["cache-control"]).toContain("private");
    expect(response.headers.vary).toContain("Authorization");
    expect(JSON.stringify(response.headers)).not.toContain("test-token");
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it("returns a cacheable empty result when Telegram has no contact photo", async () => {
    const { app, botInstances } = createCriticalApiHarness(false);
    for (const bot of botInstances.values()) {
      bot.getUserProfilePhotos = async () => ({ total_count: 0, photos: [] });
    }

    const response = await request(app)
      .get("/api/subscribers/42/avatar")
      .expect(404);

    expect(response.headers["cache-control"]).toContain("private");
  });

  it("does not cache a Telegram avatar service failure as a missing photo", async () => {
    const { app, botInstances } = createCriticalApiHarness(false);
    for (const bot of botInstances.values()) {
      bot.getUserProfilePhotos = async () => {
        throw new Error("Telegram is unavailable");
      };
    }

    const response = await request(app)
      .get("/api/subscribers/42/avatar")
      .expect(502);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejects profile progress without WebApp authentication", async () => {
    const { app } = createCriticalApiHarness(true);

    await request(app)
      .get("/api/webapp/f1/profile?chatId=42")
      .expect(401);
  });

  it("returns profile progress for a valid signed WebApp URL", async () => {
    const { app, signedBody, progress } = createCriticalApiHarness(true);
    progress.recordUserEvent(42, "stage_completed", "f1", "s1");
    const signed = signedBody("intro");

    const response = await request(app)
      .get("/api/webapp/f1/profile")
      .query({
        chatId: signed.chatId,
        authTs: signed.authTs,
        authSig: signed.authSig,
      })
      .expect(200);

    expect(response.body.progress.completedStages).toEqual(["s1"]);
  });

  it("rejects tracking without WebApp authentication", async () => {
    const { app } = createCriticalApiHarness(true);

    await request(app)
      .post("/api/track")
      .send({
        chatId: 42,
        event: "stage_completed",
        funnelId: "f1",
        stageId: "s1",
      })
      .expect(401);
  });

  it("accepts signed tracking and deduplicates repeated stage completion", async () => {
    const { app, progress, signedStageBody } = createCriticalApiHarness(true);
    const body = signedStageBody({ event: "stage_completed" });

    const first = await request(app)
      .post("/api/track")
      .send(body)
      .expect(200);
    expect(first.body).toMatchObject({ success: true, botUsername: "test_bot", botUrl: "https://t.me/test_bot" });

    const second = await request(app)
      .post("/api/track")
      .send(body)
      .expect(200);
    expect(second.body).toMatchObject({ success: true, duplicate: true, botUsername: "test_bot", botUrl: "https://t.me/test_bot" });

    const state = progress.getUserState(42, "f1");
    expect(state?.completedStages).toEqual(["s1"]);
    expect(state?.events.filter((event) => event.event === "stage_completed")).toHaveLength(1);
  });

  it("keeps progress separate for the same chat across funnels", async () => {
    const { app, progress, signedBody } = createCriticalApiHarness(true);

    await request(app)
      .post("/api/track")
      .send(signedBody("s1", { event: "stage_completed", funnelId: "f1" }))
      .expect(200);

    await request(app)
      .post("/api/track")
      .send(signedBody("s1", { event: "webapp_opened", funnelId: "f2" }))
      .expect(200);

    const firstFunnelState = progress.getUserState(42, "f1");
    const secondFunnelState = progress.getUserState(42, "f2");

    expect(firstFunnelState?.completedStages).toEqual(["s1"]);
    expect(firstFunnelState?.openedStages).toEqual([]);
    expect(secondFunnelState?.completedStages).toEqual([]);
    expect(secondFunnelState?.openedStages).toEqual(["s1"]);
    expect(progress.getUserStatesForChat(42)).toHaveLength(2);
  });

  it("sends the next copied WebApp funnel stage before responding", async () => {
    const { app, signedBody, deliveredStages } = createCriticalApiHarness(true);

    const response = await request(app)
      .post("/api/track")
      .send(signedBody("stage-0", {
        event: "stage_completed",
        funnelId: "demo-funnel-copy",
      }))
      .expect(200);

    expect(response.body).toMatchObject({ success: true, nextStageQueued: true });
    expect(deliveredStages).toEqual([{
      chatId: 42,
      funnelId: "demo-funnel-copy",
      stageId: "stage-1",
    }]);
  });

  it("uses Telegram web_app buttons only for funnels marked as Mini Apps", () => {
    const miniAppFunnels = new Map<string, any>([
      ["link-funnel", { id: "link-funnel", telegramMiniApp: false }],
      ["mini-app-funnel", { id: "mini-app-funnel", telegramMiniApp: true }],
      // Воронка без поля остаётся на внешней ссылке.
      ["demo-funnel-copy", { id: "demo-funnel-copy" }],
    ]);
    const delivery = createTelegramDeliveryService({
      activeFunnels: miniAppFunnels,
      dataDir: "/tmp",
      mediaDir: "/tmp",
      globalSubscribers: new Map(),
      getSettings: () => ({
        bots: [],
        geminiApiKey: "",
        appUrl: "https://example.com",
        notifications: true,
        autoReminders: true,
        lavaApiKey: "",
        lavaWebhookSecret: "",
      }),
      getTgCache: () => ({}),
      getWebAppUrl: (funnelId, stageId, chatId) => `https://example.com/?funnel=${funnelId}&stage=${stageId}&chatId=${chatId}`,
      logMessage: async () => undefined,
      saveTgCache: async () => undefined,
    });

    const keyboardFor = (funnelId: string) => delivery.buildInlineKeyboard(
      "Open",
      "open_webapp",
      "",
      "",
      "stage-0",
      funnelId,
      true,
      undefined,
      42
    );

    const linkKeyboard = keyboardFor("link-funnel");
    expect(linkKeyboard[0][0]).toMatchObject({
      text: "Open",
      url: "https://example.com/?funnel=link-funnel&stage=stage-0&chatId=42",
    });
    expect(linkKeyboard[0][0]).not.toHaveProperty("web_app");

    expect(keyboardFor("mini-app-funnel")[0][0]).toEqual({
      text: "Open",
      web_app: {
        url: "https://example.com/?funnel=mini-app-funnel&stage=stage-0&chatId=42",
      },
    });

    // Ни идентификатор воронки, ни её отсутствие в списке больше ничего не включают.
    expect(keyboardFor("demo-funnel-copy")[0][0]).not.toHaveProperty("web_app");
    expect(keyboardFor("unknown-funnel")[0][0]).not.toHaveProperty("web_app");
  });

  it("disables mock payment success in production", async () => {
    const { app } = createCriticalApiHarness(true);

    await request(app)
      .post("/api/payments/mock-success")
      .send({})
      .expect(404);
  });

  it("rejects an offer that is not configured for the signed funnel stage", async () => {
    const { app, signedStageBody } = createCriticalApiHarness(false);

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedStageBody({ offerId: "attacker-controlled-offer", amount: 1, currency: "USD" }))
      .expect(400, { error: "Offer is not available for this funnel stage" });
  });

  it("uses the server amount, currency and tier instead of client payment fields", async () => {
    const { app, orders, signedStageBody } = createCriticalApiHarness(false);

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedStageBody({ offerId: "offer-pkg-2", amount: 1, currency: "RUB" }))
      .expect(200);

    expect([...orders.values()][0]).toMatchObject({
      offerId: "offer-pkg-2",
      amount: 99,
      currency: "USD",
      accessTier: "pkg-2",
    });
  });

  it("persists the Lava contract mapping before returning a real checkout URL", async () => {
    const app = express();
    app.use(express.json());
    let savedIntent: LavaPaymentIntent | null = null;

    registerPaymentRoutes(app, {
      activeFunnels: new Map<string, Funnel>([["f1", asFunnel({
        id: "f1",
        stages: [{
          id: "s1",
          webApp: {
            paymentOffers: [
              { offerId: "offer-1", tier: "pkg-1", amount: 4900, currency: "RUB", product: "Paid course" },
            ],
          },
        }],
      })]]),
      botInstances: new Map(),
      deliverAccess: async () => undefined,
      globalSubscribers: new Map(),
      isProduction: true,
      getLavaClient: () => ({
        createOneTimePayment: async () => ({
          id: "contract-123",
          paymentUrl: "https://pay.lava.top/contract-123",
        }),
      } as any),
      getRequestAuthValue: () => undefined,
      getSettings: () => ({
        bots: [],
        geminiApiKey: "",
        appUrl: "https://example.com",
        notifications: true,
        autoReminders: true,
      }),
      addOrder: async (order) => ({ created: true, order }),
      savePaymentIntent: async (intent) => {
        savedIntent = intent;
      },
      validateWebAppActionAuth: () => true,
    });

    const response = await request(app)
      .post("/api/payments/create")
      .send({
        email: "buyer@example.com",
        offerId: "offer-1",
        chatId: 42,
        funnelId: "f1",
        stageId: "s1",
        currency: "RUB",
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      paymentUrl: "https://pay.lava.top/contract-123",
    });
    expect(savedIntent).toMatchObject({
      paymentId: "contract-123",
      chatId: 42,
      funnelId: "f1",
      stageId: "s1",
      offerId: "offer-1",
      tier: "pkg-1",
      amount: 4900,
      currency: "RUB",
      product: "Paid course",
      buyerEmail: "buyer@example.com",
    });
  });

  it("links a Lava payment.success webhook to the saved Telegram payment intent", async () => {
    const addedOrders: OrderEntry[] = [];
    const deliveredOrders: OrderEntry[] = [];
    const intent: LavaPaymentIntent = {
      paymentId: "contract-123",
      chatId: 42,
      funnelId: "f1",
      stageId: "s1",
      offerId: "offer-1",
      tier: "pkg-1",
      amount: 4900,
      currency: "RUB",
      product: "Paid course",
      buyerEmail: "buyer@example.com",
      createdAt: new Date().toISOString(),
    };

    const lava = createLavaService({
      activeFunnels: new Map<string, Funnel>([["f1", asFunnel({ id: "f1", connectedBotId: "bot1" })]]),
      addOrder: async (order) => {
        addedOrders.push(order);
        return { created: true, order };
      },
      deliverAccess: async (order) => {
        deliveredOrders.push(order);
      },
      getPaymentIntent: async (paymentId) => paymentId === intent.paymentId ? intent : null,
      globalSubscribers: new Map([[42, {
        id: 42,
        firstName: "Telegram",
        lastName: "Buyer",
        username: "telegram_buyer",
        lastActive: new Date().toISOString(),
      }]]),
      getSettings: () => ({
        bots: [{
          id: "bot1",
          token: "token",
          name: "sales_bot",
          firstName: "Sales",
          active: true,
          addedAt: new Date().toISOString(),
        }],
        geminiApiKey: "",
        appUrl: "https://example.com",
        notifications: true,
        autoReminders: true,
      }),
    });

    await lava.processPaymentSuccess({
      eventType: "payment.success",
      contractId: "contract-123",
      product: { id: "product-1", title: "Paid course" },
      buyer: { email: "buyer@example.com" },
      amount: 4900,
      currency: "RUB",
      timestamp: new Date().toISOString(),
      status: "COMPLETED",
    } as any);

    expect(addedOrders).toHaveLength(1);
    expect(addedOrders[0]).toMatchObject({
      customer: "Telegram Buyer",
      username: "@telegram_buyer",
      product: "Paid course",
      amount: 4900,
      currency: "RUB",
      accessTier: "pkg-1",
      stageId: "s1",
      offerId: "offer-1",
      chatId: 42,
      funnelId: "f1",
      bot: "@sales_bot",
      status: "paid",
    });
    expect(deliveredOrders).toEqual(addedOrders);
  });

  it("denies platform access from a copied signed browser URL", async () => {
    const { app, signedBody } = createCriticalApiHarness(true);

    await request(app)
      .post("/api/platform/access")
      .send(signedBody("platform"))
      .expect(401);
  });

  it("denies platform access without a paid order", async () => {
    const { app, telegramPlatformBody } = createCriticalApiHarness(true);

    const res = await request(app)
      .post("/api/platform/access")
      .send(telegramPlatformBody())
      .expect(403);
    expect(res.body).toMatchObject({ paid: false });
  });

  it("does not grant one funnel access from a purchase in another funnel", () => {
    const crossFunnelOrder: OrderEntry = {
      id: "paid-in-f2",
      customer: "Buyer",
      username: "",
      product: "Paid package",
      amount: 99,
      status: "paid",
      date: "today",
      bot: "@bot",
      chatId: 42,
      funnelId: "f2",
      accessTier: "pkg-2",
    };

    expect(getChatAccess([crossFunnelOrder], 42, "f1")).toEqual({
      paid: false,
      tier: null,
      products: [],
      orderIds: [],
    });
  });

  it("does not log a Telegram delivery that failed after all fallbacks", async () => {
    const logged: string[] = [];
    const delivery = createTelegramDeliveryService({
      activeFunnels: new Map(),
      dataDir: "/tmp",
      mediaDir: "/tmp",
      globalSubscribers: new Map(),
      getSettings: () => ({
        bots: [],
        geminiApiKey: "",
        appUrl: "https://example.com",
        notifications: true,
        autoReminders: true,
      }),
      getTgCache: () => ({}),
      getWebAppUrl: () => "https://example.com",
      logMessage: async (_chatId, _from, text) => { logged.push(text); },
      saveTgCache: async () => undefined,
    });
    const bot = {
      sendPhoto: async () => { throw new Error("Telegram unavailable"); },
    } as any;

    await expect(delivery.deliverStageMessage(bot, 42, asFunnel({ id: "f1" }), asStage({
      id: "s1",
      firstMessage: { text: "Must not be logged", photo: "/missing.jpg" },
    }))).rejects.toThrow("Telegram unavailable");
    expect(logged).toEqual([]);
  });

  it("grants platform access after a paid order", async () => {
    const { app, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-2" }))
      .expect(200);

    const res = await request(app)
      .post("/api/platform/access")
      .send(telegramPlatformBody())
      .expect(200);
    expect(res.body).toMatchObject({ paid: true, tier: "pkg-2" });
    expect(Array.isArray(res.body.modules)).toBe(true);
    expect(res.body.modules.length).toBeGreaterThan(0);
  });

  it("отдаёт программу из настроек воронки и прячет уроки чужого тарифа", async () => {
    const { app, activeFunnels, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);
    activeFunnels.get("f1").platform = {
      title: "Школа подрядчика",
      tiers: { "pkg-1": { label: "Базовый" }, "pkg-2": { label: "Максимум" } },
      lessons: [
        {
          id: "own-1",
          module: "Модуль 1",
          title: "Первый урок",
          videoSrc: "https://example.com/embed/one",
          minTier: "pkg-1",
          resources: [
            { label: "Чек-лист", href: "https://example.com/check" },
            { label: "Исходники", href: "https://example.com/src", minTier: "pkg-2" },
          ],
        },
        { id: "own-2", module: "Модуль 2", title: "Бонусный урок", videoSrc: "https://example.com/embed/two", minTier: "pkg-2" },
      ],
    };

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-1" }))
      .expect(200);

    const res = await request(app)
      .post("/api/platform/access")
      .send(telegramPlatformBody())
      .expect(200);

    expect(res.body.title).toBe("Школа подрядчика");
    expect(res.body.tierLabels).toEqual({ "pkg-1": "Базовый", "pkg-2": "Максимум" });
    expect(res.body.lessons.map((lesson: any) => lesson.id)).toEqual(["own-1"]);
    // Материал старшего тарифа не уезжает даже внутри доступного урока.
    expect(res.body.lessons[0].resources.map((resource: any) => resource.label)).toEqual(["Чек-лист"]);
    // От чужого урока остаётся вывеска без видео.
    expect(res.body.lockedLessons).toEqual([
      { id: "own-2", module: "Модуль 2", title: "Бонусный урок", duration: "" },
    ]);
    expect(JSON.stringify(res.body)).not.toContain("embed/two");
  });

  it("показывает в админке, кто оплатил платформу и сколько уроков прошёл", async () => {
    const { app, activeFunnels, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);
    activeFunnels.get("f1").platform = {
      lessons: [
        { id: "own-1", module: "Модуль 1", title: "Первый урок", minTier: "pkg-1" },
        { id: "own-2", module: "Модуль 1", title: "Второй урок", minTier: "pkg-1" },
      ],
    };

    const empty = await request(app).get("/api/funnels/f1/platform-stats").expect(200);
    expect(empty.body).toMatchObject({ paid: 0, started: 0, students: [] });

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-1" }))
      .expect(200);
    await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "own-1", done: true })
      .expect(200);

    const res = await request(app).get("/api/funnels/f1/platform-stats").expect(200);
    expect(res.body).toMatchObject({ paid: 1, started: 1, finished: 0, byTier: { "pkg-1": 1, "pkg-2": 0 } });
    expect(res.body.students[0]).toMatchObject({ chatId: 42, name: "Test User", completed: 1, total: 2 });
  });

  it("принимает домашнее задание из админки: пишет ученику и открывает следующий этап", async () => {
    const { app, progress, sentMessages, deliveredStages } = createCriticalApiHarness(false);
    await progress.saveHomeworkSubmission(42, "demo-funnel-copy", {
      id: "hw-1",
      stageId: "stage-0",
      submittedAt: new Date().toISOString(),
      content: "Вот моя работа",
      status: "pending_review",
    });

    const pending = await request(app).get("/api/funnels/demo-funnel-copy/homeworks").expect(200);
    expect(pending.body.items).toHaveLength(1);
    expect(pending.body.items[0]).toMatchObject({ chatId: 42, name: "Test User", stageTitle: "Lesson One" });

    const review = await request(app)
      .post("/api/funnels/demo-funnel-copy/homeworks/review")
      .send({ chatId: 42, stageId: "stage-0", status: "approved" })
      .expect(200);
    expect(review.body).toMatchObject({ success: true, notified: true, nextStageId: "stage-1" });
    expect(sentMessages.some((message) => message.chatId === 42 && message.text.includes("одобрено"))).toBe(true);
    expect(deliveredStages).toContainEqual({ chatId: 42, funnelId: "demo-funnel-copy", stageId: "stage-1" });

    const after = await request(app).get("/api/funnels/demo-funnel-copy/homeworks").expect(200);
    expect(after.body.items).toHaveLength(0);
  });

  it("сохраняет прогресс по платному курсу на сервере, а не в браузере", async () => {
    // Оплату проводим тем же путём, что и в жизни: через mock-checkout.
    const { app, progress, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);
    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-2" }))
      .expect(200);

    const marked = await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-setup", done: true })
      .expect(200);
    expect(marked.body.progress.completed).toEqual(["m1-setup"]);

    // Прогресс возвращается вместе с доступом — то есть переживёт смену устройства.
    const access = await request(app)
      .post("/api/platform/access")
      .send(telegramPlatformBody())
      .expect(200);
    expect(access.body.progress.completed).toEqual(["m1-setup"]);
    expect(progress.getUserState(42, "f1")?.profile.course?.completed).toEqual(["m1-setup"]);

    // Снятие отметки тоже сохраняется.
    const cleared = await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-setup", done: false })
      .expect(200);
    expect(cleared.body.progress.completed).toEqual([]);
  });

  it("не даёт писать прогресс курса без оплаты и вне Telegram", async () => {
    const { app, telegramPlatformBody } = createCriticalApiHarness(true);

    // Оплаты нет.
    await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-setup", done: true })
      .expect(403);

    // Скопированная ссылка вне Telegram WebApp.
    await request(app)
      .post("/api/platform/lesson")
      .send({ chatId: 42, funnelId: "f1", lessonId: "m1-setup", done: true })
      .expect(401);
  });

  it("начисляет бонус за урок один раз и списывает его при обмене", async () => {
    const { app, activeFunnels, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);
    activeFunnels.get("f1").platform = {
      bonus: {
        enabled: true,
        perLesson: 200,
        currencyLabel: "бонусов",
        rewards: [{ id: "r1", title: "Шаблон КП", price: 300, payload: "https://example.com/kp" }],
      },
    };

    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-2" }))
      .expect(200);

    const first = await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-setup", done: true })
      .expect(200);
    expect(first.body.bonus.balance).toBe(200);

    // Повторное нажатие бонус не удваивает.
    const again = await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-setup", done: true })
      .expect(200);
    expect(again.body.bonus.balance).toBe(200);

    // Не хватает на награду — обмен не проходит и баланс не меняется.
    const denied = await request(app)
      .post("/api/platform/reward")
      .send({ ...telegramPlatformBody(), rewardId: "r1" })
      .expect(400);
    expect(denied.body.balance).toBe(200);

    await request(app)
      .post("/api/platform/lesson")
      .send({ ...telegramPlatformBody(), lessonId: "m1-frontend", done: true })
      .expect(200);

    const redeemed = await request(app)
      .post("/api/platform/reward")
      .send({ ...telegramPlatformBody(), rewardId: "r1" })
      .expect(200);
    expect(redeemed.body.payload).toBe("https://example.com/kp");
    expect(redeemed.body.bonus.balance).toBe(100);
  });

  it("не отдаёт содержимое награды до обмена", async () => {
    const { app, activeFunnels, signedBody, telegramPlatformBody } = createCriticalApiHarness(false);
    activeFunnels.get("f1").platform = {
      bonus: {
        enabled: true,
        perLesson: 10,
        rewards: [{ id: "r1", title: "Шаблон КП", price: 300, payload: "secret-link" }],
      },
    };
    await request(app)
      .post("/api/payments/mock-success")
      .send(signedBody("s1", { amount: 49, offerId: "offer-pkg-2" }))
      .expect(200);

    const access = await request(app)
      .post("/api/platform/access")
      .send(telegramPlatformBody())
      .expect(200);

    expect(JSON.stringify(access.body)).not.toContain("secret-link");
    expect(access.body.bonus.rewards[0]).toMatchObject({ id: "r1", price: 300, unlocked: false });
  });

  it("deduplicates repeated mock payment success requests", async () => {
    const { app, orders, signedStageBody } = createCriticalApiHarness(false);
    const body = signedStageBody({
      amount: 100,
      offerId: "offer-pkg-1",
    });

    const first = await request(app)
      .post("/api/payments/mock-success")
      .send(body)
      .expect(200);
    expect(first.body).toMatchObject({ success: true });

    const second = await request(app)
      .post("/api/payments/mock-success")
      .send(body)
      .expect(200);
    expect(second.body).toEqual({
      success: true,
      duplicate: true,
      orderId: first.body.orderId,
    });

    expect(orders.size).toBe(1);
  });

  it("хранит ключ ассистента в настройках, отдаёт его только маской и не теряет при сохранении", async () => {
    const app = express();
    app.use(express.json());
    const settings: Settings = {
      bots: [],
      geminiApiKey: "",
      appUrl: "https://example.com",
      notifications: true,
      autoReminders: true,
      deepseekApiKey: "sk-assistant-secret-value",
    };

    registerSettingsRoutes(app, {
      isAssistantConfigured: () => Boolean(settings.deepseekApiKey),
      getSettings: () => settings,
      getRunningBotIds: () => new Set(),
      initLavaClientAndWebhook: () => undefined,
      saveSettings: async () => undefined,
      startBotInstance: () => undefined,
      stopBotById: () => undefined,
      verifyBotToken: async () => ({ ok: false }),
    });

    const loaded = await request(app).get("/api/settings").expect(200);

    expect(JSON.stringify(loaded.body)).not.toContain("sk-assistant-secret-value");
    expect(loaded.body.deepseekApiKey).toContain("••");
    expect(loaded.body.assistantConfigured).toBe(true);

    // Возврат маски обратно не должен стирать настоящий ключ.
    await request(app)
      .post("/api/settings")
      .send({ deepseekApiKey: loaded.body.deepseekApiKey })
      .expect(200, { success: true });
    expect(settings.deepseekApiKey).toBe("sk-assistant-secret-value");

    // А новый ключ — сохраняется.
    await request(app)
      .post("/api/settings")
      .send({ deepseekApiKey: "  sk-new-key  " })
      .expect(200, { success: true });
    expect(settings.deepseekApiKey).toBe("sk-new-key");
  });

  it("does not expose Lava secrets and preserves masked values on save", async () => {
    const app = express();
    app.use(express.json());
    const settings: Settings = {
      bots: [],
      geminiApiKey: "gemini-secret-value",
      appUrl: "https://example.com",
      notifications: true,
      autoReminders: true,
      lavaApiKey: "lava-api-secret-value",
      lavaWebhookSecret: "lava-webhook-secret-value",
    };
    let saveCount = 0;

    registerSettingsRoutes(app, {
      getSettings: () => settings,
      getRunningBotIds: () => new Set(),
      initLavaClientAndWebhook: () => undefined,
      saveSettings: async () => {
        saveCount += 1;
      },
      startBotInstance: () => undefined,
      stopBotById: () => undefined,
      verifyBotToken: async () => ({ ok: false }),
    });

    const loaded = await request(app)
      .get("/api/settings")
      .expect(200);

    expect(JSON.stringify(loaded.body)).not.toContain("lava-api-secret-value");
    expect(JSON.stringify(loaded.body)).not.toContain("lava-webhook-secret-value");
    expect(loaded.body.lavaApiKey).toContain("••");
    expect(loaded.body.lavaWebhookSecret).toContain("••");

    await request(app)
      .post("/api/settings")
      .send({
        lavaApiKey: loaded.body.lavaApiKey,
        lavaWebhookSecret: loaded.body.lavaWebhookSecret,
      })
      .expect(200, { success: true });

    expect(saveCount).toBe(1);
    expect(settings.lavaApiKey).toBe("lava-api-secret-value");
    expect(settings.lavaWebhookSecret).toBe("lava-webhook-secret-value");
  });

  it("keeps failed Supabase orders out of memory and reports the write failure", async () => {
    const orders: OrderEntry[] = [];
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async () => ({
          error: { code: "08006", message: "database unavailable" },
        }),
      }),
    };
    const service = createOrdersService({
      ensureUserState: () => ({
        funnelId: "f1",
        currentStageId: "",
        currentStageIndex: 0,
        profile: { answers: {} },
        finished: false,
        sentStages: [],
        openedStages: [],
        viewedStages: [],
        completedStages: [],
        purchaseStatus: "none",
        events: [],
        reminderJobs: [],
        lastActionAt: new Date().toISOString(),
        timeouts: [],
      }),
      getSupabase: () => fakeSupabase as any,
      getUseSupabase: () => true,
      orders,
      ordersFile: path.join(os.tmpdir(), `orders-${Date.now()}.json`),
      persistUserState: async () => undefined,
    });
    const order: OrderEntry = {
      id: "LAVA-FAIL",
      customer: "Buyer",
      username: "",
      product: "Course",
      amount: 100,
      status: "paid",
      date: "today",
      bot: "@bot",
      chatId: 42,
      funnelId: "f1",
    };

    await expect(service.addOrder(order)).rejects.toThrow("Failed to persist order");
    expect(orders).toEqual([]);
  });

  it("previews and sends broadcasts to a selected segment", async () => {
    const { app, progress, sentMessages, loggedMessages } = createCriticalApiHarness(false);
    const state = progress.ensureUserState(42, "f1");
    state.currentStageId = "s1";
    state.currentStageIndex = 0;
    state.events.push({
      event: "profile_opened",
      stageId: "s1",
      timestamp: new Date().toISOString(),
    });

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "profile_opened", text: "Привет, {name}. Этап: {stage}" })
      .expect(200);

    expect(preview.body).toMatchObject({
      total: 1,
      ready: 1,
      skipped: 0,
      sampleText: "Привет, Test. Этап: Lesson One",
    });

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "profile_opened", text: "Привет, {name}. Этап: {stage}", confirmText: "ОТПРАВИТЬ 1" })
      .expect(200);

    expect(result.body.result).toMatchObject({
      total: 1,
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(sentMessages).toEqual([{ chatId: 42, text: "Привет, Test. Этап: Lesson One" }]);
    expect(loggedMessages).toEqual([{ chatId: 42, text: "Привет, Test. Этап: Lesson One" }]);
  });

  it("sends a test to the selected Telegram contact even outside the campaign segment", async () => {
    const { app, sentMessages } = createCriticalApiHarness(false);

    const result = await request(app)
      .post("/api/broadcasts/test")
      .send({
        segmentKey: "profile_opened",
        funnelId: "f2",
        chatId: 42,
        text: "Тест для {name}",
      })
      .expect(200);

    expect(result.body.type).toBe("test");
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toEqual({ chatId: 42, text: "Тест для Test" });
  });

  it("reaches a subscriber across funnels on different bots, deduping per bot", async () => {
    const { app, sentMessages } = createCriticalApiHarness(false);
    // Подписчик 42 состоит в f1 (bot1), demo-funnel-copy (bot1) и f2 (bot2).

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Привет, {name}" })
      .expect(200);

    // Две воронки на одном bot1 — это один чат (один раз), f2 на bot2 — отдельный чат.
    expect(preview.body.ready).toBe(2);

    await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "all", text: "Привет, {name}", confirmText: "ОТПРАВИТЬ 2" })
      .expect(200);

    // Один и тот же человек получает сообщение в обеих воронках на разных ботах.
    expect(sentMessages.filter((message) => message.chatId === 42)).toHaveLength(2);
  });

  it("scopes a broadcast to a single funnel", async () => {
    const { app, sentMessages } = createCriticalApiHarness(false);

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Hi", funnelId: "f2" })
      .expect(200);

    expect(preview.body).toMatchObject({ funnelId: "f2", ready: 1 });

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "all", text: "Hi {name}", funnelId: "f2", confirmText: "ОТПРАВИТЬ 1" })
      .expect(200);

    expect(result.body.funnelId).toBe("f2");
    expect(result.body.recipients[0].funnelId).toBe("f2");
    expect(sentMessages).toEqual([{ chatId: 42, text: "Hi Test" }]);
  });

  it("sends an image and text together as a Telegram photo caption", async () => {
    const { app, sentPhotos, sentMessages } = createCriticalApiHarness(false);

    await request(app)
      .post("/api/broadcasts/send")
      .send({
        segmentKey: "all",
        funnelId: "f1",
        text: "Привет, {name}",
        mediaType: "photo",
        mediaUrl: "https://example.com/image.jpg",
        confirmText: "ОТПРАВИТЬ 1",
      })
      .expect(200);

    expect(sentPhotos).toEqual([{
      chatId: 42,
      source: "https://example.com/image.jpg",
      caption: "Привет, Test",
    }]);
    expect(sentMessages).toEqual([]);
  });

  it("sends a regular video and text together as a Telegram video caption", async () => {
    const { app, sentVideos, sentMessages } = createCriticalApiHarness(false);

    await request(app)
      .post("/api/broadcasts/send")
      .send({
        segmentKey: "all",
        funnelId: "f1",
        text: "Смотрите, {name}",
        mediaType: "video",
        mediaUrl: "https://example.com/video.mp4",
        confirmText: "ОТПРАВИТЬ 1",
      })
      .expect(200);

    expect(sentVideos).toEqual([{
      chatId: 42,
      source: "https://example.com/video.mp4",
      caption: "Смотрите, Test",
    }]);
    expect(sentMessages).toEqual([]);
  });

  it("scopes preview recipients to the contacts selected in the CRM", async () => {
    const { app } = createCriticalApiHarness(false);

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Hi", recipientIds: [999] })
      .expect(200);

    expect(preview.body).toMatchObject({ total: 0, ready: 0, skipped: 0 });
  });

  it("saves, schedules, updates and deletes broadcast drafts", async () => {
    const { app, broadcastCampaigns } = createCriticalApiHarness(false);

    const draft = await request(app)
      .post("/api/broadcasts/save")
      .send({
        status: "draft",
        name: "Возврат к уроку",
        segmentKey: "all",
        text: "",
        recipientIds: [42],
      })
      .expect(200);

    expect(draft.body).toMatchObject({
      status: "draft",
      name: "Возврат к уроку",
      recipientIds: [42],
    });
    expect(broadcastCampaigns).toHaveLength(1);

    const scheduled = await request(app)
      .post("/api/broadcasts/save")
      .send({
        id: draft.body.id,
        status: "scheduled",
        name: "Возврат к уроку",
        segmentKey: "all",
        text: "Привет, {name}",
        recipientIds: [42],
        scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        confirmText: "ОТПРАВИТЬ 2",
      })
      .expect(200);

    expect(scheduled.body).toMatchObject({
      id: draft.body.id,
      status: "scheduled",
      name: "Возврат к уроку",
    });
    expect(scheduled.body.scheduledAt).toBeTruthy();
    expect(broadcastCampaigns).toHaveLength(1);

    await request(app)
      .delete(`/api/broadcasts/${draft.body.id}`)
      .expect(200);
    expect(broadcastCampaigns).toHaveLength(0);
  });

  it("enforces the server broadcast cap even if the client asks for a higher limit", async () => {
    const { app, activeFunnels, globalSubscribers } = createCriticalApiHarness(false);
    const funnel = activeFunnels.get("f1");

    for (let index = 0; index < 249; index += 1) {
      const chatId = 1000 + index;
      globalSubscribers.set(chatId, {
        id: chatId,
        firstName: `Contact ${index + 1}`,
        lastActive: new Date().toISOString(),
      });
      funnel.subscriberIds.push(chatId);
    }

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Hello" })
      .expect(200);
    expect(preview.body.ready).toBe(251);
    expect(preview.body.recipients).toHaveLength(251);

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({
        segmentKey: "all",
        text: "Hello",
        confirmText: "ОТПРАВИТЬ 251",
        maxRecipients: 10_000,
      })
      .expect(400);

    expect(result.body).toMatchObject({
      ready: 251,
      maxRecipients: 100,
    });
  });

  it("дописывает рассылку, прерванную перезапуском, и не шлёт повторно уже отправленным", async () => {
    const interrupted = buildCampaign({
      status: "sending",
      sentAt: new Date().toISOString(),
      // Слепок аудитории на момент запуска + прогресс, сохранённый до падения.
      targetChatIds: [42, 77],
      recipients: [{ chatId: 42, status: "sent", sentAt: new Date().toISOString() }],
      result: { total: 2, attempted: 1, sent: 1, failed: 0, skipped: 0, blocked: 0 },
    });

    const { sentMessages } = createCriticalApiHarness(false, {
      campaigns: [interrupted],
      subscribers: [{ id: 77, firstName: "Second" }],
    });

    await waitFor(() => interrupted.status !== "sending");

    expect(sentMessages.map(message => message.chatId)).toEqual([77]);
    expect(interrupted.status).toBe("sent");
    expect(interrupted.result).toMatchObject({ total: 2, sent: 2 });
  });

  it("закрывает прерванную рассылку без слепка аудитории вместо вечного статуса sending", async () => {
    const legacy = buildCampaign({
      status: "sending",
      sentAt: new Date().toISOString(),
      recipients: [{ chatId: 42, status: "sent", sentAt: new Date().toISOString() }],
      result: { total: 2, attempted: 1, sent: 1, failed: 0, skipped: 0, blocked: 0 },
    });

    const { sentMessages } = createCriticalApiHarness(false, { campaigns: [legacy] });

    await waitFor(() => legacy.status !== "sending");

    expect(legacy.status).toBe("sent");
    expect(legacy.error).toContain("перезапуском");
    expect(sentMessages).toHaveLength(0);
  });

  it("отправляет запланированную рассылку, когда аудитория переросла ручной лимит", async () => {
    const scheduled = buildCampaign({
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      text: "Плановое сообщение",
    });
    const extraSubscribers = Array.from({ length: 120 }, (_, index) => ({ id: 3000 + index }));

    const { sentMessages } = createCriticalApiHarness(false, {
      campaigns: [scheduled],
      subscribers: extraSubscribers,
    });

    await waitFor(() => scheduled.status !== "scheduled" && scheduled.status !== "sending");

    expect(scheduled.status).toBe("sent");
    expect(scheduled.error).toBeUndefined();
    expect(sentMessages.length).toBeGreaterThan(100);
  });

  it("объясняет причину, когда запланированная рассылка упирается в предел", async () => {
    const scheduled = buildCampaign({
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      text: "Слишком большая рассылка",
    });
    const extraSubscribers = Array.from({ length: 1001 }, (_, index) => ({ id: 5000 + index }));

    const { sentMessages } = createCriticalApiHarness(false, {
      campaigns: [scheduled],
      subscribers: extraSubscribers,
    });

    await waitFor(() => scheduled.status !== "scheduled" && scheduled.status !== "sending");

    expect(scheduled.status).toBe("failed");
    expect(scheduled.error).toContain("1000");
    expect(sentMessages).toHaveLength(0);
  });

  it("marks subscribers as blocked on Telegram 403 and excludes them from future broadcasts", async () => {
    const { app, botInstances, globalSubscribers } = createCriticalApiHarness(false);
    const blockedError: any = new Error("ETELEGRAM: 403 Forbidden: bot was blocked by the user");
    blockedError.response = { body: { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } };
    const throwingBot = { sendMessage: async () => { throw blockedError; } };
    botInstances.set("bot1", throwingBot as any);
    botInstances.set("bot2", throwingBot as any);

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "all", text: "Привет, {name}", confirmText: "ОТПРАВИТЬ 2" })
      .expect(200);

    expect(result.body.status).toBe("failed");
    expect(result.body.result).toMatchObject({ sent: 0, failed: 0, blocked: 2 });
    expect(result.body.recipients.every((recipient: any) => recipient.status === "blocked")).toBe(true);
    expect(globalSubscribers.get(42)?.botBlockedAt).toBeTruthy();

    // Заблокировавший бота больше не попадает в получатели.
    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Привет" })
      .expect(200);
    expect(preview.body).toMatchObject({ total: 0, ready: 0 });
  });

  it("помечает недостижимый чат и больше не пытается в него писать", async () => {
    const { app, globalSubscribers, botInstances } = createCriticalApiHarness(false);
    // Аккаунт удалён: Telegram отвечает 400 «chat not found».
    const notFound: any = new Error("ETELEGRAM: 400 Bad Request: chat not found");
    notFound.response = { body: { ok: false, error_code: 400, description: "Bad Request: chat not found" } };
    const throwingBot = { sendMessage: async () => { throw notFound; } };
    botInstances.set("bot1", throwingBot as any);
    botInstances.set("bot2", throwingBot as any);

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "all", text: "Привет", confirmText: "ОТПРАВИТЬ 2" })
      .expect(200);

    // Повторять такое бессмысленно, поэтому считаем как «недостижим», а не как сбой.
    expect(result.body.result).toMatchObject({ sent: 0, failed: 0, blocked: 2 });
    expect(globalSubscribers.get(42)?.botBlockedAt).toBeTruthy();

    const preview = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", text: "Привет" })
      .expect(200);
    expect(preview.body).toMatchObject({ total: 0, ready: 0 });
  });

  it("retries the send after a Telegram 429 flood limit", async () => {
    const { app, botInstances, sentMessages } = createCriticalApiHarness(false);
    let calls = 0;
    const floodError: any = new Error("ETELEGRAM: 429 Too Many Requests");
    floodError.response = { body: { ok: false, error_code: 429, parameters: { retry_after: 0.1 } } };
    botInstances.set("bot1", {
      sendMessage: async (chatId: number, text: string) => {
        calls += 1;
        if (calls === 1) throw floodError;
        sentMessages.push({ chatId, text });
      },
    } as any);

    const result = await request(app)
      .post("/api/broadcasts/send")
      .send({ segmentKey: "all", text: "Привет, {name}", funnelId: "f1", confirmText: "ОТПРАВИТЬ 1" })
      .expect(200);

    expect(calls).toBe(2);
    expect(result.body.result).toMatchObject({ sent: 1, failed: 0 });
    expect(sentMessages).toEqual([{ chatId: 42, text: "Привет, Test" }]);
  });

  it("deletes a subscriber and removes funnel membership", async () => {
    const { app, activeFunnels, globalSubscribers } = createCriticalApiHarness(false);
    expect(globalSubscribers.has(42)).toBe(true);
    expect(activeFunnels.get("f1").subscriberIds).toContain(42);

    await request(app).delete("/api/subscribers/42").expect(200);

    expect(globalSubscribers.has(42)).toBe(false);
    expect(activeFunnels.get("f1").subscriberIds).not.toContain(42);

    const list = await request(app).get("/api/subscribers").expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("returns the latest contact message and how many client messages need a reply", async () => {
    const { app, messageHistory } = createCriticalApiHarness(false);
    messageHistory.set("42", [
      { id: "m1", from: "bot", text: "Здравствуйте", timestamp: "2026-07-23T10:00:00.000Z" },
      { id: "m2", from: "user", text: "Покажу фото", timestamp: "2026-07-23T10:01:00.000Z" },
      {
        id: "m3",
        from: "user",
        text: "",
        timestamp: "2026-07-23T10:02:00.000Z",
        media: { type: "photo", fileId: "telegram-photo", botId: "bot1" },
      },
    ]);

    const result = await request(app).get("/api/subscribers").expect(200);

    expect(result.body[0].pendingReplyCount).toBe(2);
    expect(result.body[0].lastMessage).toMatchObject({
      id: "m3",
      from: "user",
      media: { type: "photo", fileId: "telegram-photo", botId: "bot1" },
    });
  });

  it("returns 404 when deleting an unknown subscriber", async () => {
    const { app } = createCriticalApiHarness(false);
    await request(app).delete("/api/subscribers/999").expect(404);
  });

  it("bulk-deletes only existing subscribers", async () => {
    const { app, globalSubscribers } = createCriticalApiHarness(false);

    const res = await request(app)
      .post("/api/subscribers/delete")
      .send({ ids: [42, 999] })
      .expect(200);

    expect(res.body).toMatchObject({ success: true, deleted: 1 });
    expect(globalSubscribers.has(42)).toBe(false);
  });

  it("сужает сегмент отбором по ответам и источнику", async () => {
    const { app, progress, sentMessages } = createCriticalApiHarness(false, {
      subscribers: [{ id: 43, firstName: "Второй" }],
    });

    // Оба в одном сегменте, но пришли по разным объявлениям и хотят разного.
    const first = progress.ensureUserState(42, "f1");
    first.currentStageId = "s1";
    first.profile = {
      answers: { goal: { questionId: "q1", optionId: "o1", label: "Себе", at: new Date().toISOString() } },
      source: { value: "ad_vk_01", at: new Date().toISOString() },
    };

    const second = progress.ensureUserState(43, "f1");
    second.currentStageId = "s1";
    second.profile = {
      answers: { goal: { questionId: "q1", optionId: "o2", label: "На заказ", at: new Date().toISOString() } },
      source: { value: "ad_tg_02", at: new Date().toISOString() },
    };

    const withoutFilter = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", funnelId: "f1", text: "Привет" })
      .expect(200);
    expect(withoutFilter.body.ready).toBe(2);

    const byAnswer = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", funnelId: "f1", text: "Привет", filter: { answers: { goal: ["o2"] } } })
      .expect(200);
    expect(byAnswer.body.ready).toBe(1);
    expect(byAnswer.body.recipients[0].id).toBe(43);

    const bySource = await request(app)
      .post("/api/broadcasts/preview")
      .send({ segmentKey: "all", funnelId: "f1", text: "Привет", filter: { sources: ["ad_vk_01"] } })
      .expect(200);
    expect(bySource.body.ready).toBe(1);
    expect(bySource.body.recipients[0].id).toBe(42);

    // Условия складываются: такого человека в аудитории нет.
    const impossible = await request(app)
      .post("/api/broadcasts/preview")
      .send({
        segmentKey: "all",
        funnelId: "f1",
        text: "Привет",
        filter: { answers: { goal: ["o2"] }, sources: ["ad_vk_01"] },
      })
      .expect(200);
    expect(impossible.body.ready).toBe(0);

    // Отправка отбирает ровно тех же, а не весь сегмент.
    await request(app)
      .post("/api/broadcasts/send")
      .send({
        segmentKey: "all",
        funnelId: "f1",
        text: "Только своим",
        filter: { sources: ["ad_vk_01"] },
        confirmText: "ОТПРАВИТЬ 1",
      })
      .expect(200);

    expect(sentMessages).toEqual([{ chatId: 42, text: "Только своим" }]);
  });

  it("собирает условия отбора из вопросов воронки и встреченных меток", async () => {
    const { app, progress } = createCriticalApiHarness(false);
    const state = progress.ensureUserState(42, "f1");
    state.profile = { answers: {}, source: { value: "ad_vk_01", at: new Date().toISOString() } };

    const options = await request(app)
      .get("/api/audience/filter-options?funnelId=f1")
      .expect(200);

    expect(options.body.sources).toEqual([{ value: "ad_vk_01", count: 1 }]);
    expect(Array.isArray(options.body.answers)).toBe(true);
  });
});
