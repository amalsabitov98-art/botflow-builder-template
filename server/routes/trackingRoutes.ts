import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { WEBAPP_ACTION_EVENTS } from "../services/webappAuth";
import { isTelegramMiniAppFunnel } from "../services/telegram";
import type { RecordUserEventResult } from "../services/progress";
import type { Funnel, FunnelStage } from "../types";

interface TrackingRoutesContext {
  activeFunnels: Map<string, Funnel>;
  botInstances: Map<string, TelegramBot>;
  cancelStageReminders: (chatId: number, funnelId: string, stageId: string) => void;
  recordUserEvent: (chatId: number, event: string, funnelId: string, stageId?: string) => RecordUserEventResult;
  schedulePaymentReminders: (bot: TelegramBot, chatId: number, funnelId: string, stage: FunnelStage) => void;
  sendStageMessage: (bot: TelegramBot, chatId: number, funnel: Funnel, stage: FunnelStage) => Promise<void>;
  validateWebAppActionAuth: (req: express.Request, funnelId: string, stageId: string, chatId: number) => boolean;
  getBotUsername?: (botId: string) => string | undefined;
}

export function registerTrackingRoutes(app: express.Express, ctx: TrackingRoutesContext) {
  app.post("/api/track", async (req, res) => {
    const { chatId, event, funnelId, stageId } = req.body;
    if (!chatId) return res.status(400).json({ error: "Missing chatId" });
    if (!event || !funnelId) return res.status(400).json({ error: "Missing event or funnelId" });
    if (typeof event !== "string" || !WEBAPP_ACTION_EVENTS.has(event)) {
      return res.status(400).json({ error: "Invalid tracking event" });
    }
    if (typeof funnelId !== "string" || (stageId !== undefined && typeof stageId !== "string")) {
      return res.status(400).json({ error: "Invalid funnel or stage id" });
    }

    const numericChatId = Number(chatId);
    if (!Number.isSafeInteger(numericChatId) || numericChatId <= 0) {
      return res.status(400).json({ error: "Invalid chatId" });
    }
    if (numericChatId === 123) {
      return res.json({ success: true, ignored: true });
    }

    const authStageId = stageId || "intro";
    if (!ctx.validateWebAppActionAuth(req, funnelId, authStageId, numericChatId)) {
      return res.status(401).json({ error: "Invalid WebApp authentication" });
    }

    const { alreadyRecorded, state } = ctx.recordUserEvent(numericChatId, event, funnelId, stageId);
    const funnel = ctx.activeFunnels.get(funnelId);
    const botUsername = funnel?.connectedBotId ? ctx.getBotUsername?.(funnel.connectedBotId) : undefined;
    const telegramReturn = botUsername
      ? { botUsername, botUrl: `https://t.me/${botUsername}` }
      : {};

    if (alreadyRecorded) {
      return res.json({ success: true, duplicate: true, ...telegramReturn });
    }

    if ((event === "offer_viewed" || event === "checkout_started") && stageId && funnel) {
      const stage = funnel.stages?.find((s: any) => s.id === stageId);
      const botId = funnel.connectedBotId;
      const bot = botId ? ctx.botInstances.get(botId) : null;
      if (stage && bot) {
        ctx.schedulePaymentReminders(bot, numericChatId, funnelId, stage);
      }
    }

    let nextStageQueued = false;
    if (event === "stage_completed") {
      console.log(`[TRACK] Stage completed for chatId ${chatId}, funnel ${funnelId}, stage ${stageId}`);
      if (state) {
        state.timeouts.forEach((t: NodeJS.Timeout) => clearTimeout(t));
        state.timeouts = [];
      }
      if (stageId) {
        ctx.cancelStageReminders(numericChatId, funnelId, stageId);
      }

      if (funnel) {
        const currentStage = funnel.stages?.find((s: any) => s.id === stageId);
        const nextStageId = currentStage?.nextStage?.targetStageId;
        if (nextStageId) {
          const nextStage = funnel.stages?.find((s: any) => s.id === nextStageId);
          const botId = funnel.connectedBotId;
          const bot = botId ? ctx.botInstances.get(botId) : null;
          if (nextStage && bot) {
            console.log(`[TRACK] Transitioning chatId ${chatId} to next stage: ${nextStage.title} (ID: ${nextStageId})`);
            nextStageQueued = true;
            const sendNextStage = async () => {
              await ctx.sendStageMessage(bot, chatId, funnel, nextStage);
            };
            // Внутри Mini App страница закрывается сразу и человек попадает в чат:
            // сообщение должно уже лежать там, поэтому отправляем до ответа.
            // При переходе по внешней ссылке пауза читается как естественная.
            if (isTelegramMiniAppFunnel(funnel)) {
              await sendNextStage();
            } else {
              setTimeout(() => {
                void sendNextStage().catch((error) => {
                  console.error(`[TRACK] Не удалось отправить этап ${nextStageId}:`, error);
                });
              }, 1500);
            }
          }
        }
      }
    }
    res.json({ success: true, nextStageQueued, ...telegramReturn });
  });
}
