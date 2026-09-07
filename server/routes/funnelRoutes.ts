import express from "express";
import type { Funnel, SubscriberProfile } from "../types";
import type { RecordUserEventResult } from "../services/progress";

interface FunnelRoutesContext {
  activeFunnels: Map<string, Funnel>;
  buildFunnelStageAnalytics: (funnelId: string) => any;
  deleteFunnel: (id: string) => Promise<void>;
  getWebAppUrl: (funnelId: string, stageId: string, chatId?: number) => string;
  recordUserEvent: (chatId: number, event: string, funnelId: string, stageId?: string) => RecordUserEventResult;
  saveFunnel: (id: string, data: any) => Promise<void>;
  saveSubscriber: (profile: SubscriberProfile) => Promise<void>;
}

function findBotConflict(activeFunnels: Map<string, Funnel>, funnel: Funnel) {
  if (!funnel.connectedBotId) return null;
  for (const [fid, f] of activeFunnels) {
    if (fid !== funnel.id && f.connectedBotId === funnel.connectedBotId) {
      return f;
    }
  }
  return null;
}

function storageFailure(res: express.Response, operation: string, error: unknown) {
  console.error(`Failed to ${operation}:`, error);
  return res.status(503).json({ error: "Не удалось сохранить изменения. Попробуйте ещё раз." });
}

function validateFunnel(value: unknown): string | null {
  if (!value || typeof value !== "object") return "Missing funnel body";
  const funnel = value as Partial<Funnel>;
  if (typeof funnel.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(funnel.id)) {
    return "Invalid funnel id";
  }
  if (typeof funnel.title !== "string" || !funnel.title.trim() || funnel.title.length > 200) {
    return "Missing or invalid funnel title";
  }
  if (!Array.isArray(funnel.stages) || funnel.stages.length > 100) {
    return "Stages must be an array with at most 100 items";
  }
  const stageIds = new Set<string>();
  for (const stage of funnel.stages) {
    if (!stage || typeof stage !== "object" || typeof stage.id !== "string"
      || !/^[A-Za-z0-9_-]{1,160}$/.test(stage.id) || stageIds.has(stage.id)) {
      return "Each stage must have a unique valid id";
    }
    stageIds.add(stage.id);
    if (typeof stage.title !== "string" || stage.title.length > 300) return "Invalid stage title";
    if (stage.firstMessage?.text && stage.firstMessage.text.length > 20_000) return "Stage message is too long";
  }
  return null;
}

export function registerFunnelRoutes(app: express.Express, ctx: FunnelRoutesContext) {
  app.post("/api/funnels", async (req, res) => {
    const funnel = req.body;
    const validationError = validateFunnel(funnel);
    if (validationError) return res.status(400).json({ error: validationError });

    const conflict = findBotConflict(ctx.activeFunnels, funnel);
    if (conflict) {
      return res.status(409).json({
        error: `Бот уже привязан к воронке "${conflict.title}". Сначала отключите его там.`
      });
    }

    const previous = ctx.activeFunnels.get(funnel.id);
    ctx.activeFunnels.set(funnel.id, funnel);
    try {
      await ctx.saveFunnel(funnel.id, funnel);
    } catch (error) {
      if (previous) ctx.activeFunnels.set(funnel.id, previous);
      else ctx.activeFunnels.delete(funnel.id);
      return storageFailure(res, "save funnel", error);
    }
    res.json({ success: true, id: funnel.id });
  });

  app.get("/api/funnels", (_req, res) => {
    res.json(Array.from(ctx.activeFunnels.values()));
  });

  app.get("/api/funnels/:id", (req, res) => {
    const funnel = ctx.activeFunnels.get(req.params.id);
    if (!funnel) return res.status(404).json({ error: "Funnel not found" });
    res.json(funnel);
  });

  app.get("/api/funnels/:id/analytics", (req, res) => {
    const analytics = ctx.buildFunnelStageAnalytics(req.params.id);
    if (!analytics) return res.status(404).json({ error: "Funnel not found" });
    res.json(analytics);
  });

  app.post("/api/funnels/:id/test-run", async (req, res) => {
    const funnel = ctx.activeFunnels.get(req.params.id);
    if (!funnel) return res.status(404).json({ error: "Funnel not found" });
    const firstStage = funnel.stages?.[0];
    if (!firstStage) return res.status(400).json({ error: "Funnel has no stages" });

    const chatId = Number(`900${Date.now().toString().slice(-10)}`);
    const now = new Date().toISOString();
    const firstName = "Тест";

    try {
      await ctx.saveSubscriber({
        id: chatId,
        firstName,
        lastName: "Пользователь",
        username: `test_${chatId}`,
        languageCode: "ru",
        lastActive: now,
      });

      if (!funnel.subscriberIds) funnel.subscriberIds = [];
      if (!funnel.activeSubscriberIds) funnel.activeSubscriberIds = [...funnel.subscriberIds];
      if (!funnel.subscriberIds.includes(chatId)) funnel.subscriberIds.push(chatId);
      if (!funnel.activeSubscriberIds.includes(chatId)) funnel.activeSubscriberIds.push(chatId);
      funnel.subscribers = funnel.subscriberIds.length;
      funnel.activeSubscribers = funnel.activeSubscriberIds.length;
      ctx.activeFunnels.set(funnel.id, funnel);
      await ctx.saveFunnel(funnel.id, funnel);
    } catch (error) {
      return storageFailure(res, "create funnel test run", error);
    }

    ctx.recordUserEvent(chatId, "stage_sent", funnel.id, firstStage.id);
    ctx.recordUserEvent(chatId, "test_run_created", funnel.id, firstStage.id);

    const webAppUrl = ctx.getWebAppUrl(funnel.id, firstStage.id, chatId);
    res.json({
      success: true,
      chatId,
      webAppUrl,
      subscriber: {
        id: chatId,
        firstName,
        lastName: "Пользователь",
        username: `test_${chatId}`,
      },
    });
  });

  app.delete("/api/funnels/:id", async (req, res) => {
    const id = req.params.id;
    const previous = ctx.activeFunnels.get(id);
    const deleted = ctx.activeFunnels.delete(id);
    if (deleted) {
      try {
        await ctx.deleteFunnel(id);
      } catch (error) {
        if (previous) ctx.activeFunnels.set(id, previous);
        return storageFailure(res, "delete funnel", error);
      }
    }
    res.json({ success: deleted });
  });

  app.put("/api/funnels/:id", async (req, res) => {
    const funnel = req.body;
    if (!funnel) return res.status(400).json({ error: "Missing funnel body" });
    funnel.id = req.params.id;
    const validationError = validateFunnel(funnel);
    if (validationError) return res.status(400).json({ error: validationError });

    const conflict = findBotConflict(ctx.activeFunnels, funnel);
    if (conflict) {
      return res.status(409).json({
        error: `Бот уже привязан к воронке "${conflict.title}". Сначала отключите его там.`
      });
    }

    const previous = ctx.activeFunnels.get(req.params.id);
    ctx.activeFunnels.set(req.params.id, funnel);
    try {
      await ctx.saveFunnel(funnel.id, funnel);
    } catch (error) {
      if (previous) ctx.activeFunnels.set(req.params.id, previous);
      else ctx.activeFunnels.delete(req.params.id);
      return storageFailure(res, "update funnel", error);
    }
    res.json({ success: true, funnel });
  });
}
