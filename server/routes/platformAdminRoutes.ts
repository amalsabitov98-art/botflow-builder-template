import express from "express";
import TelegramBot from "node-telegram-bot-api";
import type { Funnel, FunnelStage, OrderEntry, SubscriberProfile } from "../types";
import { getChatAccess } from "../services/access";
import { escapeTelegramHtml } from "../services/telegram";
import { parseUserStateKey, type HomeworkSubmission, type UserStageState } from "../services/progress";

interface PlatformAdminRoutesContext {
  activeFunnels: Map<string, Funnel>;
  botInstances: Map<string, TelegramBot>;
  globalSubscribers: Map<number, SubscriberProfile>;
  orders: OrderEntry[];
  userStates: Map<string, UserStageState>;
  sendStageMessage: (bot: TelegramBot, chatId: number, funnel: Funnel, stage: FunnelStage) => Promise<void>;
  updateHomeworkStatus: (
    chatId: number,
    funnelId: string,
    stageId: string,
    status: "approved" | "rejected",
    reviewerComment?: string,
  ) => Promise<{ success: boolean; state?: UserStageState; nextStageId?: string }>;
}

// Ученик, который неделю не открывал платформу, — не «отвалившийся», но повод
// написать. Порог тот же, что и в разборе домашек: неделя без действий.
const STALE_AFTER_MS = 7 * 24 * 3600 * 1000;
const MAX_REVIEW_COMMENT = 1000;

function homeworksOf(state: UserStageState | undefined): HomeworkSubmission[] {
  return Object.values(state?.profile?.homeworks || {});
}

