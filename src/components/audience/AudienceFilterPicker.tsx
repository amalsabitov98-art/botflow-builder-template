import React, { useEffect, useState } from 'react';
import { Filter, Loader2, X } from 'lucide-react';
import { NO_SOURCE, isEmptyAudienceFilter, type AudienceFilter } from '../../../shared/audience';

interface FilterOptions {
    answers: Array<{ key: string; label: string; options: Array<{ id: string; label: string }> }>;
    sources: Array<{ value: string; count: number }>;
    withoutSource: number;
}

interface AudienceFilterPickerProps {
    value: AudienceFilter;
    onChange: (filter: AudienceFilter) => void;
    funnelId?: string;
    disabled?: boolean;
}

const EMPTY_OPTIONS: FilterOptions = { answers: [], sources: [], withoutSource: 0 };

/**
 * Отбор поверх сегмента: по ответам на вопросы воронки и по метке диплинка.
 * Внутри одного вопроса варианты складываются по «или», между вопросами — по «и».
 */
export default function AudienceFilterPicker({ value, onChange, funnelId, disabled }: AudienceFilterPickerProps) {
    const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        const query = funnelId && funnelId !== 'all' ? `?funnelId=${encodeURIComponent(funnelId)}` : '';
        fetch(`/api/audience/filter-options${query}`)
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Не удалось загрузить условия отбора');
                if (active) setOptions({ ...EMPTY_OPTIONS, ...data });
            })
            .catch((cause: any) => { if (active) setError(cause.message || 'Не удалось загрузить условия отбора'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [funnelId]);

    const toggleAnswer = (key: string, optionId: string) => {
        const current = value.answers?.[key] || [];
        const next = current.includes(optionId)
            ? current.filter(item => item !== optionId)
            : [...current, optionId];
        const answers = { ...(value.answers || {}) };
        if (next.length) answers[key] = next;
        else delete answers[key];
        onChange({ ...value, answers });
    };

    const toggleSource = (source: string) => {
        const current = value.sources || [];
        const next = current.includes(source)
            ? current.filter(item => item !== source)
            : [...current, source];
        onChange({ ...value, sources: next });
    };

    const chosenCount = Object.values(value.answers || {}).reduce((sum, list) => sum + list.length, 0)
        + (value.sources || []).length;

    const hasSomethingToFilter = options.answers.length > 0 || options.sources.length > 0 || options.withoutSource > 0;

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Загружаем условия отбора
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-600">
                {error}
            </div>
        );
    }

    if (!hasSomethingToFilter) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-semibold leading-5 text-slate-400">
                Отбирать пока не по чему: воронка ещё не задавала вопросов, а подписчики приходили без меток.
            </div>
        );
    }

    const chipClass = (active: boolean) => [
        'rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition',
        active
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
        disabled ? 'cursor-not-allowed opacity-60' : '',
    ].join(' ');

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Filter size={13} />
                    Сузить по анкете и источнику
                </div>
                {chosenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange({})}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
                    >
                        <X size={12} /> Сбросить
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {options.answers.map(group => (
                    <div key={group.key}>
                        <div className="mb-1.5 text-[12px] font-bold text-slate-500">{group.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {group.options.map(option => (
                                <button
                                    key={option.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleAnswer(group.key, option.id)}
                                    className={chipClass((value.answers?.[group.key] || []).includes(option.id))}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {(options.sources.length > 0 || options.withoutSource > 0) && (
                    <div>
                        <div className="mb-1.5 text-[12px] font-bold text-slate-500">Откуда пришёл</div>
                        <div className="flex flex-wrap gap-1.5">
                            {options.sources.map(source => (
                                <button
                                    key={source.value}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleSource(source.value)}
                                    className={chipClass((value.sources || []).includes(source.value))}
                                >
                                    {source.value}
                                    <span className="ml-1.5 text-[11px] font-bold text-slate-400">{source.count}</span>
                                </button>
                            ))}
                            {options.withoutSource > 0 && (
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleSource(NO_SOURCE)}
                                    className={chipClass((value.sources || []).includes(NO_SOURCE))}
                                >
                                    Без метки
                                    <span className="ml-1.5 text-[11px] font-bold text-slate-400">{options.withoutSource}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-3 text-[11px] leading-4 text-slate-400">
                {isEmptyAudienceFilter(value)
                    ? 'Сейчас рассылка уйдёт всему сегменту.'
                    : 'Внутри одного вопроса варианты складываются по «или», между вопросами — по «и».'}
            </p>
        </div>
    );
}
