import express from "express";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isPlaceholder, loadServerConfig } from "./server/config";
import { createRequireAdminAuth } from "./server/services/adminAuth";
import { createAssistantService } from "./server/services/assistant";
import { createBonusService } from "./server/services/bonus";
import { createBotManager } from "./server/services/botManager";
import { createNurtureService } from "./server/services/nurture";
import { applyHttpSecurity, createAuditMiddleware } from "./server/services/httpSecurity";
import { createLavaService } from "./server/services/lava";
import { createWebAppAuth } from "./server/services/webappAuth";
import { createMediaUpload, ensureMediaDirectories } from "./server/services/media";
import { createOrdersService } from "./server/services/orders";
import { createPurchaseDeliveryService } from "./server/services/purchaseDelivery";
import { createPaymentIntentService } from "./server/services/paymentIntents";
import { createProgressService } from "./server/services/progress";
import { escapeTelegramHtml, createTelegramDeliveryService } from "./server/services/telegram";
import { createAppStorage } from "./server/storage/appStorage";
import { loadJSON, saveJSON } from "./server/storage/jsonStore";
import type { BroadcastCampaign, BroadcastRule, Funnel, MessageEntry, OrderEntry, Settings, SubscriberProfile } from "./server/types";
import { registerAudienceRoutes } from "./server/routes/audienceRoutes";
import { registerFunnelRoutes } from "./server/routes/funnelRoutes";
import { registerMediaRoutes } from "./server/routes/mediaRoutes";
import { registerPaymentRoutes } from "./server/routes/paymentRoutes";
import { registerPlatformAdminRoutes } from "./server/routes/platformAdminRoutes";
import { registerPlatformRoutes } from "./server/routes/platformRoutes";
import { registerSettingsRoutes } from "./server/routes/settingsRoutes";
import { registerTrackingRoutes } from "./server/routes/trackingRoutes";
import { registerWebAppRoutes } from "./server/routes/webappRoutes";

const config = loadServerConfig();
const isProduction = config.isProduction;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Development data is isolated from production credentials, funnels and bot tokens.
const DATA_DIR = isProduction
  ? path.join(__dirname, "data")
  : path.join(__dirname, "data", "development");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const MEDIA_DIR = path.join(DATA_DIR, "media");

ensureMediaDirectories(DATA_DIR, IMAGES_DIR, MEDIA_DIR);
const mediaUpload = createMediaUpload(MEDIA_DIR);

// ===== Supabase Client =====
const supabaseUrl = config.supabaseUrl;
const supabaseServiceKey = config.supabaseServiceKey;

let supabase: SupabaseClient | null = null;
let useSupabase = false;

// Плейсхолдеры из .env.example не считаем настроенным Supabase — молча работаем на JSON.
if (supabaseUrl && supabaseServiceKey && !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseServiceKey)) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  useSupabase = true;
  console.log("✅ Supabase connected:", supabaseUrl);
} else {
  console.warn("⚠️ Supabase not configured, falling back to JSON files");
}
const requireAdminAuth = createRequireAdminAuth({
  adminEmail: config.adminEmail,
  allowDevBypass: config.allowDevAuthBypass,
  getSupabase: () => supabase,
  isProduction,
  requireMfa: config.requireAdminMfa,
});

