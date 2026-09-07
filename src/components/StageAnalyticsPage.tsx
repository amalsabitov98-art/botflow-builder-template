import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileCheck, Flame, GraduationCap, Loader2, PlayCircle, RefreshCw, TestTube2, TrendingDown, Users } from 'lucide-react';
import ModernSelect from './ui/ModernSelect';

interface StageAnalyticsPageProps {
  funnels: any[];
  selectedFunnelId?: string | null;
  onSelectFunnel?: (id: string) => void;
}

interface StageHomeworkStats {
  required?: boolean;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface StageAnalytics {
  id: string;
  index: number;
  title: string;
  sent: number;
  opened: number;
  viewed: number;
  completed: number;
  paid: number;
  homework?: StageHomeworkStats;
  currentUsers?: number;
  stuckUsers?: number;
  rates: {
    openRate: number;
    viewRate: number;
    videoRetentionRate?: number;
    completeRate: number;
    paidRate: number;
  };
  biggestDrop?: {
    label: string;
    lost: number;
  };
}

interface FunnelTotals {
  audience: number;
  reached: number;
  opened: number;
  viewed: number;
  completed: number;
  paid: number;
  homework?: {
    submitted: number;
    pending: number;
    approved: number;
  };
  stuckUsers?: number;
}

interface FunnelAnalytics {
  funnelId: string;
  title: string;
  totalTracked: number;
  totals?: FunnelTotals;

