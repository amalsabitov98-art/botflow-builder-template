import express from "express";
import type { Funnel, LiveSession, OrderEntry, PlatformLesson } from "../types";
import { getChatAccess, type AccessTier } from "../services/access";
import type { UserStageState } from "../services/progress";
import type { createBonusService } from "../services/bonus";
import { DEFAULT_LESSONS } from "../../shared/platformProgram";

interface PlatformRoutesContext {
  activeFunnels: Map<string, Funnel>;
  bonus: ReturnType<typeof createBonusService>;
  orders: OrderEntry[];
  ensureUserState: (chatId: number, funnelId: string) => UserStageState;
  persistUserState: (chatId: number, state: UserStageState) => Promise<void>;
  validateTelegramWebAppAuth: (req: express.Request, funnelId: string, chatId: number) => boolean;
}

// Урок с бесконечным идентификатором в досье не нужен, как и бесконечный список.
const MAX_LESSON_ID_LENGTH = 64;
const MAX_COMPLETED_LESSONS = 200;

interface PlatformModule {
  id: string;
  title: string;
  description: string;
  // Lowest tier that unlocks this module.
  minTier: AccessTier;
}

const PLATFORM_MODULES: PlatformModule[] = [
  { id: "base-course", title: "База: премиум-сайт на ИИ", description: "Полная версия уроков 1–4 без ограничений по времени.", minTier: "pkg-1" },
  { id: "bot-payments", title: "Бот, оплата и выдача доступов", description: "Как собрать систему с приёмом оплаты и автоматической выдачей.", minTier: "pkg-1" },
  { id: "source-code", title: "Исходный код AI-сервиса", description: "Готовый код продукта, который можно адаптировать под свою нишу.", minTier: "pkg-2" },
  { id: "traffic", title: "VIP: продвижение и трафик", description: "Связки Instagram + Threads для бесплатного потока клиентов.", minTier: "pkg-2" },
];

function modulesForTier(tier: AccessTier): PlatformModule[] {
  if (tier === "pkg-2") return PLATFORM_MODULES;
  return PLATFORM_MODULES.filter((module) => module.minTier === "pkg-1");
}

