import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Award, Bell, BookOpen, Bookmark, Calendar, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Download, Flame, LayoutDashboard, Lock,
  MessageCircle, Play, PlayCircle, Rocket, Search, Sparkles, Star, Timer,
  Trophy, Users, Video, Zap, Gift, X
} from 'lucide-react';

import { DEFAULT_LESSONS, DEFAULT_PLATFORM_TITLE, DEFAULT_TIER_LABELS, type Lesson, type Tier } from './platform/defaultProgram';
import { lessonIcon } from './platform/lessonIcons';
import PlatformLesson from './platform/PlatformLesson';

// ===================================================================
// КОНТЕНТ ПЛАТФОРМЫ приходит из настроек воронки (раздел «Платформа» →
// «Программа»). Встроенный курс в defaultProgram.ts остаётся запасным:
// его видят воронки, где программу ещё не завели.
// ===================================================================


// У заблокированного урока показываем только вывеску: содержимое чужого
// тарифа сервер в браузер не отдаёт.
type LockedLesson = { id: string; module: string; title: string; duration?: string };

type TierLabels = Partial<Record<Tier, string>>;

// Обложка урока: своя картинка, а если её не задали — детерминированный
// градиент по id с иконкой урока. Не ходит наружу и всегда рисуется.
function LessonCover({ lesson, className, iconSize }: { lesson: Lesson; className?: string; iconSize: number }) {
  if (lesson.coverUrl) {
    return (
      <img
        src={lesson.coverUrl}
        loading="lazy"
        decoding="async"
        alt={lesson.title}
        className={className}
      />
    );
  }

  const Icon = lessonIcon(lesson.icon);
  const hue = [...lesson.id].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`${className || ''} flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 92%), hsl(${(hue + 45) % 360} 65% 84%))` }}
    >
      <Icon size={iconSize} className="text-slate-600/70" />
    </div>
  );
}

function lessonsForTier(tier: Tier): Lesson[] {
  return DEFAULT_LESSONS.filter((lesson) => tier === 'pkg-2' || lesson.minTier === 'pkg-1');
}

function lockedLessonsForTier(tier: Tier): Lesson[] {
  if (tier === 'pkg-2') return [];
  return DEFAULT_LESSONS.filter((lesson) => lesson.minTier === 'pkg-2');
}

interface PlatformSession {
  id: string;
  title: string;
  description: string;
  startsAt: string | null;
  durationMin: number | null;
  joinUrl: string | null;
  recordingUrl: string | null;
  materials: Array<{ label: string; href: string }>;
  upcoming: boolean;
}

interface BonusReward {
  id: string;
  title: string;
  description: string;
  price: number;
  unlocked: boolean;
}

interface BonusSummary {
  balance: number;
  currencyLabel: string;
  perLesson: number;
  perQuestion: number;
  rewards: BonusReward[];
}

interface HomeworkStatusItem {
  stageId: string;
  stageTitle: string;
  status: 'pending_review' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewerComment: string;
}

interface AccessResponse {
  paid: boolean;
  tier?: Tier;
  title?: string;
  tierLabels?: TierLabels;
  lessons?: Lesson[] | null;
  lockedLessons?: LockedLesson[] | null;
  bonus?: BonusSummary | null;
  sessions?: PlatformSession[];
  progress?: { completed: string[]; lastLessonId: string | null; startedAt: string | null };
  homeworks?: HomeworkStatusItem[];
  products?: string[];
  curatorUrl?: string;
}

function getAuthPayload(params: URLSearchParams) {
  return {
    authTs: params.get('authTs') || '',
    authSig: params.get('authSig') || '',
    telegramInitData: window.Telegram?.WebApp?.initData || '',
  };
}

