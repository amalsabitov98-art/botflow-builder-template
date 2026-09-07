import express from "express";
import type { BotEntry, Settings } from "../types";

interface SettingsRoutesContext {
  // Ключ ассистента хранится только в переменных окружения, поэтому наружу
  // отдаём лишь факт настройки — не значение.
  isAssistantConfigured?: () => boolean;
  getSettings: () => Settings;
  getRunningBotIds: () => Set<string>;
  initLavaClientAndWebhook: () => void;
  saveSettings: () => Promise<void>;
  startBotInstance: (entry: BotEntry) => Promise<void>;
  stopBotById: (botId: string) => void;
  verifyBotToken: (token: string) => Promise<{ ok: boolean; username?: string; firstName?: string }>;
  isProduction?: boolean;
  canonicalAppUrl?: string;
}

function maskSecret(value?: string) {
  if (!value) return "";
  return value.length > 10
    ? `${value.slice(0, 4)}••••••••${value.slice(-4)}`
    : "••••";
}

function isMaskedSecret(value: unknown) {
  return typeof value === "string" && value.includes("••");
}

function storageFailure(res: express.Response, operation: string, error: unknown) {
  console.error(`Failed to ${operation}:`, error);
  return res.status(503).json({ error: "Не удалось сохранить изменения. Попробуйте ещё раз." });
}

