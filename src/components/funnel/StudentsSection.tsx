import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface PlatformStudent {
  chatId: number;
  name: string;
  tier: 'pkg-1' | 'pkg-2';
  completed: number;
  total: number | null;
  lastActionAt: string | null;
  pendingHomework: number;
  stale: boolean;
}

interface PlatformStats {
  paid: number;
  byTier: Record<'pkg-1' | 'pkg-2', number>;
  started: number;
  finished: number;
  stale: number;
  avgLessons: number;
  pendingHomework: number;
  students: PlatformStudent[];
}

interface StudentsSectionProps {
  funnelId: string;
  tierLabels: Record<'pkg-1' | 'pkg-2', string>;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Кто уже внутри платформы. Раньше этих цифр на странице не было вовсе:
// чтобы понять, дошёл ли хоть один оплативший до уроков, приходилось идти
// в аналитику этапов и складывать всё в голове.
export default function StudentsSection({ funnelId, tierLabels }: StudentsSectionProps) {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await apiFetch<PlatformStats>(`/api/funnels/${funnelId}/platform-stats`));
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [funnelId]);

  const tiles = stats ? [
    { label: 'Оплатили', value: stats.paid, hint: `${tierLabels['pkg-1']}: ${stats.byTier['pkg-1']} · ${tierLabels['pkg-2']}: ${stats.byTier['pkg-2']}` },
    { label: 'Приступили', value: stats.started, hint: 'Отметили хотя бы один урок' },
    { label: 'Прошли всё', value: stats.finished, hint: 'По программе своего тарифа' },
    { label: 'Молчат неделю', value: stats.stale, hint: 'Ни одного действия 7 дней' },
    { label: 'Уроков в среднем', value: stats.avgLessons, hint: 'На одного оплатившего' },
    { label: 'ДЗ на проверке', value: stats.pendingHomework, hint: 'Ждут решения куратора' },
  ] : [];

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Users size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Кто уже внутри</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
              Оплатившие, их прогресс по урокам и те, кто перестал заходить.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Обновить
        </button>
      </div>

      {error ? (
        <div className="p-6 text-center text-[13px] font-semibold text-rose-600">{error}</div>
      ) : !stats ? (
        <div className="p-6 text-center text-[13px] text-slate-400">Загружаем…</div>
      ) : stats.paid === 0 ? (
        <div className="p-6 text-center text-[13px] text-slate-400">
          Платформу пока никто не открыл — здесь появятся все, кто оплатил.
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {tiles.map(tile => (
              <div key={tile.label} className="rounded-2xl border border-slate-200 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tile.label}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{tile.value}</div>
                <div className="mt-1 text-[11px] leading-4 text-slate-400">{tile.hint}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-2 pr-3 font-bold">Ученик</th>
                  <th className="pb-2 pr-3 font-bold">Тариф</th>
                  <th className="pb-2 pr-3 font-bold">Прогресс</th>
                  <th className="pb-2 pr-3 font-bold">Последнее действие</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map(student => (
                  <tr key={student.chatId} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-800">{student.name}</div>
                      {student.pendingHomework > 0 && (
                        <div className="text-[11px] font-semibold text-amber-600">
                          ДЗ на проверке: {student.pendingHomework}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{tierLabels[student.tier]}</td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {student.completed}{student.total !== null ? ` из ${student.total}` : ''}
                    </td>
                    <td className={`py-2.5 pr-3 ${student.stale ? 'text-amber-600' : 'text-slate-500'}`}>
                      {formatDate(student.lastActionAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