// ===== Legacy JSON Persistence (fallback) =====
const FUNNELS_FILE = path.join(DATA_DIR, "funnels.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const PAYMENT_INTENTS_FILE = path.join(DATA_DIR, "payment_intents.json");
const BROADCASTS_FILE = path.join(DATA_DIR, "broadcasts.json");
const PROGRESS_FILE = path.join(DATA_DIR, "user_progress.json");
const PROGRESS_STATE_ROW_ID = "__user_progress__";
const TG_CACHE_FILE = path.join(DATA_DIR, "tg_cache.json");

// In-memory data (loaded from Supabase or JSON at startup)
const activeFunnels = new Map<string, Funnel>();
const globalSubscribers = new Map<number, SubscriberProfile>();
const messageHistory = new Map<string, MessageEntry[]>();
const orders: OrderEntry[] = [];
const broadcastCampaigns: BroadcastCampaign[] = [];
const broadcastRules: BroadcastRule[] = [];
const defaultSettings: Settings = {
  bots: [],
  geminiApiKey: config.geminiApiKey,
  appUrl: config.appUrl,
  notifications: true,
  autoReminders: true,
  lavaApiKey: config.lavaApiKey,
  lavaWebhookSecret: config.lavaWebhookSecret,
  deepseekApiKey: config.assistantApiKey,
  adminTelegramChatId: config.adminTelegramChatId || "",
};


const progressService = createProgressService({
  activeFunnels,
  getSupabase: () => supabase,
  getUseSupabase: () => useSupabase,
  progressFile: PROGRESS_FILE,
  progressStateRowId: PROGRESS_STATE_ROW_ID,
});
const {
  buildFunnelStageAnalytics,
  deleteUserState,
  ensureUserState,
  getUserState,
  getUserStatesForChat,
  loadProgressFromSupabase,
  loadProgressSnapshot,
  persistUserState,
  recordUserEvent,
  saveHomeworkSubmission,
  shouldSendReminder,
  updateHomeworkStatus,
  userStates,
} = progressService;


let adminNotifier: ((message: string) => Promise<void>) | null = null;

const ordersService = createOrdersService({
  ensureUserState,
  getSupabase: () => supabase,
  getUseSupabase: () => useSupabase,
  orders,
  ordersFile: ORDERS_FILE,
  persistUserState,
  notifyAdmin: (msg) => (adminNotifier ? adminNotifier(msg) : Promise.resolve()),
});

const {
  addOrder,
  loadOrdersFromSupabase,
  loadOrdersSnapshot,
} = ordersService;

const paymentIntentService = createPaymentIntentService({
  getSupabase: () => supabase,
  getUseSupabase: () => useSupabase,
  paymentIntentsFile: PAYMENT_INTENTS_FILE,
});
const { getPaymentIntent, savePaymentIntent } = paymentIntentService;

const appStorage = createAppStorage({
  activeFunnels,
  defaultSettings,
  files: {
    funnels: FUNNELS_FILE,
    messages: MESSAGES_FILE,
    orders: ORDERS_FILE,
    progress: PROGRESS_FILE,
    settings: SETTINGS_FILE,
    subscribers: SUBSCRIBERS_FILE,
    tgCache: TG_CACHE_FILE,
  },
  getSupabase: () => supabase,
  getUseSupabase: () => useSupabase,
  isProduction,
  globalSubscribers,
  loadOrdersFromSupabase,
  loadOrdersSnapshot,
  loadProgressFromSupabase,
  loadProgressSnapshot,
  messageHistory,
  ordersCount: () => orders.length,
  progressStateRowId: PROGRESS_STATE_ROW_ID,
  secretValues: {
    deepseekApiKey: config.assistantApiKey,
    geminiApiKey: config.geminiApiKey,
    lavaApiKey: config.lavaApiKey,
    lavaWebhookSecret: config.lavaWebhookSecret,
    telegramBotToken: config.telegramBotToken,
  },
  setUseSupabase: (value) => { useSupabase = value; },
});
const {
  deleteFunnel,
  deleteSubscriber,
  getSettings,
  getTgCache,
  loadInitialData,
  logMessage,
  refreshAudienceData,
  saveFunnel,
  saveSettings,
  saveSubscriber,
  saveTgCache,
} = appStorage;
const settings = getSettings();

const webAppAuth = createWebAppAuth({
  activeFunnels,
  getSettings: () => settings,
  getIsProduction: () => isProduction,
  getWebAppSigningSecret: () => config.webAppSigningSecret,
});
const { getRequestAuthValue, validateTelegramWebAppAuth, validateWebAppActionAuth } = webAppAuth;

function getWebAppUrl(funnelId: string, stageId: string, chatId?: number): string {
  return webAppAuth.getWebAppUrl(settings.appUrl, funnelId, stageId, chatId);
}

function shouldHydrateSecret(value?: string) {
  return !value || value.startsWith("__ENV_") || value.includes("••");
}

function hydrateRuntimeSecretsFromEnv() {
  if (config.geminiApiKey && shouldHydrateSecret(settings.geminiApiKey)) {
    settings.geminiApiKey = config.geminiApiKey;
  }
  if (config.lavaApiKey && shouldHydrateSecret(settings.lavaApiKey)) {
    settings.lavaApiKey = config.lavaApiKey;
  }
  if (config.lavaWebhookSecret && shouldHydrateSecret(settings.lavaWebhookSecret)) {
    settings.lavaWebhookSecret = config.lavaWebhookSecret;
  }
  if (config.assistantApiKey && shouldHydrateSecret(settings.deepseekApiKey)) {
    settings.deepseekApiKey = config.assistantApiKey;
  }

  if (config.telegramBotToken) {
    if (settings.bots.length === 0) {
      settings.bots.push({
        id: "bot-env-default",
        token: config.telegramBotToken,
        name: "env_telegram_bot",
        firstName: "Telegram Bot",
        active: false,
        addedAt: new Date().toISOString(),
      });
    } else {
      for (const bot of settings.bots) {
        if (shouldHydrateSecret(bot.token)) {
          bot.token = config.telegramBotToken;
        }
      }
    }
  }
}

const BROADCASTS_ROW_ID = "__broadcasts__";

function applyBroadcastsSnapshot(data: any) {
  broadcastCampaigns.splice(0, broadcastCampaigns.length, ...((Array.isArray(data?.campaigns) ? data.campaigns : []) as BroadcastCampaign[]));
  broadcastRules.splice(0, broadcastRules.length, ...((Array.isArray(data?.rules) ? data.rules : []) as BroadcastRule[]));
}

async function loadBroadcasts() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from("funnels")
        .select("data")
        .eq("id", BROADCASTS_ROW_ID)
        .maybeSingle();
      if (error) throw error;
      applyBroadcastsSnapshot(data?.data || { campaigns: [], rules: [] });
      console.log(`📥 Loaded broadcasts from Supabase: ${broadcastCampaigns.length} campaigns, ${broadcastRules.length} rules`);
      return;
    } catch (e: any) {
      if (isProduction) {
        throw new Error(`Failed to load broadcasts from Supabase: ${e?.message || e}`);
      }
      console.warn("⚠️ Failed to load broadcasts from Supabase, falling back to JSON:", e?.message || e);
    }
  }
  applyBroadcastsSnapshot(loadJSON(BROADCASTS_FILE, { campaigns: [], rules: [] }));
}

