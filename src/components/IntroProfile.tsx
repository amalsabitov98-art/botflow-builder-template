import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Gift, Lock, Play, Target } from 'lucide-react';
import IntroParallaxBackdrop from './webapp/IntroParallaxBackdrop';
import { DEFAULT_FUNNEL_ID } from './webapp/twa';

interface IntroProfileProps {
  chatId: number | null;
  isPhonePreview?: boolean;
}

interface ProfileStage {
  id: string;
  index: number;
  title: string;
}

interface ProfilePayload {
  funnelId: string;
  title: string;
  targetStageId: string;
  stages: ProfileStage[];
  progress: {
    currentStageId: string | null;
    completedCount: number;
    totalStages: number;
    percent: number;
    sentStages: string[];
    openedStages: string[];
    viewedStages: string[];
    completedStages: string[];
    purchaseStatus: 'none' | 'pending' | 'paid' | 'refund';
    lastActionAt: string | null;
  };
}

const FALLBACK_STAGES: ProfileStage[] = [
  { id: 'stage-0', index: 0, title: 'Первый премиум-сайт за вечер' },
  { id: 'stage-1', index: 1, title: 'Анимации и заявки в Telegram' },
  { id: 'stage-2', index: 2, title: 'Публикация и живая ссылка' },
  { id: 'stage-3', index: 3, title: 'Монетизация и IT-актив' },
];

// Короткая подпись под названием урока: что человек унесёт с собой.
const STAGE_OUTCOME = [
  'Готовый дизайн первого экрана',
  'Анимации и заявки в Telegram',
  'Опубликованный сайт и живая ссылка',
  'Упаковка результата в понятный оффер',
];

type LessonState = 'done' | 'current' | 'available' | 'locked';

function getTelegramName() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return user?.first_name || '';
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getWebAppAuthPayload(params: URLSearchParams) {
  return {
    authTs: params.get('authTs') || '',
    authSig: params.get('authSig') || '',
    telegramInitData: window.Telegram?.WebApp?.initData || '',
  };
}

