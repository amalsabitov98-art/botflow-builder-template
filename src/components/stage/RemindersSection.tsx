import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Clock, MessageSquare, Smartphone, Bell, Zap, Trash2, ImageIcon, X, Pin } from 'lucide-react';
import { FunnelStage, Reminder } from '../../types/funnel';
import ButtonsEditor from './ButtonsEditor';
import { reminderConditionOptions, getReminderConditionLabel, smartReminderPresets } from './reminderPresets';
import type { MediaModalState } from './MediaModal';
import ModernSelect from '../ui/ModernSelect';

interface RemindersSectionProps {
    stage: FunnelStage;
    onUpdate: (stage: FunnelStage) => void;
    onOpenMediaModal: (modal: MediaModalState) => void;
}

export default function RemindersSection({ stage, onUpdate, onOpenMediaModal }: RemindersSectionProps) {
    const [editingReminder, setEditingReminder] = useState<string | null>(null);
    const [presetDialogOpen, setPresetDialogOpen] = useState(false);

    const addReminder = () => {
        const delays = [
            { minutes: 60, label: '60 минут' },
            { minutes: 120, label: '2 часа' },
            { minutes: 1380, label: '23 часа' },
        ];
        const idx = stage.reminders.length;
        const delay = delays[idx] || { minutes: (idx + 1) * 60, label: `${idx + 1} час` };

        const newReminder: Reminder = {
            id: `reminder-${Date.now()}`,
            delayMinutes: delay.minutes,
            delayLabel: delay.label,
            condition: 'not_completed',
            message: `{name}, напоминаю о предыдущем сообщении!`,
            buttonText: stage.firstMessage.buttonText,
            pinMessage: false,
        };
        onUpdate({ ...stage, reminders: [...stage.reminders, newReminder] });
    };

    const removeReminder = (id: string) => {
        onUpdate({ ...stage, reminders: (stage.reminders || []).filter(r => r.id !== id) });
    };

    const applySmartReminderPresets = () => {
        const buttonAction = stage.webApp?.enabled ? 'open_webapp' : (stage.firstMessage.buttonAction || 'next_stage');
        const reminders: Reminder[] = smartReminderPresets.map((preset) => ({
            id: `smart-${preset.id}-${Date.now()}`,
            delayMinutes: preset.delayMinutes,
            delayLabel: preset.delayLabel,
            condition: preset.condition,
            message: preset.message,
            buttonText: preset.buttonText,
            buttonAction: buttonAction as any,
            buttonUrl: stage.firstMessage.buttonUrl,
            buttonStyle: 'primary',
        }));

        onUpdate({ ...stage, reminders });
        setEditingReminder(null);
        setPresetDialogOpen(false);
    };

    const updateReminder = (id: string, field: string, value: any) => {
        onUpdate({
            ...stage,
            reminders: (stage.reminders || []).map(r => r.id === id ? { ...r, [field]: value } : r)
        });
    };

    return (
        <>
                        <div className="border-t border-slate-100 p-4 sm:p-5">
                            <div className={`grid gap-5 ${(stage.reminders || []).length === 0 ? 'grid-cols-1' :
                                (stage.reminders || []).length === 1 ? 'grid-cols-1' :
                                    (stage.reminders || []).length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                        'grid-cols-1 lg:grid-cols-3'
                                }`}>
                                {(stage.reminders || []).map((reminder, idx) => (
                                    <div key={reminder.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        {/* Reminder header */}
                                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <div>
                                                <h5 className="text-slate-700 text-sm font-semibold">Напоминание {idx + 1}</h5>
                                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                                                    <Clock size={11} />
                                                    <span>Через {reminder.delayLabel}</span>
                                                </div>
                                                <div className="mt-1 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                                    {getReminderConditionLabel(reminder.condition)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeReminder(reminder.id)}
                                                className="text-slate-300 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                        {/* Reminder body */}
                                        <div className="p-4">
                                            {editingReminder === reminder.id ? (
                                                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Задержка</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={
                                                                    reminder.delayMinutes % 1440 === 0
                                                                        ? reminder.delayMinutes / 1440
                                                                        : reminder.delayMinutes % 60 === 0
                                                                            ? reminder.delayMinutes / 60
                                                                            : reminder.delayMinutes
                                                                }
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value) || 1;
                                                                    const currentUnit =
                                                                        reminder.delayMinutes % 1440 === 0
                                                                            ? 'days'
                                                                            : reminder.delayMinutes % 60 === 0
                                                                                ? 'hours'
                                                                                : 'minutes';
                                                                    let mins = val;
                                                                    let label = '';
                                                                    if (currentUnit === 'hours') {
                                                                        mins = val * 60;
                                                                        label = val === 1 ? '1 час' : (val >= 2 && val <= 4) ? `${val} часа` : `${val} часов`;
                                                                    } else if (currentUnit === 'days') {
                                                                        mins = val * 24 * 60;
                                                                        label = val === 1 ? '1 день' : (val >= 2 && val <= 4) ? `${val} дня` : `${val} дней`;
                                                                    } else {
                                                                        mins = val;
                                                                        label = `${val} минут`;
                                                                    }
                                                                    updateReminder(reminder.id, 'delayMinutes', mins);
                                                                    updateReminder(reminder.id, 'delayLabel', label);
                                                                }}
                                                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ед. измерения</label>
                                                            <ModernSelect
                                                                value={
                                                                    reminder.delayMinutes % 1440 === 0
                                                                        ? 'days'
                                                                        : reminder.delayMinutes % 60 === 0
                                                                            ? 'hours'
                                                                            : 'minutes'
                                                                }
                                                                onChange={(unit) => {
                                                                    const currentVal =
                                                                        reminder.delayMinutes % 1440 === 0
                                                                            ? reminder.delayMinutes / 1440
                                                                            : reminder.delayMinutes % 60 === 0
                                                                                ? reminder.delayMinutes / 60
                                                                                : reminder.delayMinutes;
                                                                    let mins = currentVal;
                                                                    let label = '';
                                                                    if (unit === 'hours') {
                                                                        mins = currentVal * 60;
                                                                        label = currentVal === 1 ? '1 час' : (currentVal >= 2 && currentVal <= 4) ? `${currentVal} часа` : `${currentVal} часов`;
                                                                    } else if (unit === 'days') {
                                                                        mins = currentVal * 24 * 60;
                                                                        label = currentVal === 1 ? '1 день' : (currentVal >= 2 && currentVal <= 4) ? `${currentVal} дня` : `${currentVal} дней`;
                                                                    } else {
                                                                        mins = currentVal;
                                                                        label = `${currentVal} минут`;
                                                                    }
                                                                    updateReminder(reminder.id, 'delayMinutes', mins);
                                                                    updateReminder(reminder.id, 'delayLabel', label);
                                                                }}
                                                                options={[
                                                                    { value: 'minutes', label: 'Минут' },
                                                                    { value: 'hours', label: 'Часов' },
                                                                    { value: 'days', label: 'Дней' },
                                                                ]}
                                                                buttonClassName="h-9 rounded-lg px-2.5 text-sm shadow-none"
                                                                ariaLabel="Единица измерения"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Условие отправки</label>
                                                        <ModernSelect
                                                            value={reminder.condition || 'not_completed'}
                                                            onChange={nextValue => updateReminder(reminder.id, 'condition', nextValue)}
                                                            options={reminderConditionOptions.map(option => ({ value: option.value, label: option.label }))}
                                                            buttonClassName="h-9 rounded-lg px-2.5 text-sm shadow-none"
                                                            ariaLabel="Условие отправки"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Изображение</label>
                                                        {reminder.photo ? (
                                                            <div className="rounded-xl border border-slate-200 bg-white p-2">
                                                                <div className="relative h-28 overflow-hidden rounded-lg bg-slate-100">
                                                                    <img
                                                                        src={reminder.photo}
                                                                        alt="Фото к дожимному сообщению"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="mt-2 flex items-center justify-end gap-3">
                                                                    <button
                                                                        onClick={() => onOpenMediaModal({ type: 'photo', action: 'edit', value: reminder.photo || '', target: { kind: 'reminder', reminderId: reminder.id } })}
                                                                        className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-700"
                                                                    >
                                                                        Изменить
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updateReminder(reminder.id, 'photo', '')}
                                                                        className="text-[10px] font-bold uppercase text-red-500 hover:text-red-600"
                                                                    >
                                                                        Удалить
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => onOpenMediaModal({ type: 'photo', action: 'add', value: '', target: { kind: 'reminder', reminderId: reminder.id } })}
                                                                className="w-full rounded-lg border border-dashed border-slate-200 bg-white py-2 text-xs font-medium text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 flex items-center justify-center gap-1.5"
                                                            >
                                                                <ImageIcon size={12} />
                                                                + Добавить фото к дожиму
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Текст сообщения</label>
                                                        <textarea
                                                            value={reminder.message}
                                                            onChange={(e) => updateReminder(reminder.id, 'message', e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-700 text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <ButtonsEditor
                                                        buttonText={reminder.buttonText || ''}
                                                        buttonAction={reminder.buttonAction || ''}
                                                        buttonUrl={reminder.buttonUrl || ''}
                                                        buttonStyle={reminder.buttonStyle || ''}
                                                        onChange={(data) => {
                                                            onUpdate({
                                                                ...stage,
                                                                reminders: (stage.reminders || []).map(r => r.id === reminder.id ? {
                                                                    ...r,
                                                                    buttonText: data.buttonText,
                                                                    buttonAction: data.buttonAction as any,
                                                                    buttonUrl: data.buttonUrl,
                                                                    buttonStyle: data.buttonStyle
                                                                } : r)
                                                            });
                                                        }}
                                                    />
                                                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(reminder.pinMessage)}
                                                            onChange={(event) => updateReminder(reminder.id, 'pinMessage', event.target.checked)}
                                                            className="mt-0.5 accent-amber-500"
                                                        />
                                                        <span className="text-xs leading-4 text-amber-800"><span className="font-semibold">📌 Закрепить напоминание</span><span className="block text-[10px] text-amber-700/80">Нужны права бота на закрепление сообщений.</span></span>
                                                    </label>
                                                    <button
                                                        onClick={() => setEditingReminder(null)}
                                                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
                                                    >
                                                        Готово
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {reminder.photo && (
                                                        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                                            <img
                                                                src={reminder.photo}
                                                                alt="Фото к дожимному сообщению"
                                                                className="h-32 w-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                    <p
                                                        className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap cursor-pointer hover:text-slate-800 transition-colors"
                                                        onClick={() => setEditingReminder(reminder.id)}
                                                    >
                                                        {reminder.message}
                                                    </p>
                                                    {reminder.buttonText && (
                                                        <div className="flex flex-col gap-2 mt-3">
                                                            {reminder.buttonText.split('|').map((t, idx) => {
                                                                const actions = (reminder.buttonAction || '').split('|');
                                                                const action = (actions[idx] || actions[0] || 'url').trim();
                                                                const styles = (reminder.buttonStyle || '').split('|');
                                                                const style = (styles[idx] || styles[0] || 'default').trim();

                                                                let bgClass = "bg-slate-900 text-white";
                                                                if (style === 'primary') bgClass = "bg-blue-600 text-white";
                                                                else if (style === 'success') bgClass = "bg-emerald-600 text-white";
                                                                else if (style === 'danger') bgClass = "bg-red-500 text-white";

                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={`flex-1 py-2 ${bgClass} text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 shadow-sm`}
                                                                    >
                                                                        {action === 'open_webapp' && <Smartphone size={12} />}
                                                                        ✨ {t.trim()}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {/* Reminder footer */}
                                        <div className="px-4 pb-3">
                                            <div className="flex items-center gap-2 text-slate-300 text-xs">
                                                <MessageSquare size={11} />
                                                <span>0</span>
                                                <span>Количество полученных сообщений без учета недошедших</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add Reminder button */}
                            {(stage.reminders || []).length < 10 && (
                                <div className={`${(stage.reminders || []).length > 0 ? 'mt-4' : ''} grid grid-cols-1 md:grid-cols-2 gap-3`}>
                                    <button
                                        onClick={() => setPresetDialogOpen(true)}
                                        className="group flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#1677e8] shadow-sm">
                                            <Zap size={16} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-slate-800">Готовая цепочка напоминаний</span>
                                            <span className="mt-0.5 block text-[11px] text-slate-500">4 сообщения под поведение ученика</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={addReminder}
                                        className="w-full py-3 text-indigo-500 hover:text-indigo-600 text-sm font-medium border border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl transition-colors flex items-center justify-center gap-2 bg-indigo-50/50 hover:bg-indigo-50"
                                    >
                                        <Bell size={14} />
                                        + Добавить напоминание
                                    </button>
                                </div>
                            )}
                        </div>
                        {presetDialogOpen && typeof document !== 'undefined' && createPortal(
                            <div
                                className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
                                role="presentation"
                                onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) setPresetDialogOpen(false);
                                }}
                            >
                                <div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="reminder-preset-title"
                                    className="flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_-24px_rgba(15,23,42,0.5)]"
                                >
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1677e8]">
                                                <Zap size={19} />
                                            </span>
                                            <div>
                                                <h3 id="reminder-preset-title" className="text-lg font-semibold tracking-tight text-slate-900">
                                                    Готовая цепочка напоминаний
                                                </h3>
                                                <p className="mt-1 max-w-lg text-sm leading-5 text-slate-500">
                                                    Добавим четыре сообщения. Каждое отправится только человеку, который застрял на соответствующем шаге.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPresetDialogOpen(false)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                            aria-label="Закрыть"
                                        >
                                            <X size={17} />
                                        </button>
                                    </div>

                                    <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
                                        <div className="space-y-2.5">
                                            {smartReminderPresets.map((preset, index) => (
                                                <div key={preset.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-semibold text-[#1677e8] shadow-sm">
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-semibold text-slate-800">{getReminderConditionLabel(preset.condition)}</span>
                                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                                                через {preset.delayLabel}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                                            {preset.message.replaceAll('{name}, ', '').replaceAll('\n', ' ')}
                                                        </p>
                                                    </div>
                                                    <Check size={16} className="mt-1 shrink-0 text-emerald-500" />
                                                </div>
                                            ))}
                                        </div>

                                        {(stage.reminders || []).length > 0 ? (
                                            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-800">
                                                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                                                <span>
                                                    Сейчас настроено {(stage.reminders || []).length} напоминаний. После применения они будут заменены этой цепочкой.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-5 text-slate-600">
                                                После добавления можно изменить время, условие, текст и кнопку каждого сообщения.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                                        <button
                                            type="button"
                                            onClick={() => setPresetDialogOpen(false)}
                                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                        >
                                            Оставить как есть
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applySmartReminderPresets}
                                            className="min-h-11 rounded-xl bg-[#1677e8] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0f69ce]"
                                        >
                                            {(stage.reminders || []).length > 0 ? 'Заменить на готовую цепочку' : 'Добавить цепочку'}
                                        </button>
                                    </div>
                                </div>
                            </div>,
                            document.body,
                        )}
        </>
    );
}