export default function PlatformPage() {
  const [state, setState] = useState<'loading' | 'granted' | 'denied' | 'telegram_only' | 'error'>('loading');
  const [tier, setTier] = useState<Tier>('pkg-1');
  const [completed, setCompleted] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PlatformSession[]>([]);
  const [bonus, setBonus] = useState<BonusSummary | null>(null);
  const [rewardPayload, setRewardPayload] = useState<{ title: string; payload: string } | null>(null);
  const [rewardError, setRewardError] = useState('');
  // Ссылка на куратора приходит с сервера из настроек воронки. Пока её не
  // задали, блок помощи не показываем: мёртвая кнопка хуже её отсутствия.
  const [curatorUrl, setCuratorUrl] = useState('');
  // Программа воронки. null — её ещё не завели, и платформа показывает
  // встроенный курс, как было до появления редактора программы.
  const [program, setProgram] = useState<Lesson[] | null>(null);
  const [lockedProgram, setLockedProgram] = useState<LockedLesson[] | null>(null);
  const [platformTitle, setPlatformTitle] = useState('');
  const [tierLabels, setTierLabels] = useState<TierLabels>({});
  const [homeworks, setHomeworks] = useState<HomeworkStatusItem[]>([]);
  const [lastLessonId, setLastLessonId] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const chatId = Number(params.get('chatId') || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0);
  const funnelId = params.get('funnel') || '';
  const lessonParam = params.get('lesson') || '';


  // Урок живёт на своём адресе: на него можно вести из напоминаний и дожима,
  // а не на общий список платформы.
  // Цену и содержимое награды решает сервер: здесь только показ результата.
  const redeemReward = async (reward: BonusSummary['rewards'][number]) => {
    setRewardError('');
    if (params.get('preview') === 'phone') {
      setRewardError('В предпросмотре обмен недоступен.');
      return;
    }
    try {
      const res = await fetch('/api/platform/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, funnelId, rewardId: reward.id, ...getAuthPayload(params) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRewardError(body?.error || 'Не удалось обменять');
        return;
      }
      if (body.bonus) setBonus(body.bonus);
      setRewardPayload({ title: reward.title, payload: body.payload || '' });
    } catch (e) {
      console.error(e);
      setRewardError('Не удалось обменять. Попробуйте ещё раз.');
    }
  };

  const formatSessionDate = (iso: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  };

  const openExternal = (href: string) => {
    const telegram = (window as any).Telegram?.WebApp;
    if (telegram?.openLink) telegram.openLink(href);
    else window.open(href, '_blank', 'noopener,noreferrer');
  };

  const openLesson = (lessonId: string, focus?: 'materials') => {
    const next = new URLSearchParams(window.location.search);
    next.set('lesson', lessonId);
    if (focus) next.set('focus', focus);
    else next.delete('focus');
    window.location.assign(`/?${next.toString()}`);
  };

  const backToProgram = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete('lesson');
    next.delete('focus');
    window.location.assign(`/?${next.toString()}`);
  };

  useEffect(() => {
    const funnelId = params.get('funnel');

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // Предпросмотр в редакторе или локальная разработка: доступ открывается для удобного тестирования
    if (params.get('preview')) {
      setTier('pkg-2');
      setState('granted');
      const onPreviewData = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'platform-preview') return;
        // Редактор умеет показывать платформу глазами любого тарифа.
        if (event.data.tier === 'pkg-1' || event.data.tier === 'pkg-2') setTier(event.data.tier);
        setSessions(event.data.sessions || []);
        setBonus(event.data.bonus || null);
        setCuratorUrl(event.data.curatorUrl || '');
        setProgram(event.data.lessons?.length ? event.data.lessons : null);
        setLockedProgram(event.data.lockedLessons?.length ? event.data.lockedLessons : null);
        setPlatformTitle(event.data.title || '');
        setTierLabels(event.data.tierLabels || {});
      };
      window.addEventListener('message', onPreviewData);
      // В рамке редактора данные шлёт родитель, в отдельной вкладке — тот, кто
      // её открыл. Без второго варианта вкладка показывала встроенный курс.
      const editor = window.parent !== window ? window.parent : window.opener;
      editor?.postMessage({ type: 'platform-preview-ready' }, window.location.origin);
      return () => window.removeEventListener('message', onPreviewData);
    }

    if (!funnelId || !chatId) {
      setState('error');
      return;
    }

    fetch('/api/platform/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, funnelId, stageId: 'platform', ...getAuthPayload(params) }),
    })
      .then(async (res) => {
        const body: AccessResponse = await res.json().catch(() => ({ paid: false }));
        if (res.ok && body.paid) {
          setTier(body.tier === 'pkg-2' ? 'pkg-2' : 'pkg-1');
          setCompleted(body.progress?.completed || []);
          setLastLessonId(body.progress?.lastLessonId || null);
          setSessions(body.sessions || []);
          setBonus(body.bonus || null);
          setCuratorUrl(body.curatorUrl || '');
          setProgram(body.lessons?.length ? body.lessons : null);
          setLockedProgram(body.lockedLessons?.length ? body.lockedLessons : null);
          setPlatformTitle(body.title || '');
          setTierLabels(body.tierLabels || {});
          setHomeworks(body.homeworks || []);
          setState('granted');
        } else if (res.status === 401) {
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTier('pkg-2');
            setState('granted');
          } else {
            setState('telegram_only');
          }
        } else {
          setState('denied');
        }
      })
      .catch(() => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          setTier('pkg-2');
          setState('granted');
        } else {
          setState('error');
        }
      });
  }, []);


  const lessons = program || lessonsForTier(tier);
  const lockedLessons: LockedLesson[] = lockedProgram || lockedLessonsForTier(tier);
  const tierName = (level: Tier) => tierLabels[level]?.trim() || DEFAULT_TIER_LABELS[level];

  const doneCount = lessons.filter((lesson) => completed.includes(lesson.id)).length;
  const progressPct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

  // Прогресс хранится на сервере: он переживает смену устройства и виден
  // владельцу в CRM. Отметку показываем сразу, а при отказе сервера откатываем.
  const toggleComplete = async (id: string) => {
    const done = !completed.includes(id);
    const previous = completed;
    setCompleted(done ? [...completed, id] : completed.filter((x) => x !== id));

    if (!chatId || !funnelId || params.get('preview') === 'phone') return;

    try {
      const res = await fetch('/api/platform/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, funnelId, lessonId: id, done, ...getAuthPayload(params) }),
      });
      if (!res.ok) throw new Error(`Lesson progress failed: ${res.status}`);
      const body = await res.json();
      if (Array.isArray(body?.progress?.completed)) setCompleted(body.progress.completed);
      if (body?.bonus) setBonus(body.bonus);
    } catch (e) {
      console.error(e);
      setCompleted(previous);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7F9]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#4F46E5]" />
      </div>
    );
  }

  if (state === 'denied' || state === 'telegram_only' || state === 'error') {
    const offerUrl = `/?funnel=${funnelId}&stage=stage-3`;
    const isTelegramOnly = state === 'telegram_only';
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7F9] p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
            <Lock size={22} />
          </div>
          <h1 className="mb-2 text-[19px] font-semibold text-[#16181D]">
            {isTelegramOnly ? 'Откройте платформу через бота' : state === 'error' ? 'Не удалось открыть платформу' : 'Доступ ещё не открыт'}
          </h1>
          <p className="mb-6 text-[14px] leading-6 text-[#5B6270]">
            {isTelegramOnly
              ? 'Платформа защищена от пересылки ссылок. Вернитесь в Telegram и нажмите свою кнопку «Открыть платформу».'
              : state === 'error'
                ? 'Откройте ссылку из сообщения бота ещё раз.'
                : 'Платформа открывается после оплаты — материалы появятся здесь автоматически.'}
          </p>
          {state === 'denied' && (
            <a
              href={offerUrl}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#4F46E5] px-6 text-[15px] font-semibold text-white transition hover:bg-[#4338CA]"
            >
              Перейти к тарифам <ArrowRight size={16} />
            </a>
          )}
        </div>
      </div>
    );
  }

  // ===== ДОСТУП ОТКРЫТ =====
  // Ссылка вида ?lesson=<id> открывает урок отдельной страницей. Урок чужого
  // тарифа сюда не попадёт: список уже отфильтрован по доступу.
  const openedIndex = lessonParam ? lessons.findIndex((item) => item.id === lessonParam) : -1;
  if (openedIndex >= 0) {
    const lesson = lessons[openedIndex];
    return (
      <PlatformLesson
        lesson={lesson}
        index={openedIndex}
        total={lessons.length}
        isDone={completed.includes(lesson.id)}
        prevLesson={lessons[openedIndex - 1]}
        nextLesson={lessons[openedIndex + 1]}
        onToggleDone={toggleComplete}
        onOpenLesson={openLesson}
        onBack={backToProgram}
        focusMaterials={params.get('focus') === 'materials'}
      />
    );
  }

  const modules = Array.from(new Set(lessons.map((lesson) => lesson.module)));
  const upcomingSessions = sessions.filter((session) => session.upcoming);

  const studentName = params.get('name')
    || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name
    || 'Студент';

  const pluralRu = (n: number, one: string, two: string, five: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return five;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return two;
    return five;
  };

  // Ученик приходит с одним вопросом: «что мне смотреть сейчас». Первый экран
  // отвечает именно на него — берём последний открытый урок, а если он уже
  // пройден или его нет, первый непройденный.
  const currentLesson = lessons.find((lesson) => lesson.id === lastLessonId && !completed.includes(lesson.id))
    || lessons.find((lesson) => !completed.includes(lesson.id))
    || lessons[lessons.length - 1];
  const currentIndex = currentLesson ? lessons.findIndex((lesson) => lesson.id === currentLesson.id) : -1;
  const allDone = lessons.length > 0 && doneCount === lessons.length;

  const sectionClass = 'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  const sectionTitleClass = 'platform-display text-[17px] text-slate-900';

  return (
    <div className="platform-page min-h-screen text-slate-900 antialiased">
      <div aria-hidden className="platform-bg" />

      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">

        {/* Шапка: только название платформы и тариф */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xs">
              <Sparkles size={16} />
            </span>
            <span className="platform-display truncate text-[15px] text-slate-900">
              {platformTitle || DEFAULT_PLATFORM_TITLE}
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-xs">
            {tierName(tier)}
          </span>
        </header>

        {/* ГЛАВНОЕ: следующий шаг */}
        {currentLesson && (
          <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-indigo-50/40 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.18)] sm:p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">
              {allDone
                ? 'Курс пройден'
                : `${doneCount > 0 ? 'Продолжаем' : 'Начинаем'} · урок ${currentIndex + 1} из ${lessons.length}`}
            </div>

            <h1 className="platform-display mt-2.5 text-[26px] leading-[1.15] text-slate-900 sm:text-3xl">
              {allDone ? 'Все уроки пройдены' : currentLesson.title}
            </h1>

            {!allDone && currentLesson.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{currentLesson.description}</p>
            )}
            {allDone && (
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Материалы остаются с вами — можно вернуться к любому уроку в программе ниже.
              </p>
            )}

            <div className="mt-5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="platform-nums">{doneCount} из {lessons.length} пройдено</span>
                <span className="platform-nums">{progressPct}%</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => openLesson(currentLesson.id)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Play size={15} fill="currentColor" />
                {allDone ? 'Открыть урок' : doneCount > 0 ? 'Продолжить' : 'Начать урок'}
              </button>

              {currentLesson.resources && currentLesson.resources.length > 0 && (
                <button
                  onClick={() => openLesson(currentLesson.id, 'materials')}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <BookOpen size={15} />
                  {currentLesson.resources.length} {pluralRu(currentLesson.resources.length, 'материал', 'материала', 'материалов')}
                </button>
              )}
            </div>
          </section>
        )}

        {/* ПРОГРАММА: весь курс одним списком по модулям */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className={sectionTitleClass}>Программа</h2>
            <span className="platform-nums text-[11px] text-slate-400">
              {lessons.length} {pluralRu(lessons.length, 'урок', 'урока', 'уроков')}
            </span>
          </div>

          {modules.map((module) => {
            const moduleLessons = lessons.filter((lesson) => lesson.module === module);
            const moduleDone = moduleLessons.filter((lesson) => completed.includes(lesson.id)).length;
            return (
              <div key={module} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {module || 'Без модуля'}
                  </span>
                  <span className="platform-nums shrink-0 text-[11px] text-slate-400">{moduleDone}/{moduleLessons.length}</span>
                </div>

                {moduleLessons.map((lesson) => {
                  const isDone = completed.includes(lesson.id);
                  const isCurrent = lesson.id === currentLesson?.id && !allDone;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => openLesson(lesson.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                        isCurrent ? 'bg-indigo-50/60' : ''
                      }`}
                    >
                      <LessonCover
                        lesson={lesson}
                        iconSize={16}
                        className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover"
                      />

                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-bold ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                          {isCurrent && <span className="font-bold text-emerald-600">Сейчас</span>}
                          {isCurrent && lesson.duration && <span>·</span>}
                          {lesson.duration && <span className="platform-nums">{lesson.duration}</span>}
                          {lesson.resources && lesson.resources.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="platform-nums">{lesson.resources.length} мат.</span>
                            </>
                          )}
                        </span>
                      </span>

                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isDone
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'bg-slate-900 text-white'
                      }`}>
                        {isDone ? <Check size={14} /> : <Play size={11} className="ml-0.5" fill="currentColor" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {lockedLessons.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/70">
              <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <Lock size={12} /> Откроется в тарифе {tierName('pkg-2')}
              </div>
              {lockedLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300">
                    <Lock size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-400">{lesson.title}</span>
                  {lesson.duration && <span className="platform-nums shrink-0 text-[11px] text-slate-300">{lesson.duration}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ЭФИРЫ */}
        {sessions.length > 0 && (
          <section className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClass}>Эфиры</h2>
              {upcomingSessions.length > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {upcomingSessions.length} впереди
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2.5">
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-snug text-slate-900">{session.title}</div>
                    <div className="platform-nums mt-0.5 text-[11px] text-slate-400">
                      {session.startsAt ? formatSessionDate(session.startsAt) : 'Дата уточняется'}
                      {session.durationMin ? ` · ${session.durationMin} мин` : ''}
                    </div>
                  </div>
                  {session.description && (
                    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-500">{session.description}</p>
                  )}

                  {(session.joinUrl || session.recordingUrl) && (
                    <button
                      onClick={() => openExternal((session.joinUrl || session.recordingUrl) as string)}
                      className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-900 px-4 text-[12px] font-bold text-white transition hover:bg-slate-800"
                    >
                      {session.upcoming ? <Video size={13} /> : <PlayCircle size={13} />}
                      {session.upcoming ? 'Подключиться' : 'Смотреть запись'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ДОМАШНИЕ ЗАДАНИЯ */}
        {homeworks.length > 0 && (
          <section className={sectionClass}>
            <h2 className={sectionTitleClass}>Домашние задания</h2>
            <div className="mt-3 space-y-2">
              {homeworks.map((homework) => (
                <div key={homework.stageId} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-bold text-slate-900">{homework.stageTitle}</div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      homework.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : homework.status === 'rejected'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {homework.status === 'approved' ? 'принято' : homework.status === 'rejected' ? 'доработать' : 'на проверке'}
                    </span>
                  </div>
                  {homework.reviewerComment && (
                    <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{homework.reviewerComment}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-400">
              Работы отправляются сообщением боту — там же придёт решение куратора.
            </p>
          </section>
        )}

        {/* БОНУСЫ */}
        {bonus && (
          <section className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClass}>Бонусы</h2>
              <span className="platform-nums text-base font-bold text-amber-600">
                {bonus.balance} <span className="text-[11px] font-medium text-slate-400">{bonus.currencyLabel}</span>
              </span>
            </div>

            {(bonus.perLesson > 0 || bonus.perQuestion > 0) && (
              <p className="mt-1.5 text-[12px] text-slate-500">
                {bonus.perLesson > 0 && `+${bonus.perLesson} за пройденный урок`}
                {bonus.perLesson > 0 && bonus.perQuestion > 0 && ' · '}
                {bonus.perQuestion > 0 && `+${bonus.perQuestion} за ответ на вопрос`}
              </p>
            )}

            {bonus.rewards.length > 0 && (
              <div className="mt-3 space-y-2">
                {bonus.rewards.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{reward.title}</div>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        <span className="platform-nums text-amber-600">{reward.price}</span> {bonus.currencyLabel}
                        {reward.description ? ` · ${reward.description}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => redeemReward(reward)}
                      disabled={reward.unlocked || bonus.balance < reward.price}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-[12px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Gift size={13} />
                      {reward.unlocked ? 'Получено' : bonus.balance < reward.price ? 'Не хватает' : 'Обменять'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {rewardError && <p className="mt-2 text-[12px] font-semibold text-rose-600">{rewardError}</p>}
          </section>
        )}

        {/* ПОМОЩЬ */}
        {curatorUrl && (
          <button
            onClick={() => openExternal(curatorUrl)}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200/80 bg-white p-4 text-sm font-bold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50"
          >
            <MessageCircle size={16} className="text-emerald-400" /> Нужна помощь?
          </button>
        )}

        {/* АПСЕЛЛ СТАРШЕГО ТАРИФА — в самом низу: это нужно автору, не ученику */}
        {tier !== 'pkg-2' && (
          <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
              <Rocket size={14} /> Тариф {tierName('pkg-2')}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Исходный код сервиса, интеграции с CRM и закрытые связки продаж.
            </p>
            <a
              href={`/?funnel=${funnelId}&stage=stage-3`}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Посмотреть тариф <ArrowRight size={14} />
            </a>
          </section>
        )}

        <p className="pb-2 text-center text-[11px] text-slate-400">
          {studentName}, доступ к платформе бессрочный
        </p>
      </div>

      {/* Что именно получил ученик за бонусы */}
      {rewardPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setRewardPayload(null)}
            aria-label="Закрыть"
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setRewardPayload(null)}
              className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-700"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Gift size={20} />
            </div>
            <h3 className="platform-display mt-4 text-lg text-slate-900">{rewardPayload.title}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              {rewardPayload.payload || 'Награда получена. Куратор свяжется с вами в чате.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