  profileAnalytics?: {
    menuButtonOpened: number;
    profileOpened: number;
    profileContinued: number;
    continueRate: number;
    segments: Array<{
      key: string;
      label: string;
      description: string;
      count: number;
    }>;
  };
  stages: StageAnalytics[];
  biggestDrop?: {
    stageTitle: string;
    label: string;
    lost: number;
  };
}

const funnelStatusLabel = (status?: string) => {
  if (status === 'active') return 'Активна';
  if (status === 'archived') return 'Архив';
  return 'Черновик';
};

function pluralRu(value: number, one: string, few: string, many: string) {
  const abs = Math.abs(value);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const pct = (value: number, base: number) => (base > 0 ? Math.round((value / base) * 100) : 0);

export default function StageAnalyticsPage({ funnels, selectedFunnelId, onSelectFunnel }: StageAnalyticsPageProps) {
  const firstFunnelId = funnels[0]?.id || null;
  const activeFunnelId = selectedFunnelId || firstFunnelId;
  const activeFunnel = useMemo(
    () => funnels.find(funnel => funnel.id === activeFunnelId) || funnels[0] || null,
    [funnels, activeFunnelId]
  );

  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testRunInfo, setTestRunInfo] = useState<any | null>(null);
  const [error, setError] = useState('');

  // Реальные уникальные пользователи по уровням вовлечённости (приходят с бэка).
  // Фолбэк на totalTracked, если старый ответ без totals.
  const overview: FunnelTotals = useMemo(() => {
    if (analytics?.totals) return analytics.totals;
    return {
      audience: analytics?.totalTracked || 0,
      reached: 0,
      opened: 0,
      viewed: 0,
      completed: 0,
      paid: 0,
    };
  }, [analytics]);

  const fetchAnalytics = async () => {
    if (!activeFunnelId) return;
    setAnalyticsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}/analytics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить аналитику');
      setAnalytics(data);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки аналитики');
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const runTestFunnel = async () => {
    if (!activeFunnelId) return;
    setTestRunning(true);
    setTestRunInfo(null);
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}/test-run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось создать тест');
      setTestRunInfo(data);
      window.open(data.webAppUrl, '_blank', 'noopener,noreferrer');
      setTimeout(fetchAnalytics, 700);
    } catch (e: any) {
      setTestRunInfo({ error: e.message || 'Ошибка тестового запуска' });
    } finally {
      setTestRunning(false);
    }
  };

  useEffect(() => {
    if (activeFunnelId) {
      void fetchAnalytics();
    } else {
      setAnalytics(null);
    }
  }, [activeFunnelId]);

  const completionRate = pct(overview.completed, overview.audience);
  const paymentRate = pct(overview.paid, overview.audience);
  const openRate = pct(overview.opened, overview.audience);

  const avgVideoRetention = useMemo(() => {
    if (!analytics?.stages?.length) return 0;
    const stagesWithViews = analytics.stages.filter(s => s.opened > 0);
    if (!stagesWithViews.length) return 0;
    const sum = stagesWithViews.reduce((acc, s) => acc + (s.rates.videoRetentionRate ?? pct(s.viewed, s.opened)), 0);
    return Math.round(sum / stagesWithViews.length);
  }, [analytics]);

  const funnelSteps = [
    { key: 'audience', label: 'Все лиды', description: 'Вошли в воронку', value: overview.audience, color: '#64748b' },
    { key: 'reached', label: 'Получили урок', description: 'Бот отправил материал', value: overview.reached, color: '#7c83df' },
    { key: 'opened', label: 'Открыли', description: 'Перешли к содержанию', value: overview.opened, color: '#6f76d9' },
    { key: 'viewed', label: 'Досмотрели', description: 'Дошли до конца видео', value: overview.viewed, color: '#626bcf' },
    { key: 'completed', label: 'Завершили', description: 'Выполнили целевое действие', value: overview.completed, color: '#4f8f78' },
    { key: 'paid', label: 'Оплатили', description: 'Стали покупателями', value: overview.paid, color: '#2f7d62' },
  ];

  const profileMetricCards = [
    { label: 'Открыли кнопку в чате', value: analytics?.profileAnalytics?.menuButtonOpened || 0 },
    { label: 'Открыли профиль', value: analytics?.profileAnalytics?.profileOpened || 0 },
    { label: 'Вернулись к уроку', value: analytics?.profileAnalytics?.profileContinued || 0 },
  ];

  return (
    <div className="admin-page flex-1 min-w-0 overflow-y-auto bg-[#f6f7f9] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5 pb-16">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">CRM-аналитика</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Воронка и этапы</h1>
            <p className="mt-1 text-sm text-slate-500">Путь клиента от первого контакта до сдачи ДЗ и оплаты.</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <ModernSelect
              value={activeFunnelId || ''}
              onChange={(nextValue) => onSelectFunnel?.(nextValue)}
              options={funnels.map(funnel => ({ value: funnel.id, label: funnel.title }))}
              searchable
              searchPlaceholder="Найти воронку"
              ariaLabel="Выбрать воронку"
              className="flex-1 xl:w-80"
            />
            <button
              onClick={fetchAnalytics}
              disabled={analyticsLoading || !activeFunnelId}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={analyticsLoading ? 'animate-spin' : ''} />
              Обновить
            </button>
            <button
              onClick={runTestFunnel}
              disabled={testRunning || !activeFunnel?.stages?.length}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-4 text-sm text-white shadow-sm transition hover:bg-[#0f69ce] disabled:opacity-50"
            >
              {testRunning ? <Loader2 size={15} className="animate-spin" /> : <TestTube2 size={15} />}
              Пройти тест
            </button>
          </div>
        </div>

        {!activeFunnel ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-800">Пока нет воронок</h2>
            <p className="mt-2 text-sm text-slate-500">Создай первую воронку, и здесь появится аналитика.</p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-medium text-slate-900">{activeFunnel.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      activeFunnel.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {funnelStatusLabel(activeFunnel.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {activeFunnel.stages?.length || 0} {pluralRu(activeFunnel.stages?.length || 0, 'этап', 'этапа', 'этапов')} · данные по уникальным пользователям
                  </p>
                </div>
                <span className="text-xs text-slate-400">Показатели за всё время</span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0">
                {[
                  { label: 'Лиды', value: overview.audience, note: 'всего в воронке' },
                  { label: 'Открыли', value: overview.opened, note: `${openRate}% охват` },
                  { label: 'Досматриваемость', value: `${avgVideoRetention}%`, note: 'чистое удержание видео' },
                  {
                    label: 'Сдали ДЗ',
                    value: overview.homework?.submitted || 0,
                    note: overview.homework?.pending
                      ? `⏳ ${overview.homework.pending} ждут проверки`
                      : `${overview.homework?.approved || 0} одобрено`,
                  },
                  { label: 'Завершили', value: overview.completed, note: `${completionRate}% от всех лидов` },
                  { label: 'Оплатили', value: overview.paid, note: `конверсия ${paymentRate}%` },
                ].map((metric) => (
                  <div key={metric.label} className="min-w-0 px-4 py-5 sm:px-5">
                    <div className="text-xs text-slate-500">{metric.label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{metric.value}</div>
                    <div className="mt-1 truncate text-[11px] text-slate-400">{metric.note}</div>
                  </div>
                ))}
              </div>
            </section>


            {testRunInfo?.error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertTriangle size={16} /> {testRunInfo.error}
              </div>
            )}
            {testRunInfo?.webAppUrl && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Тестовый пользователь создан: chatId {testRunInfo.chatId}. Ссылка открыта в новой вкладке.
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.7fr)]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-medium text-slate-900">Сквозная конверсия</h2>
                  <p className="mt-1 text-xs text-slate-500">Какая доля всей аудитории дошла до каждого действия.</p>
                </div>
                <div className="p-4 sm:p-5">
                  {overview.audience === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">Пока нет пользователей в этой воронке.</div>
                  ) : (
                    <div className="space-y-4">
                      {funnelSteps.map((step, index) => {
                        const widthPct = pct(step.value, overview.audience);
                        return (
                          <div key={step.key} className="grid grid-cols-[28px_minmax(0,1fr)_58px] items-center gap-3 sm:grid-cols-[32px_150px_minmax(0,1fr)_76px]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-500">
                              {index + 1}
                            </span>
                            <div className="hidden min-w-0 sm:block">
                              <div className="truncate text-sm text-slate-700">{step.label}</div>
                              <div className="truncate text-[11px] text-slate-400">{step.description}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="mb-1.5 flex items-center justify-between sm:hidden">
                                <span className="truncate text-xs text-slate-600">{step.label}</span>
                              </div>
                              <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                                <div
                                  className="h-full rounded-lg transition-all duration-500"
                                  style={{ width: `${Math.max(widthPct, step.value ? 3 : 0)}%`, backgroundColor: step.color }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium tabular-nums text-slate-900">{step.value}</div>
                              <div className="text-[11px] tabular-nums text-slate-400">{widthPct}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-medium text-slate-900">Что требует внимания</h2>
                  <p className="mt-1 text-xs text-slate-500">Главная точка потери клиентов.</p>
                </div>
                <div className="p-5">
                  {analytics?.biggestDrop?.lost ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <TrendingDown size={15} />
                        Самый большой отвал
                      </div>
                      <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">−{analytics.biggestDrop.lost}</div>
                      <p className="mt-2 text-sm leading-5 text-slate-700">{analytics.biggestDrop.stageTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{analytics.biggestDrop.label}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-700">
                      Критичных потерь пока не обнаружено.
                    </div>
                  )}

                  <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
                    {[
                      { label: 'Открытие', value: `${openRate}%` },
                      { label: 'Завершение', value: `${completionRate}%` },
                      { label: 'Оплата', value: `${paymentRate}%` },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="font-medium tabular-nums text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            {/* ═══════════ ТЕКУЩЕЕ РАСПРЕДЕЛЕНИЕ СТУДЕНТОВ (ГДЕ БАЗА) ═══════════ */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Users size={16} className="text-[#1677e8]" />
                    Текущее распределение студентов по этапам
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Где прямо сейчас находится база и кто застрял без движения более 48 часов.</p>
                </div>
                {overview.stuckUsers ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
                    <Clock size={13} className="text-amber-600" />
                    <span>{overview.stuckUsers} спят &gt; 48ч</span>
                  </div>
                ) : null}
              </div>

              {/* Сетка этапов с индикатором текущих студентов */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {analytics?.stages?.map((stage) => {
                  const current = stage.currentUsers || 0;
                  const stuck = stage.stuckUsers || 0;
                  const retention = stage.rates.videoRetentionRate ?? pct(stage.viewed, stage.opened);
                  return (
                    <div key={stage.id} className="relative rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500">Шаг {stage.index + 1}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {current} {pluralRu(current, 'студент', 'студента', 'студентов')}
                        </span>
                      </div>
                      <h4 className="mt-1.5 truncate text-xs font-bold text-slate-800">{stage.title}</h4>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Удержание видео: <b className="text-slate-700">{retention}%</b></span>
                        {stuck > 0 && (
                          <span className="font-semibold text-amber-700">💤 {stuck} &gt; 48ч</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium text-slate-900">Эффективность этапов</h2>
                  <p className="mt-1 text-xs text-slate-500">Сравнение ключевых действий, удержания видео и сдачи ДЗ.</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
                  <BarChart3 size={14} />
                  {analytics?.stages?.length || 0} этапа
                </div>
              </div>

              {analyticsLoading && !analytics ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : analytics?.stages?.length ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[960px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-[0.08em] text-slate-400">
                          <th className="px-5 py-3 font-medium">Этап</th>
                          <th className="px-4 py-3 text-right font-medium">Получили</th>
                          <th className="px-4 py-3 text-right font-medium">Открыли</th>
                          <th className="px-4 py-3 text-right font-medium">Досмотрели</th>
                          <th className="px-4 py-3 text-center font-medium">Домашка (Челлендж)</th>
                          <th className="px-4 py-3 text-right font-medium">Завершили</th>
                          <th className="px-4 py-3 text-right font-medium">Оплатили</th>
                          <th className="px-5 py-3 font-medium">Риск</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.stages.map((stage) => {
                          const retention = stage.rates.videoRetentionRate ?? pct(stage.viewed, stage.opened);
                          const hw = stage.homework;
                          return (
                            <tr key={stage.id} className="transition hover:bg-slate-50/60">
                              <td className="max-w-[280px] px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">{stage.index + 1}</span>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-800">{stage.title}</div>
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {stage.currentUsers || 0} сейчас
                                      </span>
                                      {Boolean(stage.stuckUsers) && (
                                        <span className="text-amber-700 font-semibold">• 💤 {stage.stuckUsers} &gt; 48ч</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Получили */}
                              <td className="px-4 py-4 text-right">
                                <div className="text-sm font-medium tabular-nums text-slate-800">{stage.sent}</div>
                                <div className="text-[11px] tabular-nums text-slate-400">100%</div>
                              </td>

                              {/* Открыли */}
                              <td className="px-4 py-4 text-right">
                                <div className="text-sm font-medium tabular-nums text-slate-800">{stage.opened}</div>
                                <div className="text-[11px] tabular-nums text-slate-400">{pct(stage.opened, stage.sent)}%</div>
                              </td>

                              {/* Досмотрели (Чистая досматриваемость видео) */}
                              <td className="px-4 py-4 text-right">
                                <div className="text-sm font-semibold tabular-nums text-indigo-700">{stage.viewed}</div>
                                <div className="text-[11px] font-medium tabular-nums text-indigo-600/80" title="Доля досмотревших от тех, кто открыл урок">
                                  {retention}% удержание
                                </div>
                              </td>

                              {/* Домашка (Челлендж) */}
                              <td className="px-4 py-4 text-center">
                                {hw && (hw.required || hw.submitted > 0) ? (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                      <GraduationCap size={13} className="text-indigo-600" />
                                      <span>Сдано: {hw.submitted}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                      {hw.pending > 0 ? (
                                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                          ⏳ {hw.pending} ждут
                                        </span>
                                      ) : null}
                                      {hw.approved > 0 ? (
                                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                          ✅ {hw.approved}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>

                              {/* Завершили */}
                              <td className="px-4 py-4 text-right">
                                <div className="text-sm font-medium tabular-nums text-slate-800">{stage.completed}</div>
                                <div className="text-[11px] tabular-nums text-slate-400">{pct(stage.completed, stage.sent)}%</div>
                              </td>

                              {/* Оплатили */}
                              <td className="px-4 py-4 text-right">
                                <div className="text-sm font-semibold tabular-nums text-emerald-700">{stage.paid}</div>
                                <div className="text-[11px] tabular-nums text-emerald-600">{pct(stage.paid, stage.sent)}%</div>
                              </td>

                              {/* Риск */}
                              <td className="px-5 py-4">
                                {stage.biggestDrop?.lost ? (
                                  <span className="inline-flex max-w-44 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                                    <TrendingDown size={12} />
                                    <span className="truncate">−{stage.biggestDrop.lost}: {stage.biggestDrop.label}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Нет риска</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-slate-100 md:hidden">
                    {analytics.stages.map((stage) => {
                      const retention = stage.rates.videoRetentionRate ?? pct(stage.viewed, stage.opened);
                      const hw = stage.homework;
                      return (
                        <div key={stage.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">{stage.index + 1}</span>
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold leading-5 text-slate-800">{stage.title}</h3>
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                                  <span>🟢 {stage.currentUsers || 0} сейчас</span>
                                  {Boolean(stage.stuckUsers) && <span className="text-amber-700">• 💤 {stage.stuckUsers} &gt; 48ч</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {retention}% видео
                            </span>
                          </div>

                          {hw && (hw.required || hw.submitted > 0) && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                              <GraduationCap size={14} className="text-indigo-600" />
                              <span className="font-semibold text-slate-700">ДЗ: Сдано {hw.submitted}</span>
                              {hw.pending > 0 && <span className="text-amber-700 font-bold">• ⏳ {hw.pending} ждут</span>}
                              {hw.approved > 0 && <span className="text-emerald-700 font-bold">• ✅ {hw.approved}</span>}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            {[
                              { label: 'Открыли', value: stage.opened, rate: pct(stage.opened, stage.sent) },
                              { label: 'Завершили', value: stage.completed, rate: pct(stage.completed, stage.sent) },
                              { label: 'Оплатили', value: stage.paid, rate: pct(stage.paid, stage.sent) },
                            ].map((cell) => (
                              <div key={cell.label} className="rounded-xl bg-slate-50 px-2 py-2.5">
                                <div className="text-sm font-bold tabular-nums text-slate-800">{cell.value}</div>
                                <div className="mt-0.5 text-[10px] text-slate-400">{cell.label} · {cell.rate}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-14 text-center">
                  <h3 className="text-sm font-medium text-slate-700">Пока нет данных</h3>
                  <p className="mt-2 text-sm text-slate-500">Запусти тестовый режим или дождись первых пользователей.</p>
                </div>
              )}
            </section>


            <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[0.8fr_1.2fr]">
              <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                <p className="text-xs text-slate-500">Возврат через кнопку в чате</p>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{analytics?.profileAnalytics?.continueRate || 0}%</div>
                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">Доля пользователей, которые открыли профиль и вернулись к текущему уроку.</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                {profileMetricCards.map((metric) => (
                  <div key={metric.label} className="min-w-0 p-4 sm:p-5">
                    <div className="text-xl font-semibold tabular-nums text-slate-900">{metric.value}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-500">{metric.label}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