async function saveBroadcasts() {
  const snapshot = {
    campaigns: broadcastCampaigns.slice(0, 200),
    rules: broadcastRules,
  };
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("funnels").upsert({
        id: BROADCASTS_ROW_ID,
        data: snapshot,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw error;
      return;
    } catch (e: any) {
      if (isProduction) {
        throw new Error(`Failed to save broadcasts to Supabase: ${e?.message || e}`);
      }
      console.error("❌ Failed to save broadcasts to Supabase, falling back to JSON:", e?.message || e);
    }
  }
  saveJSON(BROADCASTS_FILE, snapshot);
}

// Webhook-режим Telegram: production за HTTPS. Секрет проверяется в заголовке
// X-Telegram-Bot-Api-Secret-Token, выводится из WEBAPP_SIGNING_SECRET.
const telegramWebhookSecret = crypto
  .createHmac("sha256", config.webAppSigningSecret || "dev-secret")
  .update("telegram-webhook")
  .digest("hex");

function getTelegramWebhook() {
  if (!isProduction) return null;
  const baseUrl = (settings.appUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl.startsWith("https://")) return null;
  return { baseUrl, secret: telegramWebhookSecret };
}

const telegramDelivery = createTelegramDeliveryService({
  activeFunnels,
  dataDir: DATA_DIR,
  mediaDir: MEDIA_DIR,
  globalSubscribers,
  getSettings: () => settings,
  getSupabase: () => supabase,
  getTgCache,
  getWebAppUrl,
  logMessage,
  saveTgCache,
});
const { buildInlineKeyboard, deliverStageMessage, resolvePrivateMediaUrl } = telegramDelivery;

const bonusService = createBonusService({ activeFunnels });

// Ассистент создаётся после botManager (ему нужен sendStageMessage), а botManager
// зовёт ассистента на входящих сообщениях — поэтому связываем их через ссылку.
let assistantHandler: ((bot: any, chatId: number, text: string, funnel: Funnel) => Promise<boolean>) | null = null;
let reminderPersonalizer: ((funnel: Funnel, chatId: number, template: string) => Promise<string>) | null = null;

