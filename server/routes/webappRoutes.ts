import express from "express";
import type { Funnel, FunnelStage } from "../types";
import { isTelegramMiniAppFunnel } from "../services/telegram";

interface WebAppRoutesContext {
  activeFunnels: Map<string, Funnel>;
  getUserState?: (chatId: number, funnelId?: string) => any;
  userStates?: Map<string, any>;
  validateWebAppActionAuth: (req: express.Request, funnelId: string, stageId: string, chatId: number) => boolean;
  getSettings?: () => any;
}


const PRIVATE_CONTENT_KEYS = /^(?:_|systemPrompt$|developerPrompt$|internalPrompt$|aiPrompt$|promptTemplate$|apiKey$|token$|secret$)/i;

function stripPrivateContent(value: any): any {
  if (Array.isArray(value)) return value.map(stripPrivateContent);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_CONTENT_KEYS.test(key))
      .map(([key, nested]) => [key, stripPrivateContent(nested)]),
  );
}

function canReadWebApp(
  req: express.Request,
  ctx: WebAppRoutesContext,
  funnelId: string,
  stageId: string,
  webApp: any,
) {
  const access = webApp?.access || "public";
  if (access === "public") return { allowed: true, chatId: null };

  const chatId = Number(req.query.chatId);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) {
    return { allowed: false, chatId: null };
  }
  if (!ctx.validateWebAppActionAuth(req, funnelId, stageId, chatId)) {
    return { allowed: false, chatId: null };
  }
  if (access === "paid") {
    const state = ctx.getUserState?.(chatId, funnelId);
    if (state?.purchaseStatus !== "paid") {
      return { allowed: false, chatId };
    }
  }
  return { allowed: true, chatId };
}

function buildProfilePayload(funnel: Funnel, state: any) {
  const stages = (funnel.stages || []).map((stage: FunnelStage, index: number) => ({
    id: stage.id,
    index,
    title: stage.title || `Этап ${index + 1}`,
  }));
  const firstStage = funnel.stages?.[0];
  const currentStage = funnel.stages?.find((stage: FunnelStage) => stage.id === state?.currentStageId) || firstStage;
  const completedStages = Array.isArray(state?.completedStages) ? state.completedStages : [];
  const openedStages = Array.isArray(state?.openedStages) ? state.openedStages : [];
  const viewedStages = Array.isArray(state?.viewedStages) ? state.viewedStages : [];
  const sentStages = Array.isArray(state?.sentStages) ? state.sentStages : [];

  const currentCompleted = currentStage?.id ? completedStages.includes(currentStage.id) : false;
  const nextStageId = currentCompleted ? currentStage?.nextStage?.targetStageId : currentStage?.id;
  const targetStageId = nextStageId || currentStage?.id || firstStage?.id || "stage-0";
  const completedCount = stages.filter((stage: any) => completedStages.includes(stage.id)).length;
  const purchaseStatus = state?.purchaseStatus || "none";

  return {
    funnelId: funnel.id,
    title: funnel.title,
    menuButtonText: funnel.introWebApp?.menuButtonText || "Мой прогресс",
    targetStageId,
    stages,
    progress: {
      currentStageId: currentStage?.id || firstStage?.id || null,
      currentStageIndex: currentStage?.index ?? 0,
      completedCount,
      totalStages: stages.length,
      percent: stages.length ? Math.round((completedCount / stages.length) * 100) : 0,
      sentStages,
      openedStages,
      viewedStages,
      completedStages,
      purchaseStatus,
      lastActionAt: state?.lastActionAt || null,
    },
  };
}

export function registerWebAppRoutes(app: express.Express, ctx: WebAppRoutesContext) {
  app.get("/api/webapp/:funnelId/intro", (req, res) => {
    const { funnelId } = req.params;
    const funnel = ctx.activeFunnels.get(funnelId);

    if (!funnel || !funnel.introWebApp) {
      return res.status(404).json({ error: "Intro WebApp not found" });
    }

    const permission = canReadWebApp(req, ctx, funnelId, "intro", funnel.introWebApp);
    if (!permission.allowed) return res.status(403).json({ error: "WebApp access denied" });

    res.json(stripPrivateContent({
      title: funnel.title,
      funnelTitle: funnel.title,
      // Оформление страниц зависит от того, открыта воронка внутри Telegram
      // или по внешней ссылке. Раньше фронтенд решал это по id воронки.
      telegramMiniApp: isTelegramMiniAppFunnel(funnel),
      ...funnel.introWebApp
    }));
  });

  app.get("/api/webapp/:funnelId/profile", (req, res) => {
    const { funnelId } = req.params;
    const chatId = Number(req.query.chatId);
    const funnel = ctx.activeFunnels.get(funnelId);

    if (!funnel) return res.status(404).json({ error: "Funnel not found" });
    if (!Number.isSafeInteger(chatId) || chatId <= 0) {
      return res.status(400).json({ error: "Valid chatId is required" });
    }
    if (!ctx.validateWebAppActionAuth(req, funnelId, "intro", chatId)) {
      return res.status(401).json({ error: "Invalid WebApp authentication" });
    }

    const rawState = ctx.getUserState?.(chatId, funnelId);
    const state = rawState?.funnelId === funnelId ? rawState : null;
    res.json(buildProfilePayload(funnel, state));
  });

  app.get("/api/webapp/:funnelId/:stageId", (req, res) => {
    const { funnelId, stageId } = req.params;
    const funnel = ctx.activeFunnels.get(funnelId);

    if (!funnel) return res.status(404).json({ error: "Funnel not found" });

    if (stageId === 'intro' && funnel.introWebApp) {
      const permission = canReadWebApp(req, ctx, funnelId, "intro", funnel.introWebApp);
      if (!permission.allowed) return res.status(403).json({ error: "WebApp access denied" });
      return res.json(stripPrivateContent({
        title: funnel.title,
        funnelTitle: funnel.title,
        telegramMiniApp: isTelegramMiniAppFunnel(funnel),
        ...funnel.introWebApp
      }));
    }

    const stage = funnel.stages.find((s: any) => s.id === stageId);
    if (!stage || !stage.webApp) return res.status(404).json({ error: "Stage WebApp not found" });
    const permission = canReadWebApp(req, ctx, funnelId, stageId, stage.webApp);
    if (!permission.allowed) return res.status(403).json({ error: "WebApp access denied" });
    const stageIndex = funnel.stages.findIndex((item: any) => item.id === stageId);
    const stageNavigation = (funnel.stages || []).map((item: any, index: number) => ({
      id: item.id,
      index,
      title: item.title || `Этап ${index + 1}`,
    }));

    const userState = (ctx.getUserState && permission.chatId)
      ? ctx.getUserState(permission.chatId, funnelId)
      : undefined;
    const homework = userState?.profile?.homeworks?.[stageId];

    res.json(stripPrivateContent({
      title: stage.title,
      funnelTitle: funnel.title,
      telegramMiniApp: isTelegramMiniAppFunnel(funnel),
      ...stage.webApp,
      stageIndex,
      stageCount: stageNavigation.length,
      stageNavigation,
      requireHomework: stage.requireHomework || false,
      homeworkCriteria: stage.homeworkCriteria,
      homeworkStatus: homework?.status || "none",
      expertTelegramUsername: ctx.getSettings?.()?.expertTelegramUsername,
    }));
  });
}