export function registerPlatformAdminRoutes(app: express.Express, ctx: PlatformAdminRoutesContext) {
  function statesForFunnel(funnelId: string) {
    return Array.from(ctx.userStates.entries())
      .filter(([, state]) => state.funnelId === funnelId)
      .map(([key, state]) => ({ chatId: parseUserStateKey(key).chatId, state }));
  }

  function displayName(chatId: number) {
    const profile = ctx.globalSubscribers.get(chatId);
    if (!profile) return `ID ${chatId}`;
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    return name || (profile.username ? `@${profile.username}` : `ID ${chatId}`);
  }

  // Сколько уроков в программе тарифа. Пока программа не заведена, платформа
  // показывает встроенный курс — его размер серверу неизвестен, поэтому
  // «прошли всё» в этом случае не считаем и честно отдаём null.
  function lessonCountFor(funnel: Funnel | undefined, tier: "pkg-1" | "pkg-2") {
    const lessons = funnel?.platform?.lessons;
    if (!Array.isArray(lessons) || lessons.length === 0) return null;
    return lessons.filter((lesson) => tier === "pkg-2" || (lesson.minTier || "pkg-1") === "pkg-1").length;
  }

  // Кто уже внутри: без этого блока владельцу приходилось идти в аналитику
  // этапов, чтобы узнать, дошёл ли до платформы хоть один оплативший.
  app.get("/api/funnels/:id/platform-stats", (req, res) => {
    const funnelId = req.params.id;
    const funnel = ctx.activeFunnels.get(funnelId);
    if (!funnel) return res.status(404).json({ error: "Funnel not found" });

    const now = Date.now();
    const paidChatIds = new Set(
      ctx.orders
        .filter((order) => order.funnelId === funnelId && order.status === "paid")
        .map((order) => order.chatId),
    );

    const students = Array.from(paidChatIds).map((chatId) => {
      const access = getChatAccess(ctx.orders, chatId, funnelId);
      const tier = access.tier || "pkg-1";
      const state = ctx.userStates.get(`${chatId}:${funnelId}`);
      const course = state?.profile?.course;
      const completed = course?.completed?.length || 0;
      const total = lessonCountFor(funnel, tier);
      const lastActionAt = course?.updatedAt || state?.lastActionAt || null;
      const pendingHomework = homeworksOf(state)
        .filter((homework) => homework.status === "pending_review").length;

      return {
        chatId,
        name: displayName(chatId),
        tier,
        completed,
        total,
        lastActionAt,
        pendingHomework,
        stale: Boolean(lastActionAt && now - new Date(lastActionAt).getTime() > STALE_AFTER_MS),
      };
    });

    const started = students.filter((student) => student.completed > 0).length;
    const finished = students.filter((student) => student.total !== null && student.completed >= (student.total || 0)).length;
    const lessonsDone = students.reduce((acc, student) => acc + student.completed, 0);

    res.json({
      funnelId,
      paid: students.length,
      byTier: {
        "pkg-1": students.filter((student) => student.tier === "pkg-1").length,
        "pkg-2": students.filter((student) => student.tier === "pkg-2").length,
      },
      started,
      finished,
      stale: students.filter((student) => student.stale).length,
      lessonsDone,
      avgLessons: students.length ? Math.round((lessonsDone / students.length) * 10) / 10 : 0,
      pendingHomework: students.reduce((acc, student) => acc + student.pendingHomework, 0),
      students: students
        .sort((a, b) => new Date(b.lastActionAt || 0).getTime() - new Date(a.lastActionAt || 0).getTime())
        .slice(0, 50),
    });
  });

  // Домашки на проверке. Раньше их можно было принять только кнопкой в
  // Telegram у куратора: если сообщение потерялось, работа зависала навсегда.
  app.get("/api/funnels/:id/homeworks", (req, res) => {
    const funnelId = req.params.id;
    const funnel = ctx.activeFunnels.get(funnelId);
    if (!funnel) return res.status(404).json({ error: "Funnel not found" });

    const statusFilter = String(req.query.status || "pending_review");
    const items = statesForFunnel(funnelId).flatMap(({ chatId, state }) => (
      homeworksOf(state).map((homework) => ({
        chatId,
        name: displayName(chatId),
        stageId: homework.stageId,
        stageTitle: funnel.stages?.find((stage) => stage.id === homework.stageId)?.title || homework.stageId,
        content: homework.content || "",
        aiFeedback: homework.aiFeedback || "",
        status: homework.status,
        submittedAt: homework.submittedAt || null,
        reviewedAt: homework.reviewedAt || null,
        reviewerComment: homework.reviewerComment || "",
      }))
    ));

    const filtered = statusFilter === "all" ? items : items.filter((item) => item.status === statusFilter);

    res.json({
      funnelId,
      pending: items.filter((item) => item.status === "pending_review").length,
      items: filtered
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 100),
    });
  });

  // Решение куратора из админки. Делает то же, что кнопки в Telegram:
  // меняет статус, пишет ученику и открывает следующий этап.
  app.post("/api/funnels/:id/homeworks/review", async (req, res) => {
    const funnelId = req.params.id;
    const funnel = ctx.activeFunnels.get(funnelId);
    if (!funnel) return res.status(404).json({ error: "Funnel not found" });

    const chatId = Number(req.body?.chatId);
    const stageId = String(req.body?.stageId || "");
    const status = req.body?.status === "rejected" ? "rejected" : req.body?.status === "approved" ? "approved" : null;
    const comment = String(req.body?.comment || "").slice(0, MAX_REVIEW_COMMENT).trim();

    if (!Number.isSafeInteger(chatId) || chatId <= 0) return res.status(400).json({ error: "Invalid chatId" });
    if (!stageId) return res.status(400).json({ error: "Missing stageId" });
    if (!status) return res.status(400).json({ error: "Invalid status" });

    const result = await ctx.updateHomeworkStatus(chatId, funnelId, stageId, status, comment || undefined);
    if (!result.success) return res.status(404).json({ error: "Ученик не найден в этой воронке" });

    const stageTitle = funnel.stages?.find((stage) => stage.id === stageId)?.title || stageId;
    const bot = funnel.connectedBotId ? ctx.botInstances.get(funnel.connectedBotId) : null;
    let notified = false;

    if (bot) {
      try {
        const safeStageTitle = escapeTelegramHtml(stageTitle);
        const text = status === "approved"
          ? `🎉 <b>Твоё домашнее задание по уроку «${safeStageTitle}» одобрено автором!</b>\n\nСледующий урок уже открыт — приятного обучения! 🚀`
          : `По домашнему заданию к уроку «${safeStageTitle}» требуется доработка ✍️${comment ? `\n\n${escapeTelegramHtml(comment)}` : ""}\n\nПришли обновлённую версию, когда будет готово.`;
        await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
        notified = true;

        if (status === "approved" && result.nextStageId) {
          const nextStage = funnel.stages?.find((stage) => stage.id === result.nextStageId);
          if (nextStage) await ctx.sendStageMessage(bot, chatId, funnel, nextStage);
        }
      } catch (error: any) {
        // Решение уже сохранено: молчание бота не повод его откатывать,
        // но админка должна показать, что ученик ничего не получил.
        console.warn("[HOMEWORK] Не удалось написать ученику:", error?.message || error);
      }
    }

    res.json({ success: true, status, notified, nextStageId: result.nextStageId || null });
  });
}
