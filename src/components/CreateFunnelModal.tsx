import React, { useEffect, useState } from 'react';
import { Bot, Check, FilePlus2, GraduationCap, Layers3, ShoppingBag, X } from 'lucide-react';
import ModernSelect from './ui/ModernSelect';

export type FunnelTemplate = 'blank' | 'lead' | 'course' | 'sales';

export interface CreateFunnelConfig {
  title: string;
  template: FunnelTemplate;
  connectedBotId?: string;
}

interface CreateFunnelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (config: CreateFunnelConfig) => void;
}

const templates: Array<{
  id: FunnelTemplate;
  title: string;
  description: string;
  stages: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'blank',
    title: 'С нуля',
    description: 'Один пустой этап без лишней логики.',
    stages: '1 этап',
    icon: <FilePlus2 size={18} />,
  },
  {
    id: 'lead',
    title: 'Лид-магнит',
    description: 'Знакомство, выдача материала и следующий шаг.',
    stages: '3 этапа',
    icon: <Layers3 size={18} />,
  },
  {
    id: 'course',
    title: 'Продающий урок',
    description: 'Один бесплатный видеоурок с предложением трипваера.',
    stages: '1 этап',
    icon: <GraduationCap size={18} />,
  },
  {
    id: 'sales',
    title: 'Продажа услуги',
    description: 'Квалификация, ценность и предложение созвона.',
    stages: '3 этапа',
    icon: <ShoppingBag size={18} />,
  },
];

export default function CreateFunnelModal({ open, onClose, onCreate }: CreateFunnelModalProps) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<FunnelTemplate>('blank');
  const [connectedBotId, setConnectedBotId] = useState('');
  const [bots, setBots] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setTemplate('blank');
    setConnectedBotId('');
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setBots(Array.isArray(data?.bots) ? data.bots : []))
      .catch(() => setBots([]));
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onCreate({
      title: cleanTitle,
      template,
      connectedBotId: connectedBotId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Закрыть создание воронки"
      />

      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Новая воронка</h2>
            <p className="mt-1 text-sm text-slate-500">Выбери основу — все сообщения и переходы можно изменить.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <label className="mb-2 block text-xs font-medium text-slate-500">Название воронки</label>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Запись на консультацию"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />

          <div className="mb-3 mt-6 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">Структура</label>
            <span className="text-[11px] text-slate-400">Можно добавлять и удалять этапы</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((item) => {
              const selected = template === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={`relative rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{item.title}</span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-500">{item.stages}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    </div>
                    {selected && (
                      <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <label className="mb-2 mt-6 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Bot size={14} />
            Telegram-бот
          </label>
          <ModernSelect
            value={connectedBotId}
            onChange={setConnectedBotId}
            options={[
              { value: '', label: 'Подключить позже' },
              ...bots.map(bot => ({ value: bot.id, label: `${bot.firstName || bot.name} (@${bot.name})` })),
            ]}
            searchable
            searchPlaceholder="Найти бота"
            buttonClassName="h-12"
            ariaLabel="Telegram-бот"
          />
          <p className="mt-2 text-[11px] leading-4 text-slate-400">
            Воронка создаётся как черновик. Запустить её можно после проверки сообщений и переходов.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="h-11 rounded-xl bg-slate-900 px-6 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Создать и открыть
          </button>
        </div>
      </form>
    </div>
  );
}
