import React, { useEffect, useRef, useState } from 'react';
import { Send, Video, ImageIcon, Upload, Loader2, Clock, MousePointerClick, ArrowRight, CheckCircle2, TestTube2, Pin } from 'lucide-react';
import { segmentPresets, type BroadcastMediaType } from './shared';
import AudienceFilterPicker from './AudienceFilterPicker';
import ModernSelect from '../ui/ModernSelect';
import { isEmptyAudienceFilter, type AudienceFilter } from '../../../shared/audience';

interface BroadcastRulesTabProps {
    rules: any[];
    onRuleCreated: (rule: any) => void;
    onRuleUpdated: (rule: any) => void;
    onError: (message: string) => void;
}

export default function BroadcastRulesTab({ rules, onRuleCreated, onRuleUpdated, onError }: BroadcastRulesTabProps) {
    const ruleMediaInputRef = useRef<HTMLInputElement>(null);
    const [ruleMediaUploading, setRuleMediaUploading] = useState(false);
    const [ruleSaving, setRuleSaving] = useState(false);
    const [testSending, setTestSending] = useState(false);
    const [testRecipients, setTestRecipients] = useState<any[]>([]);
    const [testRecipientId, setTestRecipientId] = useState<number | null>(null);
    const [testResult, setTestResult] = useState('');
    const [ruleDraft, setRuleDraft] = useState<{
        name: string;
        segmentKey: string;
        filter: AudienceFilter;
        delayMinutes: number;
        limitPerRun: number;
        text: string;
        mediaType: BroadcastMediaType;
        mediaUrl: string;
        pinMessage: boolean;
    }>({
        name: 'Через 2 часа не продолжил',
        segmentKey: 'menu_button_opened_not_continued',
        filter: {},
        delayMinutes: 120,
        limitPerRun: 20,
        text: '{name}, ты открыл «Мой прогресс», но не продолжил. Вернемся к этапу «{stage}»?',
        mediaType: 'none',
        mediaUrl: '',
        pinMessage: false,
    });

    useEffect(() => {
        let active = true;
        const loadTestRecipients = async () => {
            try {
                const response = await fetch('/api/broadcasts/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        segmentKey: 'all',
                        text: '',
                    }),
                });
                const data = await response.json();
                if (!response.ok || !active) return;
                const unique = new Map<number, any>();
                for (const recipient of data.recipients || []) {
                    if (!recipient.canSend || unique.has(Number(recipient.id))) continue;
                    unique.set(Number(recipient.id), recipient);
                }
                const recipients = Array.from(unique.values());
                setTestRecipients(recipients);
                setTestRecipientId(current => (
                    current && recipients.some(item => Number(item.id) === current)
                        ? current
                        : Number(recipients[0]?.id) || null
                ));
            } catch {
                if (active) setTestRecipients([]);
            }
        };
        void loadTestRecipients();
        return () => { active = false; };
    }, []);

    const createBroadcastRule = async () => {
        setRuleSaving(true);
        onError('');
        try {
            const res = await fetch('/api/broadcast-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ruleDraft),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Не удалось сохранить правило');
            onRuleCreated(data);
            setRuleDraft(prev => ({ ...prev, mediaType: 'none', mediaUrl: '' }));
        } catch (e: any) {
            onError(e.message || 'Не удалось сохранить правило');
        } finally {
            setRuleSaving(false);
        }
    };

    const handleRuleMediaUpload = async (file: File) => {
        if (ruleDraft.mediaType === 'none') return;
        setRuleMediaUploading(true);
        onError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', ruleDraft.mediaType);
            const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Не удалось загрузить медиа');
            setRuleDraft(prev => ({ ...prev, mediaUrl: data.url }));
        } catch (e: any) {
            onError(e.message || 'Не удалось загрузить медиа');
        } finally {
            setRuleMediaUploading(false);
        }
    };

    const toggleBroadcastRule = async (rule: any) => {
        const res = await fetch(`/api/broadcast-rules/${rule.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !rule.enabled }),
        });
        const data = await res.json();
        if (res.ok) {
            onRuleUpdated(data);
        }
    };

    const sendRuleTest = async () => {
        const hasBody = ruleDraft.text.trim().length >= 3
            || (ruleDraft.mediaType !== 'none' && Boolean(ruleDraft.mediaUrl));
        if (!testRecipientId || !hasBody || testSending) return;
        setTestSending(true);
        setTestResult('');
        onError('');
        try {
            const response = await fetch('/api/broadcasts/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentKey: ruleDraft.segmentKey,
                    text: ruleDraft.text,
                    chatId: testRecipientId,
                    mediaType: ruleDraft.mediaType,
                    mediaUrl: ruleDraft.mediaUrl,
                    pinMessage: ruleDraft.pinMessage,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось отправить тест');
            setTestResult('Тест отправлен в Telegram');
        } catch (e: any) {
            onError(e.message || 'Не удалось отправить тест');
        } finally {
            setTestSending(false);
        }
    };

    return (
        <div className="grid gap-5">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-900">Что такое автосообщение?</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                    Бот сам отправит сообщение человеку, если тот совершил выбранное действие и не продолжил путь за указанное время.
                    Одному человеку одно и то же правило повторно не отправляется.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                    <div className="rounded-xl bg-white p-3">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                            <MousePointerClick size={15} className="text-[#1677e8]" /> 1. Человек сделал действие
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">Например, открыл урок и остановился</div>
                    </div>
                    <ArrowRight size={15} className="hidden text-blue-300 sm:block" />
                    <div className="rounded-xl bg-white p-3">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                            <Clock size={15} className="text-[#1677e8]" /> 2. Бот подождал
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">Заданное вами число минут</div>
                    </div>
                    <ArrowRight size={15} className="hidden text-blue-300 sm:block" />
                    <div className="rounded-xl bg-white p-3">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                            <Send size={15} className="text-[#1677e8]" /> 3. Ушло сообщение
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">Текст, фотография или кружок</div>
                    </div>
                </div>

            </div>

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Настроить автосообщение</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Сначала отправьте тест себе. Новое правило сохранится выключенным и не начнёт работать без вашего включения.</p>
                </div>
                <label>
                    <span className="mb-1.5 block text-xs text-slate-500">Понятное название для вас</span>
                    <input value={ruleDraft.name} onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white" />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label>
                        <span className="mb-1.5 block text-xs text-slate-500">1. Если человек</span>
                        <ModernSelect
                            value={ruleDraft.segmentKey}
                            onChange={segmentKey => setRuleDraft({ ...ruleDraft, segmentKey })}
                            options={segmentPresets.filter(segment => segment.key !== 'all').map(segment => ({ value: segment.key, label: segment.label }))}
                            buttonClassName="bg-slate-50 shadow-none"
                            ariaLabel="Условие автосообщения"
                        />
                    </label>
                    <label>
                        <span className="mb-1.5 block text-xs text-slate-500">2. Подождать, минут</span>
                        <input type="number" min={1} value={ruleDraft.delayMinutes} onChange={(e) => setRuleDraft({ ...ruleDraft, delayMinutes: Number(e.target.value) || 1 })} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white" />
                    </label>
                    <label>
                        <span className="mb-1.5 block text-xs text-slate-500">Не более получателей за один запуск</span>
                        <input type="number" min={1} value={ruleDraft.limitPerRun} onChange={(e) => setRuleDraft({ ...ruleDraft, limitPerRun: Number(e.target.value) || 1 })} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white" />
                        <span className="mt-1 block text-[11px] leading-4 text-slate-400">Защищает от случайной массовой отправки.</span>
                    </label>
                </div>

                <AudienceFilterPicker
                    value={ruleDraft.filter}
                    onChange={filter => setRuleDraft(prev => ({ ...prev, filter }))}
                    disabled={ruleSaving}
                />
                <label>
                    <span className="mb-1.5 block text-xs text-slate-500">3. Какое сообщение отправить</span>
                    <textarea value={ruleDraft.text} onChange={(e) => setRuleDraft({ ...ruleDraft, text: e.target.value })} rows={4} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none focus:border-slate-400 focus:bg-white" />
                </label>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-xs font-medium text-slate-500">Что добавить к сообщению</label>
                        {ruleDraft.mediaUrl && (
                            <button onClick={() => setRuleDraft({ ...ruleDraft, mediaUrl: '' })} className="text-xs font-medium text-slate-400 hover:text-rose-500">Убрать</button>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { key: 'none', label: 'Текст', icon: Send },
                            { key: 'photo', label: 'Фото', icon: ImageIcon },
                            { key: 'videoNote', label: 'Кружок', icon: Video },
                        ].map((item: any) => (
                            <button
                                key={item.key}
                                onClick={() => setRuleDraft({ ...ruleDraft, mediaType: item.key, mediaUrl: '' })}
                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                    ruleDraft.mediaType === item.key
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'
                                }`}
                            >
                                <item.icon size={14} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                    {ruleDraft.mediaType !== 'none' && (
                        <div className="mt-3 grid gap-2">
                            <input
                                ref={ruleMediaInputRef}
                                type="file"
                                accept={ruleDraft.mediaType === 'photo' ? 'image/*' : 'video/*'}
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleRuleMediaUpload(f); e.target.value = ''; }}
                            />
                            <button
                                onClick={() => ruleMediaInputRef.current?.click()}
                                disabled={ruleMediaUploading}
                                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
                            >
                                {ruleMediaUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                {ruleMediaUploading ? 'Загружаю...' : ruleDraft.mediaUrl ? 'Заменить файл' : 'Загрузить файл'}
                            </button>
                            {ruleDraft.mediaUrl && (
                                <div className="truncate rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">Файл загружен ✓</div>
                            )}
                            {ruleDraft.mediaType === 'videoNote' && (
                                <div className="text-[11px] font-medium text-amber-600">Кружок уйдёт отдельным сообщением, текст — следом.</div>
                            )}
                        </div>
                    )}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <input
                        type="checkbox"
                        checked={ruleDraft.pinMessage}
                        onChange={event => setRuleDraft({ ...ruleDraft, pinMessage: event.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-amber-500"
                    />
                    <span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><Pin size={15} /> Закреплять автосообщение</span>
                        <span className="mt-1 block text-xs leading-5 text-amber-800/80">Бот закрепит сообщение после отправки. Нужны права на закрепление в чате.</span>
                    </span>
                </label>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                        <TestTube2 size={18} className="mt-0.5 shrink-0 text-[#1677e8]" />
                        <div>
                            <div className="text-sm font-medium text-slate-900">Отправить себе для проверки</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Выберите свой Telegram-профиль из базы контактов. Это отправит одно тестовое сообщение и не включит правило.
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <ModernSelect
                            value={testRecipientId ? String(testRecipientId) : ''}
                            onChange={nextValue => setTestRecipientId(Number(nextValue) || null)}
                            disabled={testRecipients.length === 0}
                            options={testRecipients.length === 0
                                ? [{ value: '', label: 'Нет доступных Telegram-контактов', disabled: true }]
                                : testRecipients.map(recipient => ({
                                    value: String(recipient.id),
                                    label: `${recipient.firstName || 'Без имени'}${recipient.username ? ` @${recipient.username}` : ''}`,
                                }))}
                            searchable
                            searchPlaceholder="Найти себя в Telegram"
                            buttonClassName="border-blue-200 shadow-none"
                            ariaLabel="Получатель тестового сообщения"
                        />
                        <button
                            onClick={() => void sendRuleTest()}
                            disabled={
                                testSending
                                || !testRecipientId
                                || (ruleDraft.text.trim().length < 3 && (ruleDraft.mediaType === 'none' || !ruleDraft.mediaUrl))
                            }
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#1677e8] bg-white px-4 text-[13px] font-medium text-[#1677e8] hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {testSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            Отправить себе
                        </button>
                    </div>
                    {testResult && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                            <CheckCircle2 size={14} /> {testResult}
                        </div>
                    )}
                </div>

                <button onClick={createBroadcastRule} disabled={ruleSaving} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1677e8] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#0f69ce] disabled:opacity-50">
                    {ruleSaving ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
                    Сохранить выключенным
                </button>
            </div>

            <div className="grid gap-3">
                {rules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                        <div className="text-sm font-medium text-slate-600">Автосообщений пока нет</div>
                        <div className="mt-1 text-xs text-slate-400">Настройте сценарий выше, проверьте его и включите, когда будете готовы.</div>
                    </div>
                ) : rules.map(rule => (
                    <div key={rule.id} className="flex flex-col items-stretch gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-slate-800">{rule.name}</div>
                                {rule.mediaType === 'photo' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"><ImageIcon size={10} /> Фото</span>
                                )}
                                {rule.mediaType === 'videoNote' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"><Video size={10} /> Кружок</span>
                                )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Если: {segmentPresets.find(s => s.key === rule.segmentKey)?.label || rule.segmentKey}
                                {!isEmptyAudienceFilter(rule.filter) && ' (с отбором по анкете и источнику)'}
                                {' '}→ ждать {rule.delayMinutes} мин → отправить сообщение
                            </div>
                        </div>
                        <button onClick={() => toggleBroadcastRule(rule)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${rule.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {rule.enabled ? 'Включено' : 'Выключено'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