const botManager = createBotManager({
  activeFunnels,
  buildInlineKeyboard,
  deliverStageMessage,
  ensureUserState,
  getUserState,
  getSettings: () => settings,
  getAssistantApiKey: () => settings.deepseekApiKey || config.assistantApiKey,
  // Ключ из админки перекрывает переменную окружения — как и у остальных сервисов.
  getTranscriptionKeys: () => ({
    xaiApiKey: settings.xaiApiKey || config.xaiApiKey,
    geminiApiKey: settings.geminiApiKey || config.geminiApiKey,
    groqApiKey: config.groqApiKey,
    openaiApiKey: config.openaiApiKey,
  }),
  getTelegramWebhook,
  getWebAppUrl,
  awardQuestionBonus: (state, funnelId, questionKey) => {
    bonusService.awardForQuestion(state, funnelId, questionKey);
  },
  globalSubscribers,
  handleIncomingUserMessage: (bot, chatId, text, funnel) => (
    assistantHandler ? assistantHandler(bot, chatId, text, funnel) : Promise.resolve(false)
  ),
  personalizeReminderText: (funnel, chatId, template) => (
    reminderPersonalizer ? reminderPersonalizer(funnel, chatId, template) : Promise.resolve(template)
  ),
  logMessage,
  persistUserState,
  recordUserEvent,
  saveFunnel,
  saveHomeworkSubmission,
  saveSettings,
  saveSubscriber,
  shouldSendReminder,
  updateHomeworkStatus,
  userStates,
});

const {
  botInstances,
  cancelStageReminders,
  notifyAdmin,
  resumePendingReminders,
  sendStageMessage,
  schedulePaymentReminders,
  startBotInstance,
  stopAllBots,
  stopBotById,
  verifyBotToken,
} = botManager;
adminNotifier = notifyAdmin;

const assistantService = createAssistantService({
  activeFunnels,
  getApiKey: () => settings.deepseekApiKey || config.assistantApiKey,
  getUserState,
  getWebAppUrl,
  globalSubscribers,
  logMessage,
  messageHistory,
  persistUserState,
  saveSubscriber,
  sendStageMessage,
  notifyAdmin: (msg) => (adminNotifier ? adminNotifier(msg) : Promise.resolve()),
});

assistantHandler = assistantService.handleIncomingMessage;
reminderPersonalizer = assistantService.personalizeReminder;

// Длинный дожим: раз в 15 минут проверяем, кому пора написать. Все жёсткие
// пределы — внутри сервиса, здесь только расписание.
const nurtureService = createNurtureService({
  activeFunnels,
  botInstances,
  globalSubscribers,
  logMessage,
  messageHistory,
  persistUserState,
  planNurtureTouch: assistantService.planNurtureTouch,
  userStates,
});
let nurtureRunning = false;
let nurtureInterval: NodeJS.Timeout | null = null;
function startNurtureScheduler() {
  if (nurtureInterval) return;
  nurtureInterval = setInterval(() => {
    if (nurtureRunning) return;
    nurtureRunning = true;
    nurtureService.tick()
      .catch((error) => console.error("[NURTURE] tick failed:", error))
      .finally(() => { nurtureRunning = false; });
  }, 15 * 60 * 1000);
  nurtureInterval.unref?.();
}

// Unified post-purchase delivery: grants access to the gated platform WebApp inside Telegram.
// The durable outbox retries this sender until Telegram accepts the message.
async function deliverPurchaseAccess(order: OrderEntry): Promise<void> {
  if (!order.chatId) throw new Error("Purchase has no chatId");

  const funnels = Array.from(activeFunnels.values());
  const funnel = (order.funnelId && activeFunnels.get(order.funnelId))
    || funnels.find((f) => f.subscriberIds?.includes(order.chatId) && f.connectedBotId);
  if (!funnel?.connectedBotId) {
    throw new Error("Purchase bot is not configured");
  }

  const bot = botInstances.get(funnel.connectedBotId);
  if (!bot) {
    throw new Error("Purchase bot is not running");
  }

  const platformUrl = getWebAppUrl(funnel.id, "platform", order.chatId);
  const text = `🎉 <b>Оплата получена!</b>\n\nТы приобрёл <b>${escapeTelegramHtml(order.product)}</b>. Доступ к платформе с материалами открыт — жми кнопку ниже.`;
  await bot.sendMessage(order.chatId, text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "🚀 Открыть платформу", web_app: { url: platformUrl } }]] },
  });
  // A history-write failure must not resend a successfully delivered message.
  await logMessage(order.chatId, "bot", text, undefined, {
    botId: funnel.connectedBotId, funnelId: funnel.id,
  }).catch(() => console.warn(`[ACCESS] Could not log notification for order ${order.id}`));
}

