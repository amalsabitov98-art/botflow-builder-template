import React, { useEffect, useState } from 'react';
import { Bot, AlertTriangle, LifeBuoy, RefreshCcw, CreditCard, MessageCircle, BellRing, CalendarClock } from 'lucide-react';
import type { FunnelAssistant } from '../../types/funnel';

interface AssistantSettingsProps {
    assistant?: FunnelAssistant;
    onChange: (next: FunnelAssistant) => void;
}

const DEFAULT_DAILY_LIMIT = 30;

function Toggle({ checked, onChange, label, hint, icon: Icon }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    hint: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                checked ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
        >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                checked ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
                <Icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800">{label}</div>
                <div className="mt-0.5 text-xs leading-5 text-slate-500">{hint}</div>
            </div>
            <div className={`mt-1 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${checked ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
            </div>
        </button>
    );
}

export default function AssistantSettings({ assistant, onChange }: AssistantSettingsProps) {
    const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
    const enabled = Boolean(assistant?.enabled);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/settings')
            .then(response => (response.ok ? response.json() : null))
            .then(data => { if (!cancelled) setKeyConfigured(Boolean(data?.assistantConfigured)); })
            .catch(() => { if (!cancelled) setKeyConfigured(null); });
        return () => { cancelled = true; };
    }, []);

    const patch = (changes: Partial<FunnelAssistant>) => {
        onChange({ enabled, ...assistant, ...changes });
    };

    return (
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <Bot size={20} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-white">ИИ-ассистент воронки</h3>
                        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
                            Отвечает подписчику, когда тот пишет боту сам. Видит его этап, прогресс и оплату.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => patch({ enabled: !enabled })}
                    className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                        enabled ? 'bg-emerald-400 text-slate-900 hover:bg-emerald-300' : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    {enabled ? 'Включён' : 'Включить'}
                </button>
            </div>

            {enabled && (
                <div className="space-y-5 p-4 sm:p-6">
                    {keyConfigured === false && (
                        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                            <AlertTriangle size={15} className="mt-px shrink-0" />
                            <span>
                                Ключ DeepSeek не задан — ассистент включён, но отвечать не будет.
                                Добавьте его в разделе <strong>Настройки</strong>.
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            О чём воронка и как отвечать
                        </label>
                        <textarea
                            value={assistant?.systemPrompt || ''}
                            onChange={event => patch({ systemPrompt: event.target.value.slice(0, 4000) })}
                            rows={5}
                            placeholder="Например: продаём курс по автоматизации Telegram-воронок за 4900 ₽. Отвечай дружелюбно и на «ты». Если спрашивают про рассрочку — передавай человеку."
                            className="mt-3 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        />
                        <p className="mt-2 text-xs text-slate-400">
                            Этапы, тексты и цены ассистент берёт из воронки сам — здесь нужны только тон и границы.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Что ассистент делает
                        </div>

                        <Toggle
                            icon={BellRing}
                            checked={Boolean(assistant?.personalizeReminders)}
                            onChange={value => patch({ personalizeReminders: value })}
                            label="Персонализирует напоминания"
                            hint="Переписывает текст дожима под конкретного человека: что он открыл, где остановился, платил ли. Если ИИ не ответит, уйдёт исходный текст напоминания."
                        />
                        <Toggle
                            icon={MessageCircle}
                            checked={assistant?.replyToMessages !== false}
                            onChange={value => patch({ replyToMessages: value })}
                            label="Отвечает на сообщения подписчиков"
                            hint="Когда человек пишет боту сам. Выключите, если нужен только персонализированный дожим."
                        />
                        <Toggle
                            icon={CalendarClock}
                            checked={Boolean(assistant?.nurtureEnabled)}
                            onChange={value => patch({ nurtureEnabled: value })}
                            label="Ведёт долгий дожим"
                            hint="Сам решает, когда написать замолчавшему: раз в несколько дней, пока человек не купит, не попросит перестать или не кончатся касания."
                        />

                        {assistant?.nurtureEnabled && (
                            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                                {([
                                    ['nurtureMaxTouches', 'Касаний максимум', 6, 1, 20],
                                    ['nurtureMinGapHours', 'Часов между ними', 72, 12, 336],
                                    ['nurtureWindowDays', 'Дней всего', 30, 1, 120],
                                ] as const).map(([field, label, fallback, min, max]) => (
                                    <div key={field}>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
                                        <input
                                            type="number"
                                            min={min}
                                            max={max}
                                            value={assistant?.[field] ?? fallback}
                                            onChange={event => patch({
                                                [field]: Math.min(max, Math.max(min, Number(event.target.value) || fallback)),
                                            })}
                                            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>
                                ))}
                                <p className="text-xs leading-5 text-slate-400 sm:col-span-3">
                                    Пределы проверяются на сервере: ассистент не может написать чаще или больше,
                                    чем здесь указано. Ночью касания переносятся на утро, а просьба не писать
                                    останавливает дожим сразу.
                                </p>
                            </div>
                        )}
                    </div>

                    {assistant?.replyToMessages !== false && (
                    <div className="space-y-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Что ассистенту разрешено в переписке
                        </div>

                        <Toggle
                            icon={LifeBuoy}
                            checked
                            onChange={() => undefined}
                            label="Передавать разговор человеку"
                            hint="Всегда включено. Подписчик появится в «Аудитории» с пометкой, что ждёт оператора."
                        />
                        <Toggle
                            icon={RefreshCcw}
                            checked={Boolean(assistant?.allowResendStage)}
                            onChange={value => patch({ allowResendStage: value })}
                            label="Повторно отправлять этап"
                            hint="Только те этапы, которые подписчик уже получал. Вперёд по воронке ассистент никого не пропустит."
                        />
                        <Toggle
                            icon={CreditCard}
                            checked={Boolean(assistant?.allowPaymentLink)}
                            onChange={value => patch({ allowPaymentLink: value })}
                            label="Давать ссылку на оплату"
                            hint="Ссылку и цену подставляет сервер из настроек этапа — назвать свою сумму или скидку ассистент не может."
                        />
                    </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <label className="text-sm font-bold text-slate-700">Не больше</label>
                        <input
                            type="number"
                            min={1}
                            max={200}
                            value={assistant?.dailyMessageLimit || DEFAULT_DAILY_LIMIT}
                            onChange={event => patch({
                                dailyMessageLimit: Math.min(200, Math.max(1, Number(event.target.value) || DEFAULT_DAILY_LIMIT)),
                            })}
                            className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                        />
                        <label className="text-sm font-bold text-slate-700">обращений к ИИ на подписчика в сутки</label>
                    </div>
                </div>
            )}
        </div>
    );
}