export default function IntroProfile({ chatId, isPhonePreview }: IntroProfileProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const funnelId = params.get('funnel') || DEFAULT_FUNNEL_ID;
  const source = params.get('source') || '';
  const openedTrackedRef = useRef(false);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const trackProfileEvent = async (event: 'menu_button_opened' | 'profile_opened' | 'profile_continue_clicked') => {
    if (!chatId) return;
    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          chatId,
          event,
          funnelId,
          stageId: 'intro',
          ...getWebAppAuthPayload(params),
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }

    const query = new URLSearchParams({ chatId: String(chatId) });
    const auth = getWebAppAuthPayload(params);
    if (auth.authTs) query.set('authTs', auth.authTs);
    if (auth.authSig) query.set('authSig', auth.authSig);

    fetch(`/api/webapp/${funnelId}/profile?${query}`, {
      headers: auth.telegramInitData
        ? { 'X-Telegram-Init-Data': auth.telegramInitData }
        : undefined,
    })
      .then(res => {
        if (!res.ok) throw new Error(`Profile request failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chatId, funnelId, params]);

  useEffect(() => {
    if (!chatId || openedTrackedRef.current) return;
    openedTrackedRef.current = true;
    if (source === 'menu_button') {
      void trackProfileEvent('menu_button_opened');
    }
    void trackProfileEvent('profile_opened');
  }, [chatId, source]);

  const progress = profile?.progress;
  const displayName = getTelegramName();
  const targetStageId = profile?.targetStageId || 'stage-0';
  const profileStages = profile?.stages?.length ? profile.stages : FALLBACK_STAGES;
  const nextStage = profileStages.find(stage => stage.id === targetStageId) || profileStages[0];
  const completedCount = progress?.completedCount || 0;
  const totalStages = progress?.totalStages || profileStages.length || 4;
  const progressPercent = progress?.percent || 0;
  const safeProgressPercent = Math.min(100, Math.max(0, progressPercent));
  const remainingLessons = Math.max(0, totalStages - completedCount);
  const remainingLessonsLabel = remainingLessons === 1
    ? '1 урок'
    : `${remainingLessons} урока`;
  const bonusUnlocked = remainingLessons === 0 || safeProgressPercent === 100;
  const markerLabelTransform = safeProgressPercent <= 10
    ? 'translateX(0)'
    : safeProgressPercent >= 90
      ? 'translateX(-100%)'
      : 'translateX(-50%)';
  const lastActive = formatDate(progress?.lastActionAt);
  const hasStarted = completedCount > 0 || (progress?.openedStages?.length || 0) > 0;

  // Состояние урока считается из того, что сервер уже знает о человеке:
  // выдан ли этап, открыт ли, завершён ли. Закрытые уроки не кликаются.
  const stateOf = (stage: ProfileStage): LessonState => {
    if (progress?.completedStages?.includes(stage.id)) return 'done';
    if (stage.id === targetStageId) return 'current';
    const reached = progress?.sentStages?.includes(stage.id) || progress?.openedStages?.includes(stage.id);
    if (reached) return 'available';
    return stage.index < (nextStage?.index ?? 0) ? 'available' : 'locked';
  };

  const openStage = async (stageId: string, isContinue = false) => {
    if (isContinue) await trackProfileEvent('profile_continue_clicked');
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('funnel', funnelId);
    nextParams.set('stage', stageId);
    window.location.assign(`/?${nextParams.toString()}`);
  };

  const stateLabel: Record<LessonState, string> = {
    done: 'Урок пройден',
    current: 'Текущий урок',
    available: 'Можно открыть',
    locked: 'Откроется позже',
  };

  return (
    <div className="cabinet-page relative min-h-screen overflow-hidden bg-[#0F1115] text-[#E6E8EC]">
      <IntroParallaxBackdrop />

      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0A0F12]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-[#E6E8EC]">
                {profile?.title || 'AI Site Lab'}
              </div>
              <div className="mt-0.5 text-[13px] text-[#6E7683]">
                {completedCount} из {totalStages} уроков пройдено
              </div>
            </div>
            <div className="shrink-0 text-[13px] font-semibold text-[#5FD39B]">{safeProgressPercent}%</div>
          </div>
        </div>
      </header>

      <main className={`relative z-10 mx-auto max-w-3xl px-5 ${isPhonePreview ? 'pb-10 pt-5' : 'pb-16 pt-6'}`}>
        <section className="overflow-hidden rounded-[14px] border border-white/[0.13] bg-[#081014]/70 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-md sm:p-6">
          <div className="text-[13px] text-white/60">
            {displayName
              ? `${displayName}, ${hasStarted ? 'вы остановились здесь' : 'начнём с первого урока'}`
              : (hasStarted ? 'Вы остановились здесь' : 'Начнём с первого урока')}
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-[1.25] text-[#E6E8EC] sm:text-[26px]">
            {nextStage?.title || 'Первый урок'}
          </h1>
          {STAGE_OUTCOME[nextStage?.index ?? 0] && (
            <p className="mt-2 text-[14px] leading-6 text-white/65">
              {STAGE_OUTCOME[nextStage?.index ?? 0]}
            </p>
          )}
          <button
            onClick={() => openStage(targetStageId, true)}
            disabled={loading}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#7CE3AE] px-5 text-[15px] font-semibold text-[#071711] shadow-[0_12px_30px_rgba(95,211,155,0.2)] transition hover:bg-[#8AECB9] disabled:opacity-50 sm:w-auto"
          >
            {hasStarted ? 'Продолжить' : 'Начать урок'}
            <ArrowRight size={17} />
          </button>
        </section>

        <section className="mt-7 border-b border-white/[0.08] px-0.5 pb-7" aria-labelledby="course-progress-title">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[#5FD39B]/20 bg-[#5FD39B]/10 text-[#5FD39B]">
                <Target size={17} />
              </span>
              <div className="min-w-0">
                <h2 id="course-progress-title" className="text-[14px] font-semibold text-[#E6E8EC]">Прогресс курса</h2>
                <p className="mt-0.5 text-[12px] text-[#737B87]">
                  {completedCount} из {totalStages} уроков завершено
                </p>
              </div>
            </div>
            <strong className="shrink-0 text-[18px] font-semibold text-[#E6E8EC]">{safeProgressPercent}%</strong>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-[12px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-white/55">
              <Gift size={14} className="text-[#5FD39B]" />
              До бонуса
            </span>
            <span className={bonusUnlocked ? 'text-[#5FD39B]' : 'text-[#E6E8EC]'}>
              {bonusUnlocked ? 'Бонус открыт' : `Осталось ${remainingLessonsLabel}`}
            </span>
          </div>

          <div className="relative mt-8 pr-11">
            <div className="relative">
              {!bonusUnlocked && (
                <span
                  className="absolute -top-7 whitespace-nowrap rounded-[6px] bg-[#5FD39B] px-2 py-1 text-[11px] font-semibold leading-none text-[#071711] shadow-[0_8px_20px_rgba(95,211,155,0.18)] transition-[left] duration-500"
                  style={{ left: `${safeProgressPercent}%`, transform: markerLabelTransform }}
                >
                  Вы здесь
                </span>
              )}
              <div
                className="relative h-2 rounded-full bg-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
                role="progressbar"
                aria-label="Прогресс курса"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={safeProgressPercent}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[#5FD39B] transition-[width] duration-500"
                  style={{ width: `${safeProgressPercent}%` }}
                />
                {!bonusUnlocked && (
                  <span
                    className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#D5FBE7] bg-[#5FD39B] shadow-[0_0_0_5px_rgba(95,211,155,0.13),0_6px_18px_rgba(0,0,0,0.35)] transition-[left] duration-500"
                    style={{ left: `${safeProgressPercent}%` }}
                  />
                )}
              </div>
            </div>

            <span
              className={`absolute right-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border transition ${
                bonusUnlocked
                  ? 'border-[#7CE3AE] bg-[#7CE3AE] text-[#071711] shadow-[0_0_0_5px_rgba(95,211,155,0.14)]'
                  : 'border-[#5FD39B]/30 bg-[#10201B] text-[#5FD39B]'
              }`}
              aria-label={bonusUnlocked ? 'Бонус открыт' : `До бонуса осталось ${remainingLessonsLabel}`}
            >
              <Gift size={16} strokeWidth={2.2} />
            </span>
          </div>

          <p className="mt-4 text-[11px] leading-5 text-white/38">
            В финале: 50 промптов + чек-лист клиента на $300
          </p>
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-4 px-0.5">
            <div>
              <div className="text-[12px] font-medium text-[#5FD39B]">Ваш маршрут</div>
              <h2 className="mt-1 text-[18px] font-semibold text-[#E6E8EC]">Программа</h2>
            </div>
            <span className="pb-0.5 text-[12px] text-[#6E7683]">
              {totalStages} {totalStages === 1 ? 'урок' : totalStages < 5 ? 'урока' : 'уроков'}
            </span>
          </div>

          <ol className="mt-4 overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#101519]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-md">
            {profileStages.map(stage => {
              const state = stateOf(stage);
              const locked = state === 'locked';
              const isCurrent = state === 'current';

              return (
                <li key={stage.id} className="relative border-b border-white/[0.07] last:border-b-0">
                  <button
                    onClick={() => !locked && openStage(stage.id)}
                    disabled={locked}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`group relative grid min-h-[78px] w-full grid-cols-[44px_minmax(0,1fr)_28px] items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      isCurrent
                        ? 'bg-[linear-gradient(90deg,rgba(95,211,155,0.12),rgba(95,211,155,0.025)_72%,transparent)]'
                        : locked
                          ? 'cursor-default bg-[#12151A]'
                          : 'hover:bg-white/[0.035]'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-[#5FD39B]" aria-hidden="true" />
                    )}

                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border text-[13px] font-semibold transition-colors ${
                        state === 'done'
                          ? 'border-[#5FD39B]/20 bg-[#5FD39B]/10 text-[#5FD39B]'
                          : isCurrent
                            ? 'border-[#75E3AE] bg-[#5FD39B] text-[#0B1F16] shadow-[0_8px_24px_rgba(95,211,155,0.2)]'
                            : locked
                              ? 'border-white/[0.05] bg-white/[0.025] text-[#454B55]'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#A8AFB9] group-hover:border-white/[0.14]'
                      }`}
                    >
                      {state === 'done'
                        ? <Check size={17} />
                        : isCurrent
                          ? <Play size={15} className="translate-x-px" />
                          : locked
                            ? <Lock size={14} />
                            : stage.index + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className={`block text-[11px] font-medium leading-4 ${isCurrent ? 'text-[#5FD39B]' : locked ? 'text-[#4E5560]' : 'text-[#737B87]'}`}>
                        Урок {stage.index + 1}
                      </span>
                      <span className={`mt-0.5 block text-[14px] font-medium leading-5 ${locked ? 'text-[#626A75]' : 'text-[#E6E8EC]'}`}>
                        {stage.title}
                      </span>
                      <span className={`mt-1 block text-[12px] ${isCurrent ? 'font-medium text-[#5FD39B]' : locked ? 'text-[#4E5560]' : 'text-[#737B87]'}`}>
                        {stateLabel[state]}
                      </span>
                    </span>

                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                        locked
                          ? 'border-white/[0.04] text-[#3E454F]'
                          : isCurrent
                            ? 'border-[#5FD39B]/20 bg-[#5FD39B]/10 text-[#5FD39B]'
                            : 'border-white/[0.08] text-[#606873] transition-colors group-hover:border-white/[0.14] group-hover:text-[#A8AFB9]'
                      }`}
                      aria-hidden="true"
                    >
                      {locked ? <Lock size={12} /> : <ArrowRight size={13} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {lastActive && (
          <p className="mt-6 px-1 text-[13px] text-[#5B626D]">
            Последняя активность — {lastActive}
          </p>
        )}
      </main>
    </div>
  );
}
