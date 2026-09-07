import React, { useMemo, useState } from 'react';
import { ExternalLink, LifeBuoy, Route } from 'lucide-react';
import BonusSection from './funnel/BonusSection';
import HomeworkSection from './funnel/HomeworkSection';
import PlatformAboutCard from './funnel/PlatformAboutCard';
import PlatformPreview from './funnel/PlatformPreview';
import ProgramSection from './funnel/ProgramSection';
import { openPreviewWindow } from './funnel/platformPreviewChannel';
import SessionsSection from './funnel/SessionsSection';
import StudentsSection from './funnel/StudentsSection';
import { DEFAULT_TIER_LABELS } from './platform/defaultProgram';
import ModernSelect from './ui/ModernSelect';
import type { Funnel } from '../types/funnel';

interface PlatformSettingsPageProps {
  funnels: any[];
  selectedFunnelId?: string | null;
  onSelectFunnel?: (id: string) => void;
  onUpdateFunnel?: (funnel: Funnel) => void;
  onOpenFunnel?: (id: string) => void;
}

type TabKey = 'program' | 'sessions' | 'bonus' | 'students';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'program', label: 'Программа' },
  { key: 'sessions', label: 'Эфиры и куратор' },
  { key: 'bonus', label: 'Бонусы' },
  { key: 'students', label: 'Ученики' },
];

// Настройки платной платформы жили в середине редактора воронки: чтобы поправить
// ссылку на куратора, приходилось пролистывать все этапы. Здесь они собраны
// отдельной страницей, а к какой воронке относятся — выбирается сверху.
export default function PlatformSettingsPage({
  funnels,
  selectedFunnelId,
  onSelectFunnel,
  onUpdateFunnel,
  onOpenFunnel,
}: PlatformSettingsPageProps) {
  const [tab, setTab] = useState<TabKey>('program');
  const activeFunnelId = selectedFunnelId || funnels[0]?.id || null;
  const funnel = useMemo(
    () => funnels.find(item => item.id === activeFunnelId) || funnels[0] || null,
    [funnels, activeFunnelId],
  );

  // Названия воронок длинные и в списке обрезаются: у копий видно один и тот же
  // «Первый шаг в вайб-код…». Подпись говорит, что у воронки уже настроено.
  const options = funnels.map(item => {
    const sessions = item.platform?.sessions?.length || 0;
    const lessons = item.platform?.lessons?.length || 0;
    const parts = [
      item.status === 'active' ? 'Активна' : item.status === 'archived' ? 'Архив' : 'Черновик',
      lessons ? `уроков: ${lessons}` : 'программа по умолчанию',
      sessions ? `эфиров: ${sessions}` : 'без эфиров',
      item.platform?.bonus?.enabled ? 'бонусы вкл.' : 'бонусы выкл.',
    ];
    return { value: item.id, label: item.title, description: parts.join(' · ') };
  });

  const updatePlatform = (platform: Funnel['platform']) => {
    if (!funnel) return;
    onUpdateFunnel?.({ ...funnel, platform });
  };

  const tierLabels: Record<'pkg-1' | 'pkg-2', string> = {
    'pkg-1': (funnel?.platform?.tiers?.['pkg-1']?.label || '').trim() || DEFAULT_TIER_LABELS['pkg-1'],
    'pkg-2': (funnel?.platform?.tiers?.['pkg-2']?.label || '').trim() || DEFAULT_TIER_LABELS['pkg-2'],
  };

  // Предпросмотр честнее боевой ссылки: платформа открывается только внутри
  // Telegram, а `chatId=123` в браузере упёрся бы в экран «откройте через бота».
  const previewUrl = funnel
    ? `/?funnel=${encodeURIComponent(funnel.id)}&stage=platform&preview=phone`
    : '';

  return (
    <div className="admin-page flex-1 min-w-0 overflow-y-auto bg-[#f6f7f9] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5 pb-16">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">После оплаты</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Платформа</h1>
            <p className="mt-1 text-sm text-slate-500">
              Программа, эфиры, бонусы и ученики закрытой платформы. Настройки хранятся у выбранной воронки.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <ModernSelect
              value={activeFunnelId || ''}
              onChange={(nextValue) => onSelectFunnel?.(nextValue)}
              options={options}
              searchable
              searchPlaceholder="Найти воронку"
              ariaLabel="Выбрать воронку"
              className="flex-1 xl:w-80"
            />
            <button
              onClick={() => funnel && onOpenFunnel?.(funnel.id)}
              disabled={!funnel}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Route size={15} />
              К воронке
            </button>
            <button
              onClick={() => openPreviewWindow(previewUrl)}
              disabled={!funnel}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-4 text-sm text-white shadow-sm transition hover:bg-[#0f69ce] disabled:opacity-50"
            >
              <ExternalLink size={15} />
              Открыть платформу
            </button>
          </div>
        </div>

        {!funnel ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-800">Пока нет воронок</h2>
            <p className="mt-2 text-sm text-slate-500">Создайте воронку — платформа настраивается для неё.</p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                {TABS.map(item => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`h-10 flex-1 rounded-xl px-3 text-[13px] font-bold transition ${
                      tab === item.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === 'program' && (
                <>
                  <ProgramSection funnel={funnel as Funnel} onChange={updatePlatform} />
                  <PlatformAboutCard funnel={funnel as Funnel} />
                </>
              )}

              {tab === 'sessions' && (
                <>
                  <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                    <label className="block">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <LifeBuoy size={12} /> Чат куратора
                      </span>
                      <input
                        value={funnel.platform?.curatorUrl || ''}
                        onChange={event => updatePlatform({
                          ...(funnel.platform || {}),
                          curatorUrl: event.target.value.trim() || undefined,
                        })}
                        placeholder="https://t.me/ваш_чат"
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                      />
                    </label>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-400">
                      Кнопка «Нужна помощь?» внизу платформы. Пока поле пустое, блок ученику не показывается.
                    </p>
                  </div>

                  <SessionsSection funnel={funnel as Funnel} onChange={updatePlatform} />
                </>
              )}

              {tab === 'bonus' && <BonusSection funnel={funnel as Funnel} onChange={updatePlatform} />}

              {tab === 'students' && (
                <>
                  <StudentsSection funnelId={funnel.id} tierLabels={tierLabels} />
                  <HomeworkSection funnelId={funnel.id} />
                </>
              )}
            </div>

            <div className="justify-self-center xl:sticky xl:top-8 xl:justify-self-end">
              <PlatformPreview funnel={funnel as Funnel} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
