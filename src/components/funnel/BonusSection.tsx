import React from 'react';
import { Gift, Plus, Trash2, Coins } from 'lucide-react';
import type { BonusReward, Funnel } from '../../types/funnel';
import ModernSelect from '../ui/ModernSelect';

interface BonusSectionProps {
  funnel: Funnel;
  onChange: (platform: Funnel['platform']) => void;
}

export default function BonusSection({ funnel, onChange }: BonusSectionProps) {
  const bonus = funnel.platform?.bonus;
  const enabled = Boolean(bonus?.enabled);
  const rewards = bonus?.rewards || [];
  const currency = bonus?.currencyLabel || 'бонусов';

  const patch = (changes: Partial<NonNullable<Funnel['platform']>['bonus']>) => {
    onChange({
      ...(funnel.platform || {}),
      bonus: { enabled, ...(bonus || {}), ...changes } as NonNullable<NonNullable<Funnel['platform']>['bonus']>,
    });
  };

  const patchReward = (id: string, changes: Partial<BonusReward>) => {
    patch({ rewards: rewards.map(reward => (reward.id === id ? { ...reward, ...changes } : reward)) });
  };

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Coins size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Бонусы за действия</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
              Ученик получает бонусы за пройденный урок и ответ на вопрос, а тратит их на награды.
            </p>
          </div>
        </div>
        <button
          onClick={() => patch({ enabled: !enabled })}
          className={`inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black transition ${
            enabled ? 'bg-emerald-400 text-slate-900 hover:bg-emerald-300' : 'bg-white text-slate-900 hover:bg-slate-100'
          }`}
        >
          {enabled ? 'Включены' : 'Включить'}
        </button>
      </div>

      {enabled && (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">За урок</label>
              <input
                type="number"
                min={0}
                max={10000}
                value={bonus?.perLesson ?? 0}
                onChange={event => patch({ perLesson: Math.max(0, Number(event.target.value) || 0) })}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">За ответ на вопрос</label>
              <input
                type="number"
                min={0}
                max={10000}
                value={bonus?.perQuestion ?? 0}
                onChange={event => patch({ perQuestion: Math.max(0, Number(event.target.value) || 0) })}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Как называем</label>
              <input
                value={currency}
                onChange={event => patch({ currencyLabel: event.target.value.slice(0, 24) })}
                placeholder="бонусов"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                На что тратить
              </div>
              <button
                onClick={() => patch({
                  rewards: [...rewards, {
                    id: `reward-${Date.now().toString(36)}`,
                    title: 'Новая награда',
                    price: 500,
                  }],
                })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white transition hover:bg-slate-700"
              >
                <Plus size={14} /> Награда
              </button>
            </div>

            {rewards.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[13px] text-slate-400">
                Наград пока нет. Без них бонусы копятся в никуда — и не мотивируют.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {rewards.map(reward => (
                  <div key={reward.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start gap-2">
                      <Gift size={16} className="mt-3 shrink-0 text-slate-300" />
                      <input
                        value={reward.title}
                        onChange={event => patchReward(reward.id, { title: event.target.value })}
                        placeholder="Название награды"
                        className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                      />
                      <button
                        onClick={() => patch({ rewards: rewards.filter(item => item.id !== reward.id) })}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                        aria-label="Удалить награду"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <input
                      value={reward.description || ''}
                      onChange={event => patchReward(reward.id, { description: event.target.value.slice(0, 200) })}
                      placeholder="Короткое описание"
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />

                    <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_180px]">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Цена</label>
                        <input
                          type="number"
                          min={0}
                          value={reward.price}
                          onChange={event => patchReward(reward.id, { price: Math.max(0, Number(event.target.value) || 0) })}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Что получает</label>
                        <input
                          value={reward.payload || ''}
                          onChange={event => patchReward(reward.id, { payload: event.target.value || undefined })}
                          placeholder="Ссылка, промокод или инструкция"
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Кому</label>
                        <div className="mt-1">
                          <ModernSelect
                            value={reward.minTier || 'pkg-1'}
                            onChange={value => patchReward(reward.id, { minTier: value === 'pkg-2' ? 'pkg-2' : 'pkg-1' })}
                            options={[
                              { value: 'pkg-1', label: 'Всем оплатившим' },
                              { value: 'pkg-2', label: 'Только IT-Владелец' },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Начисление идёт один раз за конкретный урок или вопрос: повторное нажатие ничего не добавит.
            Содержимое награды ученик видит только после обмена, а цену списывает сервер — подменить её из браузера нельзя.
          </p>
        </div>
      )}
    </div>
  );
}
