import React from 'react';
import { Video, Plus, Trash2, Link2, PlayCircle, Crown } from 'lucide-react';
import type { Funnel, LiveSession } from '../../types/funnel';
import CopyButton from '../ui/CopyButton';
import DateTimePicker from '../ui/DateTimePicker';
import ModernSelect from '../ui/ModernSelect';

interface SessionsSectionProps {
  funnel: Funnel;
  onChange: (platform: Funnel['platform']) => void;
}

// DateTimePicker работает с локальным `YYYY-MM-DDTHH:mm`, а храним мы ISO:
// иначе у эфира «поедет» время между часовыми поясами сервера и браузера.
function toPickerValue(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromPickerValue(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default function SessionsSection({ funnel, onChange }: SessionsSectionProps) {
  const sessions = funnel.platform?.sessions || [];

  const save = (next: LiveSession[]) => onChange({ ...(funnel.platform || {}), sessions: next });

  const addSession = () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    startsAt.setMinutes(0, 0, 0);
    save([
      {
        id: `session-${Date.now().toString(36)}`,
        title: 'Новый эфир',
        startsAt: startsAt.toISOString(),
        durationMin: 60,
        minTier: 'pkg-1',
      },
      ...sessions,
    ]);
  };

  const patch = (id: string, changes: Partial<LiveSession>) => {
    save(sessions.map(session => (session.id === id ? { ...session, ...changes } : session)));
  };

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Video size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Эфиры платформы</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
              До эфира ученик видит анонс и ссылку на подключение, после — запись.
            </p>
          </div>
        </div>
        <button
          onClick={addSession}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100"
        >
          <Plus size={16} /> Эфир
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="p-6 text-center text-[13px] text-slate-400">
          Эфиров пока нет. Добавьте первый — он появится в платной платформе у всех, кто оплатил.
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          {sessions.map(session => (
            <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-2">
                <input
                  value={session.title}
                  onChange={event => patch(session.id, { title: event.target.value })}
                  placeholder="Название эфира"
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                />
                <button
                  onClick={() => save(sessions.filter(item => item.id !== session.id))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                  aria-label="Удалить эфир"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <textarea
                value={session.description || ''}
                onChange={event => patch(session.id, { description: event.target.value.slice(0, 600) })}
                rows={2}
                placeholder="О чём эфир — пара строк для анонса"
                className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-5 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_180px]">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Начало</label>
                  <div className="mt-1.5">
                    <DateTimePicker
                      value={toPickerValue(session.startsAt)}
                      onChange={value => patch(session.id, { startsAt: fromPickerValue(value) })}
                      ariaLabel="Дата и время эфира"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Минут</label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    value={session.durationMin ?? 60}
                    onChange={event => patch(session.id, {
                      durationMin: Math.min(480, Math.max(15, Number(event.target.value) || 60)),
                    })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Кому доступен</label>
                  <div className="mt-1.5">
                    <ModernSelect
                      value={session.minTier || 'pkg-1'}
                      onChange={value => patch(session.id, { minTier: value === 'pkg-2' ? 'pkg-2' : 'pkg-1' })}
                      options={[
                        { value: 'pkg-1', label: 'Всем оплатившим' },
                        { value: 'pkg-2', label: 'Только IT-Владелец' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Link2 size={12} /> Ссылка на подключение
                  </span>
                  <div className="mt-1.5 flex items-center gap-1">
                    <input
                      value={session.joinUrl || ''}
                      onChange={event => patch(session.id, { joinUrl: event.target.value.trim() || undefined })}
                      placeholder="https://us02web.zoom.us/j/..."
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />
                    <CopyButton value={session.joinUrl || ''} title="Скопировать ссылку для ученика" />
                  </div>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <PlayCircle size={12} /> Запись
                  </span>
                  <div className="mt-1.5 flex items-center gap-1">
                    <input
                      value={session.recordingUrl || ''}
                      onChange={event => patch(session.id, { recordingUrl: event.target.value.trim() || undefined })}
                      placeholder="Ссылка на запись после эфира"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />
                    <CopyButton value={session.recordingUrl || ''} title="Скопировать ссылку на запись" />
                  </div>
                </label>
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-slate-400">
                <Crown size={12} className="mt-px shrink-0" />
                Пока эфир не начался, ученик видит ссылку на подключение. После начала вместо неё показывается запись — если она добавлена.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
