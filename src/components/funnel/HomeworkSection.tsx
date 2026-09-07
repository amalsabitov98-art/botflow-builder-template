import React, { useEffect, useState } from 'react';
import { Check, ClipboardCheck, Loader2, RefreshCw, Undo2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import ModernSelect from '../ui/ModernSelect';

type HomeworkStatus = 'pending_review' | 'approved' | 'rejected';

interface HomeworkItem {
  chatId: number;
  name: string;
  stageId: string;
  stageTitle: string;
  content: string;
  aiFeedback: string;
  status: HomeworkStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerComment: string;
}

interface HomeworkResponse {
  pending: number;
  items: HomeworkItem[];
}

interface HomeworkSectionProps {
  funnelId: string;
}

const STATUS_LABELS: Record<HomeworkStatus, string> = {
  pending_review: 'На проверке',
  approved: 'Принято',
  rejected: 'На доработке',
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Проверка домашних заданий. До этого решение можно было принять только
// кнопкой в Telegram у куратора: если сообщение утонуло в переписке, работа
// висела на проверке вечно, а ученик ждал открытия следующего урока.
export default function HomeworkSection({ funnelId }: HomeworkSectionProps) {
  const [filter, setFilter] = useState<'pending_review' | 'all'>('pending_review');
  const [data, setData] = useState<HomeworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const keyOf = (item: HomeworkItem) => `${item.chatId}:${item.stageId}`;

  const load = async (status = filter) => {
    setLoading(true);
    setError('');
    try {
      setData(await apiFetch<HomeworkResponse>(`/api/funnels/${funnelId}/homeworks?status=${status}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить домашние задания');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [funnelId, filter]);

  const review = async (item: HomeworkItem, status: 'approved' | 'rejected') => {
    const key = keyOf(item);
    setBusyKey(key);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch<{ notified: boolean }>(`/api/funnels/${funnelId}/homeworks/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: item.chatId, stageId: item.stageId, status, comment: comments[key] || '' }),
      });
      // Решение уже сохранено, даже если бот промолчал: об этом честно говорим,
      // иначе куратор будет думать, что ученик всё узнал.
      setNotice(result.notified
        ? status === 'approved' ? 'Принято, ученику отправлено сообщение.' : 'Отправлено на доработку, ученик уведомлён.'
        : 'Решение сохранено, но сообщение ученику не ушло — проверьте подключение бота.');
      setComments(current => ({ ...current, [key]: '' }));
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить решение');
    } finally {
      setBusyKey('');
    }
  };

  const items = data?.items || [];

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <ClipboardCheck size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Домашние задания</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
              Решение здесь делает то же, что кнопки у куратора в Telegram: пишет ученику и открывает следующий этап.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ModernSelect
            value={filter}
            onChange={value => setFilter(value === 'all' ? 'all' : 'pending_review')}
            options={[
              { value: 'pending_review', label: 'На проверке' },
              { value: 'all', label: 'Все' },
            ]}
            className="w-40"
            buttonClassName="border-transparent bg-white/10 text-white hover:bg-white/15"
            ariaLabel="Фильтр домашних заданий"
          />
          <button
            onClick={() => load(filter)}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-[13px] font-semibold text-rose-700" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-[13px] font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 text-center text-[13px] text-slate-400">
          {loading ? 'Загружаем…' : filter === 'pending_review'
            ? 'Непроверенных работ нет.'
            : 'Домашних заданий пока не присылали.'}
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          {items.map(item => {
            const key = keyOf(item);
            const busy = busyKey === key;
            return (
              <div key={key} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-800">{item.name}</div>
                    <div className="text-[12px] text-slate-400">
                      {item.stageTitle}
                      {item.submittedAt ? ` · ${formatDate(item.submittedAt)}` : ''}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                    item.status === 'pending_review'
                      ? 'bg-amber-100 text-amber-700'
                      : item.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>

                <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[13px] leading-5 text-slate-700">
                  {item.content || '— (работа пришла без текста)'}
                </div>

                {item.aiFeedback && (
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">
                    <span className="font-bold uppercase tracking-wider">ИИ:</span> {item.aiFeedback}
                  </p>
                )}

                {item.reviewerComment && item.status !== 'pending_review' && (
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    Комментарий куратора: {item.reviewerComment}
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={comments[key] || ''}
                    onChange={event => setComments(current => ({ ...current, [key]: event.target.value.slice(0, 1000) }))}
                    placeholder="Комментарий — уйдёт ученику при доработке"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                  />
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => review(item, 'approved')}
                      disabled={busy}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-[13px] font-black text-white transition hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Принять
                    </button>
                    <button
                      onClick={() => review(item, 'rejected')}
                      disabled={busy}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Undo2 size={15} />
                      На доработку
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
