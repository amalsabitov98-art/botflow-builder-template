import React, { useState } from 'react';
import {
    ChevronUp, ChevronDown, Settings, Plus, MessageSquare,
    ArrowRight, Timer, Trash2, GraduationCap
} from 'lucide-react';

import { FunnelStage, StageRule } from '../types/funnel';
import FirstMessageEditor from './stage/FirstMessageEditor';
import StagePhonePreview from './stage/StagePhonePreview';
import QuestionsSection from './stage/QuestionsSection';
import RemindersSection from './stage/RemindersSection';
import MediaModal, { type MediaModalState } from './stage/MediaModal';
import ModernSelect from './ui/ModernSelect';

interface StageCardProps {
    key?: React.Key;
    stage: FunnelStage;
    stages: FunnelStage[];
    funnelId: string;
    onUpdate: (stage: FunnelStage) => void;
    onDelete: (stageId: string) => void;
}

export default function StageCard({ stage, stages, funnelId, onUpdate, onDelete }: StageCardProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [mediaModal, setMediaModal] = useState<MediaModalState | null>(null);

    const addRule = () => {
        const newRule: StageRule = {
            id: `rule-${Date.now()}`,
            type: 'message',
            message: '🎯 {name}, держи свой гайд!\n\nВот твой PDF-гайд...',
        };
        onUpdate({ ...stage, rules: [...stage.rules, newRule] });
    };

    const removeRule = (id: string) => {
        onUpdate({ ...stage, rules: (stage.rules || []).filter(r => r.id !== id) });
    };

    const updateRule = (id: string, message: string) => {
        onUpdate({
            ...stage,
            rules: (stage.rules || []).map(rule => rule.id === id ? { ...rule, message } : rule),
        });
    };

    // Пресеты автоперехода: «сразу» здесь не нужен — этап, уходящий следом за
    // предыдущим, это один длинный этап, а не два.
    const autoAdvanceOptions = [
        { value: '0', label: 'Ждать нажатия кнопки' },
        { value: '60', label: 'Через 1 час' },
        { value: '180', label: 'Через 3 часа' },
        { value: '720', label: 'Через 12 часов' },
        { value: '1440', label: 'Через 24 часа' },
        { value: '2880', label: 'Через 2 дня' },
        { value: '4320', label: 'Через 3 дня' },
        { value: '10080', label: 'Через неделю' },
    ];

    const updateAutoAdvance = (raw: string) => {
        if (!stage.nextStage?.targetStageId) return;
        const minutes = Number(raw) || 0;
        const label = autoAdvanceOptions.find(option => option.value === raw)?.label;
        onUpdate({
            ...stage,
            nextStage: {
                ...stage.nextStage,
                autoAdvanceMinutes: minutes > 0 ? minutes : undefined,
                autoAdvanceLabel: minutes > 0 ? label?.replace('Через ', '') : undefined,
            },
        });
    };

    const updateTransition = (targetStageId: string) => {
        const target = stages.find(item => item.id === targetStageId);
        const usesSingleNextButton = (stage.firstMessage.buttonAction || '') === 'next_stage';
        onUpdate({
            ...stage,
            nextStage: target
                ? {
                    targetStageId: target.id,
                    label: `Далее: ${target.title}`,
                    // Задержка — про то, сколько ждать, а не про то, куда вести:
                    // при смене этапа-получателя она сохраняется.
                    autoAdvanceMinutes: stage.nextStage?.autoAdvanceMinutes,
                    autoAdvanceLabel: stage.nextStage?.autoAdvanceLabel,
                }
                : undefined,
            firstMessage: {
                ...stage.firstMessage,
                buttonText: target
                    ? (stage.firstMessage.buttonText || 'Продолжить')
                    : (usesSingleNextButton ? '' : stage.firstMessage.buttonText),
                buttonAction: target
                    ? (stage.firstMessage.buttonAction || 'next_stage')
                    : (usesSingleNextButton ? undefined : stage.firstMessage.buttonAction),
                buttonStyle: target
                    ? (stage.firstMessage.buttonStyle || 'primary')
                    : (usesSingleNextButton ? undefined : stage.firstMessage.buttonStyle),
            },
        });
    };

    // Применяет URL из медиа-модалки к нужной цели: первому сообщению или напоминанию.
    const applyMediaUrl = (url: string) => {
        if (!mediaModal) return;
        if (mediaModal.target?.kind === 'reminder') {
            const reminderId = mediaModal.target.reminderId;
            onUpdate({
                ...stage,
                reminders: (stage.reminders || []).map(r => r.id === reminderId ? { ...r, [mediaModal.type]: url } : r),
            });
        } else {
            onUpdate({
                ...stage,
                firstMessage: { ...stage.firstMessage, [mediaModal.type]: url },
            });
        }
        setMediaModal(null);
    };

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-slate-800 border-b border-slate-700">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center font-black text-slate-900 text-sm shadow-lg shadow-amber-400/20">
                        {stage.index + 1}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                        </div>
                        {editingTitle ? (
                            <input
                                autoFocus
                                value={stage.title}
                                onChange={(event) => onUpdate({ ...stage, title: event.target.value })}
                                onBlur={() => setEditingTitle(false)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === 'Escape') setEditingTitle(false);
                                }}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300"
                            />
                        ) : (
                            <h3 className="truncate text-base sm:text-lg text-white font-bold tracking-tight" title={stage.title}>{stage.title}</h3>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">

                    <button
                        onClick={() => onDelete(stage.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Удалить этап"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={() => setEditingTitle(true)}
                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                        title="Переименовать этап"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                </div>
            </div>

            {/* Body - 3 columns */}
            {!collapsed && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">

                        {/* ===== LEFT COLUMN: Первое сообщение ===== */}
                        <FirstMessageEditor stage={stage} onUpdate={onUpdate} onOpenMediaModal={setMediaModal} />

                        {/* ===== MIDDLE COLUMN: Мобильный сайт (Предпросмотр) ===== */}
                        <StagePhonePreview
                            stageId={stage.id}
                            funnelId={funnelId}
                            enabled={stage.webApp?.enabled}
                            access={stage.webApp?.access}
                            onAccessChange={(access) => {
                                if (!stage.webApp) return;
                                onUpdate({ ...stage, webApp: { ...stage.webApp, access } });
                            }}
                        />

                        {/* ===== RIGHT COLUMN: Переход + Правила ===== */}
                        <div className="p-5 space-y-4">
                            {/* Next Stage Transition */}
                            <div>
                                <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Переход на другой этап</h4>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <div className="mb-2 flex items-center gap-2 text-xs text-amber-700">
                                        <ArrowRight size={14} />
                                        Куда перейти после действия
                                    </div>
                                    <ModernSelect
                                        value={stage.nextStage?.targetStageId || ''}
                                        onChange={updateTransition}
                                        options={[
                                            { value: '', label: 'Завершить воронку' },
                                            ...stages
                                                .filter(item => item.id !== stage.id)
                                                .map(item => ({ value: item.id, label: `Этап ${item.index + 1}: ${item.title}` })),
                                        ]}
                                        searchable
                                        searchPlaceholder="Найти этап"
                                        buttonClassName="h-10 border-amber-200 shadow-none focus:border-amber-400 focus:ring-amber-100"
                                        ariaLabel="Переход на этап"
                                    />

                                    {stage.nextStage?.targetStageId && (
                                        <div className="mt-3 border-t border-amber-200 pt-3">
                                            <div className="mb-2 flex items-center gap-2 text-xs text-amber-700">
                                                <Timer size={14} />
                                                Если кнопку так и не нажали
                                            </div>
                                            <ModernSelect
                                                value={String(stage.nextStage.autoAdvanceMinutes || 0)}
                                                onChange={updateAutoAdvance}
                                                options={autoAdvanceOptions}
                                                buttonClassName="h-10 border-amber-200 shadow-none focus:border-amber-400 focus:ring-amber-100"
                                                ariaLabel="Автопереход на следующий этап"
                                            />
                                            <p className="mt-2 text-[11px] leading-4 text-amber-700/80">
                                                {stage.nextStage.autoAdvanceMinutes
                                                    ? 'Следующий этап уйдёт сам. Нажал кнопку раньше — автопереход отменяется.'
                                                    : 'Сейчас воронка ждёт человека: без нажатия он останется на этом этапе.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rules */}
                            <div>
                                <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Ваши правила</h4>

                                {(stage.rules || []).map(rule => (
                                    <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare size={14} className="text-slate-400" />
                                                <span className="text-slate-700 text-sm font-semibold">Сообщение</span>
                                            </div>
                                            <button
                                                onClick={() => removeRule(rule.id)}
                                                className="text-slate-300 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <textarea
                                            value={rule.message}
                                            onChange={(event) => updateRule(rule.id, event.target.value)}
                                            rows={4}
                                            className="w-full resize-y rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>
                                ))}

                                <button
                                    onClick={addRule}
                                    className="w-full py-2.5 text-slate-400 hover:text-indigo-500 text-sm font-medium border border-dashed border-slate-200 hover:border-indigo-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} />
                                    Добавить
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ===== ДОМАШНЕЕ ЗАДАНИЕ (ЧЕЛЛЕНДЖ) ===== */}
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
                                    <GraduationCap size={18} />
                                </div>
                                <div>
                                    <h4 className="text-slate-800 text-sm font-bold">Домашнее задание (Челлендж)</h4>
                                    <p className="text-slate-500 text-xs">
                                        Студент сдаёт ДЗ в личку / бот. ИИ делает экспресс-проверку, а следующий урок открывается после вашего одобрения.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={stage.requireHomework || false}
                                    onChange={(e) => onUpdate({ ...stage, requireHomework: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        {stage.requireHomework && (
                            <div className="mt-4 pt-4 border-t border-slate-200/60">
                                <label className="text-[12px] font-medium text-slate-600 uppercase tracking-wider mb-2 block">
                                    Критерии проверки для ИИ-ассистента и куратора
                                </label>
                                <textarea
                                    value={stage.homeworkCriteria || ''}
                                    onChange={(e) => onUpdate({ ...stage, homeworkCriteria: e.target.value })}
                                    placeholder="Например: Студент должен прислать ссылку на Netlify или Vercel и указать, что привязал форму к боту."
                                    rows={2}
                                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition-all"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    ИИ моментально оценит ответ по этим критериям прямо в диалоге и подготовит для вас карточку согласования с кнопкой быстрого одобрения.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ===== REMINDERS ROW (horizontal, below the 3 columns) ===== */}
                    <QuestionsSection stage={stage} stages={stages} onUpdate={onUpdate} />


                    <RemindersSection stage={stage} onUpdate={onUpdate} onOpenMediaModal={setMediaModal} />
                </>
            )}

            {/* Media Upload / URL Modal */}
            {mediaModal && (
                <MediaModal
                    modal={mediaModal}
                    onClose={() => setMediaModal(null)}
                    onSave={applyMediaUrl}
                />
            )}
        </div>
    );
}