export function registerPlatformRoutes(app: express.Express, ctx: PlatformRoutesContext) {
  // Общая проверка для платных экранов: WebApp Telegram + оплаченный доступ.
  function requirePaidAccess(req: express.Request, res: express.Response) {
    const { chatId, funnelId } = req.body || {};
    const numericChatId = Number(chatId);

    if (!Number.isSafeInteger(numericChatId) || numericChatId <= 0) {
      res.status(400).json({ error: "Invalid chatId" });
      return null;
    }
    if (typeof funnelId !== "string" || !funnelId) {
      res.status(400).json({ error: "Missing funnelId" });
      return null;
    }

    // Platform lessons are gated to Telegram WebApp only. A copied browser URL with authSig is not enough.
    if (!ctx.validateTelegramWebAppAuth(req, funnelId, numericChatId)) {
      res.status(401).json({
        paid: false,
        error: "Platform access must be opened from Telegram WebApp",
        telegramOnly: true,
      });
      return null;
    }

    const access = getChatAccess(ctx.orders, numericChatId, funnelId);
    if (!access.paid || !access.tier) {
      res.status(403).json({ paid: false, error: "No active purchase for this account" });
      return null;
    }

    return { chatId: numericChatId, funnelId, access };
  }

  // Ссылка на куратора настраивается в админке. Пропускаем только http(s) и
  // tg: пустая или чужая схема — значит блока помощи на платформе просто нет.
  function curatorUrlFor(funnelId: string) {
    const raw = (ctx.activeFunnels.get(funnelId)?.platform?.curatorUrl || "").trim();
    if (!raw) return "";
    return /^(https?:\/\/|tg:\/\/)/i.test(raw) ? raw : "";
  }

  // Эфиры отдаём по тарифу и в понятном порядке: ближайший будущий сверху,
  // прошедшие — свежими вниз. Ссылку на подключение к чужому тарифу не выдаём.
  function sessionsForTier(funnelId: string, tier: AccessTier) {
    const sessions = ctx.activeFunnels.get(funnelId)?.platform?.sessions || [];
    const now = Date.now();

    const visible = sessions.filter((session: LiveSession) => (
      tier === "pkg-2" || (session.minTier || "pkg-1") === "pkg-1"
    ));

    const withState = visible.map((session) => {
      const startsAt = session.startsAt ? new Date(session.startsAt).getTime() : null;
      const upcoming = Boolean(startsAt && startsAt > now);
      return {
        id: session.id,
        title: session.title,
        description: session.description || "",
        startsAt: session.startsAt || null,
        durationMin: session.durationMin || null,
        // Ссылка на подключение нужна только пока эфир не прошёл.
        joinUrl: upcoming ? session.joinUrl || null : null,
        recordingUrl: upcoming ? null : session.recordingUrl || null,
        materials: session.materials || [],
        upcoming,
      };
    });

    const upcoming = withState
      .filter((session) => session.upcoming)
      .sort((a, b) => new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime());
    const past = withState
      .filter((session) => !session.upcoming)
      .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime());

    return [...upcoming, ...past];
  }

  // Программа платформы приходит из настроек воронки. Пока её не завели,
  // отдаём null: страница ученика в этом случае показывает встроенный курс,
  // как было до появления редактора программы.
  function programFor(funnelId: string, tier: AccessTier) {
    const funnel = ctx.activeFunnels.get(funnelId);
    const lessons = funnel?.platform?.lessons;
    if (!Array.isArray(lessons) || lessons.length === 0) return null;

    const allowed = (minTier?: string) => tier === "pkg-2" || (minTier || "pkg-1") === "pkg-1";

    // Уроки чужого тарифа не уезжают в браузер целиком: у заблокированных
    // остаются только название и модуль — их видно как повод доплатить.
    const visible = lessons.filter((lesson: PlatformLesson) => allowed(lesson.minTier));
    const locked = lessons
      .filter((lesson: PlatformLesson) => !allowed(lesson.minTier))
      .map((lesson: PlatformLesson) => ({
        id: lesson.id,
        module: lesson.module,
        title: lesson.title,
        duration: lesson.duration || "",
      }));

    return {
      lessons: visible.map((lesson: PlatformLesson) => ({
        id: lesson.id,
        module: lesson.module,
        title: lesson.title,
        icon: lesson.icon || "",
        duration: lesson.duration || "",
        description: lesson.description || "",
        coverUrl: lesson.coverUrl || "",
        videoSrc: lesson.videoSrc || "",
        minTier: lesson.minTier || "pkg-1",
        resources: (lesson.resources || []).filter((resource) => allowed(resource.minTier)),
      })),
      lockedLessons: locked,
    };
  }

  // Название платформы и подписи тарифов — тоже настройки воронки. Старший
  // тариф нужен и младшему: его именем подписан блок «что откроется дальше».
  function brandingFor(funnelId: string) {
    const platform = ctx.activeFunnels.get(funnelId)?.platform;
    return {
      title: (platform?.title || "").trim(),
      tierLabels: {
        "pkg-1": (platform?.tiers?.["pkg-1"]?.label || "").trim(),
        "pkg-2": (platform?.tiers?.["pkg-2"]?.label || "").trim(),
      },
    };
  }

  // Домашние задания ученик сдаёт боту, а статус узнавал только из переписки.
  // На платформе он теперь видит, что принято, а что ждёт проверки.
  function readHomeworks(chatId: number, funnelId: string) {
    const state = ctx.ensureUserState(chatId, funnelId);
    const stages = ctx.activeFunnels.get(funnelId)?.stages || [];
    return Object.values(state.profile?.homeworks || {}).map((homework: any) => ({
      stageId: homework.stageId,
      stageTitle: stages.find((stage) => stage.id === homework.stageId)?.title || homework.stageId,
      status: homework.status,
      submittedAt: homework.submittedAt || null,
      reviewedAt: homework.reviewedAt || null,
      reviewerComment: homework.reviewerComment || "",
    }));
  }

  function readCourseProgress(chatId: number, funnelId: string) {
    const state = ctx.ensureUserState(chatId, funnelId);
    const course = state.profile?.course;
    return {
      completed: course?.completed || [],
      lastLessonId: course?.lastLessonId || null,
      startedAt: course?.startedAt || null,
    };
  }

  // Отметить урок пройденным или снять отметку. Прогресс живёт в досье
  // подписчика вместе с ответами на вопросы воронки — одна JSONB-колонка.
  app.post("/api/platform/lesson", async (req, res) => {
    const auth = requirePaidAccess(req, res);
    if (!auth) return;

    const lessonId = String(req.body?.lessonId || "").trim();
    if (!lessonId || lessonId.length > MAX_LESSON_ID_LENGTH) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }
    const done = req.body?.done !== false;

    const configuredLessons = ctx.activeFunnels.get(auth.funnelId)?.platform?.lessons;
    const lessons = configuredLessons?.length ? configuredLessons : DEFAULT_LESSONS;
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson || (lesson.minTier === "pkg-2" && auth.access.tier !== "pkg-2")) {
      return res.status(403).json({ error: "Lesson is not available for this account" });
    }

    const state = ctx.ensureUserState(auth.chatId, auth.funnelId);
    if (!state.profile) state.profile = { answers: {} };
    const course = state.profile.course || { completed: [] };
    const completed = new Set(course.completed);

    if (done) completed.add(lessonId);
    else completed.delete(lessonId);

    // Бонус за урок начисляется один раз: ключ идемпотентности внутри сервиса
    // не даст получить его повторно, сколько бы раз ни нажали кнопку.
    if (done) ctx.bonus.awardForLesson(state, auth.funnelId, lessonId);
    else ctx.bonus.revokeForLesson(state, lessonId);

    const now = new Date().toISOString();
    state.profile.course = {
      completed: Array.from(completed).slice(-MAX_COMPLETED_LESSONS),
      lastLessonId: lessonId,
      startedAt: course.startedAt || now,
      updatedAt: now,
    };
    state.lastActionAt = now;

    try {
      await ctx.persistUserState(auth.chatId, state);
    } catch (error: any) {
      console.error("Failed to save course progress:", error?.message || error);
      return res.status(503).json({ error: "Не удалось сохранить прогресс. Попробуйте ещё раз." });
    }

    res.json({
      success: true,
      progress: readCourseProgress(auth.chatId, auth.funnelId),
      bonus: ctx.bonus.summary(state, auth.funnelId, auth.access.tier),
    });
  });

  // Обмен бонусов на награду. Цену берёт сервер из настроек воронки,
  // содержимое награды отдаётся только после успешного списания.
  app.post("/api/platform/reward", async (req, res) => {
    const auth = requirePaidAccess(req, res);
    if (!auth) return;

    const rewardId = String(req.body?.rewardId || "").trim();
    if (!rewardId) return res.status(400).json({ error: "Invalid rewardId" });

    const state = ctx.ensureUserState(auth.chatId, auth.funnelId);
    const result = ctx.bonus.spend(state, auth.funnelId, rewardId, auth.access.tier);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || "Обмен недоступен", balance: result.balance });
    }

    try {
      await ctx.persistUserState(auth.chatId, state);
    } catch (error: any) {
      console.error("Failed to save bonus spend:", error?.message || error);
      return res.status(503).json({ error: "Не удалось выполнить обмен. Попробуйте ещё раз." });
    }

    res.json({
      success: true,
      payload: result.reward?.payload || "",
      bonus: ctx.bonus.summary(state, auth.funnelId, auth.access.tier),
    });
  });

  app.post("/api/platform/access", (req, res) => {
    const { chatId, funnelId, stageId } = req.body || {};
    const numericChatId = Number(chatId);

    if (!Number.isSafeInteger(numericChatId) || numericChatId <= 0) {
      return res.status(400).json({ error: "Invalid chatId" });
    }
    if (typeof funnelId !== "string" || !funnelId) {
      return res.status(400).json({ error: "Missing funnelId" });
    }

    // Platform lessons are gated to Telegram WebApp only. A copied browser URL with authSig is not enough.
    if (!ctx.validateTelegramWebAppAuth(req, funnelId, numericChatId)) {
      return res.status(401).json({
        paid: false,
        error: "Platform access must be opened from Telegram WebApp",
        telegramOnly: true,
      });
    }

    const access = getChatAccess(ctx.orders, numericChatId, funnelId);
    if (!access.paid || !access.tier) {
      return res.status(403).json({ paid: false, error: "No active purchase for this account" });
    }

    const program = programFor(funnelId, access.tier);
    const branding = brandingFor(funnelId);

    res.json({
      paid: true,
      tier: access.tier,
      products: access.products,
      modules: modulesForTier(access.tier).map(({ minTier, ...rest }) => rest),
      title: branding.title,
      tierLabels: branding.tierLabels,
      lessons: program?.lessons || null,
      lockedLessons: program?.lockedLessons || null,
      sessions: sessionsForTier(funnelId, access.tier),
      curatorUrl: curatorUrlFor(funnelId),
      progress: readCourseProgress(numericChatId, funnelId),
      homeworks: readHomeworks(numericChatId, funnelId),
      bonus: ctx.bonus.summary(ctx.ensureUserState(numericChatId, funnelId), funnelId, access.tier),
    });
  });
}