const purchaseDelivery = createPurchaseDeliveryService({
  getOrders: () => orders,
  saveDelivery: ordersService.saveAccessDelivery,
  send: deliverPurchaseAccess,
});

const lavaService = createLavaService({
  activeFunnels,
  addOrder,
  deliverAccess: purchaseDelivery.deliver,
  getPaymentIntent,
  globalSubscribers,
  getSettings: () => settings,
});
const {
  getLavaClient,
  handleWebhook: handleLavaWebhook,
  initLavaClientAndWebhook,
  isWebhookConfigured: isLavaWebhookConfigured,
} = lavaService;

// ===== Express =====
async function startServer() {
  await loadInitialData();
  hydrateRuntimeSecretsFromEnv();
  await loadBroadcasts();

  initLavaClientAndWebhook();

  const app = express();
  const PORT = config.port;

  applyHttpSecurity(app, isProduction);
  app.use(express.json({
    limit: "2mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf-8");
    }
  }));
  app.use(createAuditMiddleware(DATA_DIR, () => supabase));
  app.use(requireAdminAuth);

  app.get("/api/health", async (_req, res) => {
    if (useSupabase && supabase) {
      const { error } = await supabase.from("settings").select("id").limit(1);
      if (error) {
        console.error("Health check Supabase probe failed:", error.message);
        return res.status(503).json({ status: "unavailable", storage: "supabase", error: "storage_unavailable" });
      }
    }
    res.json({
      status: "ok",
      activeBots: botInstances.size,
      configuredBots: settings.bots.length,
      storage: useSupabase ? "supabase" : "json",
    });
  });

  // Обновления от Telegram в webhook-режиме. Публичный endpoint, защищён секретом.
  app.post("/api/webhook/telegram/:botId", (req, res) => {
    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
    if (secretHeader !== telegramWebhookSecret) {
      return res.sendStatus(403);
    }
    const bot = botInstances.get(req.params.botId);
    // Отвечаем 200 даже без бота: иначе Telegram будет бесконечно ретраить старые апдейты.
    if (bot) bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  app.post("/api/webhook/lava", async (req: any, res) => {
    if (!isLavaWebhookConfigured()) {
      return res.status(503).json({ error: "Lava webhook is not configured" });
    }

    const signature = req.headers["x-api-key"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).json({ error: "Missing signature header" });
    }

    try {
      await handleLavaWebhook(signature, req.rawBody || JSON.stringify(req.body || {}));
      res.json({ success: true });
    } catch (e) {
      console.error("Lava webhook error:", e);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  registerMediaRoutes(app, {
    getFunnels: () => Array.from(activeFunnels.values()),
    imagesDir: IMAGES_DIR,
    mediaDir: MEDIA_DIR,
    mediaUpload,
    getSupabase: () => supabase,
    getTgCache,
    getUseSupabase: () => useSupabase,
    isProduction,
  });

  registerFunnelRoutes(app, {
    activeFunnels,
    buildFunnelStageAnalytics,
    deleteFunnel,
    getWebAppUrl,
    recordUserEvent,
    saveFunnel,
    saveSubscriber,
  });

  const audienceLifecycle = registerAudienceRoutes(app, {
    activeFunnels,
    broadcastCampaigns,
    broadcastRules,
    botInstances,
    globalSubscribers,
    getSettings: () => settings,
    messageHistory,
    orders,
    userStates,
    getUserState,
    getUserStatesForChat,
    refreshAudienceData,
    resolvePrivateMediaUrl,
    logMessage,
    saveBroadcasts,
    saveFunnel,
    saveSubscriber,
    deleteSubscriber,
    deleteUserState,
    deferBackgroundStart: true,
  });

  registerSettingsRoutes(app, {
    isAssistantConfigured: () => Boolean(settings.deepseekApiKey || config.assistantApiKey),
    getSettings: () => settings,
    getRunningBotIds: () => new Set(botInstances.keys()),
    initLavaClientAndWebhook,
    saveSettings,
    startBotInstance,
    // Явная остановка бота из админки снимает и webhook в Telegram.
    stopBotById: (botId: string) => stopBotById(botId, { dropWebhook: true }),
    verifyBotToken,
    isProduction,
    canonicalAppUrl: config.appUrl,
  });
  registerTrackingRoutes(app, {
    activeFunnels,
    botInstances,
    cancelStageReminders,
    recordUserEvent,
    schedulePaymentReminders,
    sendStageMessage,
    validateWebAppActionAuth,
    getBotUsername: (botId) => settings.bots.find((bot) => bot.id === botId)?.name,
  });

  registerPaymentRoutes(app, {
    activeFunnels,
    botInstances,
    deliverAccess: purchaseDelivery.deliver,
    globalSubscribers,
    isProduction,
    getLavaClient,
    getRequestAuthValue,
    getSettings: () => settings,
    addOrder,
    savePaymentIntent,
    validateWebAppActionAuth,
  });

  registerPlatformRoutes(app, {
    activeFunnels,
    bonus: bonusService,
    orders,
    ensureUserState,
    persistUserState,
    validateTelegramWebAppAuth,
  });

  registerPlatformAdminRoutes(app, {
    activeFunnels,
    botInstances,
    globalSubscribers,
    orders,
    userStates,
    sendStageMessage,
    updateHomeworkStatus,
  });

  // ===== Image Generation and Web App serving =====
  registerWebAppRoutes(app, {
    activeFunnels,
    getUserState,
    userStates,
    validateWebAppActionAuth,
    getSettings: () => settings,
  });


  // ===== Vite / Static =====
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    // Content-hashed assets (JS/CSS/fonts) are immutable — cache aggressively.
    app.use(
      "/assets",
      express.static(path.join(__dirname, "dist", "assets"), {
        maxAge: "1y",
        immutable: true,
      }),
    );
    // Everything else must revalidate. Keep index.html out of express.static so
    // the SPA shell never gets served as a stale 304 after Railway deploys.
    app.use(express.static("dist", { maxAge: 0, index: false }));
    // SPA fallback — never cache the HTML shell so deploys are picked up.
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Рассылки, напоминания и планировщик живут в памяти этого процесса: второй
  // инстанс продублирует отправку. Ограничение осознанное — см. README,
  // раздел «Ограничения масштабирования».
  const replicaCount = Math.max(
    ...["WEB_CONCURRENCY", "NUM_REPLICAS", "RAILWAY_REPLICA_COUNT"]
      .map((name) => Number(process.env[name]))
      .filter((value) => Number.isFinite(value) && value > 0),
    1,
  );

  const httpServer = app.listen(PORT, config.host, () => {
    console.log(`🚀 Server running on http://${config.host}:${PORT}`);
    console.log(`📦 Storage: ${useSupabase ? 'Supabase' : 'JSON files'}`);
    if (replicaCount > 1) {
      console.error(
        `❌ Обнаружено реплик: ${replicaCount}. Приложение рассчитано на один инстанс: `
        + "рассылки и напоминания будут отправлены повторно каждой репликой. "
        + "Оставьте одну реплику.",
      );
    }
    if (config.allowDevAuthBypass) {
      console.warn("⚠️ ALLOW_DEV_AUTH_BYPASS is explicitly enabled for this loopback development server");
    }
  });

  // Start all saved bots
  for (const botEntry of settings.bots) {
    try {
      await startBotInstance(botEntry);
    } catch {
      // Ошибка уже записана менеджером; остальные боты всё равно запускаем.
    }
  }
  resumePendingReminders();
  await audienceLifecycle.startBackgroundTasks();
  startNurtureScheduler();
  purchaseDelivery.start();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SHUTDOWN] ${signal}: завершаем текущие HTTP-запросы`);
    audienceLifecycle.stopBackgroundTasks();
    if (nurtureInterval) clearInterval(nurtureInterval);
    nurtureInterval = null;
    void purchaseDelivery.stop();
    stopAllBots();

    const forceExit = setTimeout(() => {
      console.error("[SHUTDOWN] Не удалось завершить сервер за 10 секунд");
      process.exit(1);
    }, 10_000);
    forceExit.unref?.();
    httpServer.close((error) => {
      clearTimeout(forceExit);
      if (error) {
        console.error("[SHUTDOWN] HTTP server close failed:", error);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exitCode = 1;
});