export function registerSettingsRoutes(app: express.Express, ctx: SettingsRoutesContext) {
  app.get("/api/settings", (_req, res) => {
    const settings = ctx.getSettings();
    const runningBotIds = ctx.getRunningBotIds();
    const masked = {
      ...settings,
      bots: settings.bots.map((b) => ({
        ...b,
        token: maskSecret(b.token),
        active: runningBotIds.has(b.id),
      })),
      deepseekApiKey: maskSecret(settings.deepseekApiKey),
      geminiApiKey: maskSecret(settings.geminiApiKey),
      xaiApiKey: maskSecret(settings.xaiApiKey),
      lavaApiKey: maskSecret(settings.lavaApiKey),
      lavaWebhookSecret: maskSecret(settings.lavaWebhookSecret),
      assistantConfigured: ctx.isAssistantConfigured?.() ?? false,
    };
    res.json(masked);

  });

  app.post("/api/settings/bots", async (req, res) => {
    const { token } = req.body;
    const settings = ctx.getSettings();
    if (!token) return res.status(400).json({ error: "Missing token" });

    if (settings.bots.some((b) => b.token === token)) {
      return res.status(409).json({ error: "Этот бот уже добавлен" });
    }

    if (settings.bots.length >= 10) {
      return res.status(400).json({ error: "Максимум 10 ботов" });
    }

    const verify = await ctx.verifyBotToken(token);
    if (!verify.ok) {
      return res.status(400).json({ error: "Неверный токен. Проверьте и попробуйте снова." });
    }

    const newBot: BotEntry = {
      id: `bot-${Date.now()}`,
      token,
      name: verify.username || "unknown",
      firstName: verify.firstName || "Бот",
      active: false,
      addedAt: new Date().toISOString(),
    };

    settings.bots.push(newBot);
    try {
      await ctx.saveSettings();
    } catch (error) {
      settings.bots = settings.bots.filter((bot) => bot.id !== newBot.id);
      return storageFailure(res, "save Telegram bot", error);
    }

    try {
      await ctx.startBotInstance(newBot);
    } catch (error) {
      console.error("Failed to start newly added Telegram bot:", error);
      return res.status(502).json({ error: "Бот сохранён, но Telegram webhook/polling не запустился" });
    }

    res.json({
      success: true,
      bot: {
        id: newBot.id,
        name: newBot.name,
        firstName: newBot.firstName,
        active: true,
        addedAt: newBot.addedAt,
        token: token.slice(0, 4) + "••••••••" + token.slice(-4),
      },
    });
  });

  app.delete("/api/settings/bots/:botId", async (req, res) => {
    const { botId } = req.params;
    const settings = ctx.getSettings();
    const previousBots = settings.bots;
    settings.bots = settings.bots.filter((b) => b.id !== botId);
    try {
      await ctx.saveSettings();
    } catch (error) {
      settings.bots = previousBots;
      return storageFailure(res, "remove Telegram bot", error);
    }
    ctx.stopBotById(botId);
    res.json({ success: true });
  });

  app.post("/api/settings", async (req, res) => {
    const settings = ctx.getSettings();
    const { deepseekApiKey, geminiApiKey, xaiApiKey, appUrl, notifications, autoReminders, lavaApiKey, lavaWebhookSecret, adminTelegramChatId, expertTelegramUsername } = req.body;
    const previous = {
      deepseekApiKey: settings.deepseekApiKey,
      geminiApiKey: settings.geminiApiKey,
      xaiApiKey: settings.xaiApiKey,
      appUrl: settings.appUrl,
      notifications: settings.notifications,
      autoReminders: settings.autoReminders,
      lavaApiKey: settings.lavaApiKey,
      lavaWebhookSecret: settings.lavaWebhookSecret,
      adminTelegramChatId: settings.adminTelegramChatId,
      expertTelegramUsername: settings.expertTelegramUsername,
    };

    if (adminTelegramChatId !== undefined) {
      settings.adminTelegramChatId = typeof adminTelegramChatId === "string" ? adminTelegramChatId.trim() : "";
    }
    if (expertTelegramUsername !== undefined) {
      settings.expertTelegramUsername = typeof expertTelegramUsername === "string" ? expertTelegramUsername.trim().replace(/^@/, "") : "";
    }

    if (geminiApiKey !== undefined && !isMaskedSecret(geminiApiKey)) {
      settings.geminiApiKey = geminiApiKey;
    }
    if (xaiApiKey !== undefined && !isMaskedSecret(xaiApiKey)) {
      settings.xaiApiKey = String(xaiApiKey).trim();
    }
    if (deepseekApiKey !== undefined && !isMaskedSecret(deepseekApiKey)) {
      settings.deepseekApiKey = String(deepseekApiKey).trim();
    }

    if (appUrl !== undefined) {
      if (typeof appUrl !== "string") {
        Object.assign(settings, previous);
        return res.status(400).json({ error: "Некорректный адрес приложения" });
      }
      try {
        const normalized = new URL(appUrl.trim()).toString().replace(/\/$/, "");
        if (ctx.isProduction && normalized !== ctx.canonicalAppUrl?.replace(/\/$/, "")) {
          Object.assign(settings, previous);
          return res.status(400).json({ error: "В production адрес задаётся переменной APP_URL" });
        }
        settings.appUrl = ctx.isProduction ? (ctx.canonicalAppUrl || normalized) : normalized;
      } catch {
        Object.assign(settings, previous);
        return res.status(400).json({ error: "Некорректный адрес приложения" });
      }
    }
    if (notifications !== undefined) {
      if (typeof notifications !== "boolean") {
        Object.assign(settings, previous);
        return res.status(400).json({ error: "Некорректное значение notifications" });
      }
      settings.notifications = notifications;
    }
    if (autoReminders !== undefined) {
      if (typeof autoReminders !== "boolean") {
        Object.assign(settings, previous);
        return res.status(400).json({ error: "Некорректное значение autoReminders" });
      }
      settings.autoReminders = autoReminders;
    }
    if (lavaApiKey !== undefined && !isMaskedSecret(lavaApiKey)) settings.lavaApiKey = lavaApiKey;
    if (lavaWebhookSecret !== undefined && !isMaskedSecret(lavaWebhookSecret)) {
      settings.lavaWebhookSecret = lavaWebhookSecret;
    }

    try {
      await ctx.saveSettings();
    } catch (error) {
      Object.assign(settings, previous);
      return storageFailure(res, "save settings", error);
    }
    ctx.initLavaClientAndWebhook();
    res.json({ success: true });
  });
}
