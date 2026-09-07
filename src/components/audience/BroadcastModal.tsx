import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    Bot,
    Check,
    CheckSquare,
    ChevronDown,
    ChevronUp,
    Clock,
    Copy,
    History,
    ImageIcon,
    Loader2,
    Search,
    Send,
    ShieldCheck,
    Square,
    Upload,
    Users,
    Video,
    X,
} from 'lucide-react';
import { pluralizeContacts, segmentPresets, type BroadcastMediaType } from './shared';
import ModernSelect from '../ui/ModernSelect';
import BroadcastHistory from './BroadcastHistory';
import BroadcastRulesTab from './BroadcastRulesTab';

interface BroadcastModalProps {
    segmentKey: string;
    funnelFilter: string;
    setFunnelFilter: (funnelId: string) => void;
    funnels: { id: string; title: string }[];
    recipientIds: number[];
    audienceLabel: string;
    onClose: () => void;
}

interface PreviewRecipient {
    id: number;
    firstName?: string;
    username?: string;
    funnel?: string;
    funnelId?: string | null;
    stage?: string;
    canSend: boolean;
    segments?: string[];
}

interface RecipientGroup {
    id: number;
    firstName?: string;
    username?: string;
    channels: PreviewRecipient[];
    readyChannels: number;
}

const MAX_BROADCAST_DELIVERIES = 100;

export default function BroadcastModal({
    segmentKey,
    funnelFilter,
    setFunnelFilter,
    funnels,
    recipientIds,
    audienceLabel,
    onClose,
}: BroadcastModalProps) {
    const starterText = segmentKey === 'completed_not_paid'
        ? '{name}, ты уже прошел ключевой шаг. Хочешь, я покажу, как забрать следующий результат?'
        : '{name}, вижу ты остановился на этапе «{stage}». Продолжаем?';
    const scopedRecipientIdsRef = useRef(Array.from(new Set(recipientIds.map(Number))));
    const previewRequestRef = useRef(0);
    const mediaInputRef = useRef<HTMLInputElement>(null);

    const [broadcastText, setBroadcastText] = useState(starterText);
    const [broadcastMediaType, setBroadcastMediaType] = useState<BroadcastMediaType>('none');
    const [broadcastMediaUrl, setBroadcastMediaUrl] = useState('');
    const [broadcastPreview, setBroadcastPreview] = useState<any | null>(null);
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastMediaUploading, setBroadcastMediaUploading] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState<any | null>(null);
    const [broadcastError, setBroadcastError] = useState('');
    const [broadcastData, setBroadcastData] = useState<{ campaigns: any[]; rules: any[]; templates: any[] }>({ campaigns: [], rules: [], templates: [] });
    const [broadcastTab, setBroadcastTab] = useState<'send' | 'history' | 'auto'>('send');
    const [confirmText, setConfirmText] = useState('');
    const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
    const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [recipientsExpanded, setRecipientsExpanded] = useState(false);
    const [testRecipientId, setTestRecipientId] = useState<number | null>(null);

    const selectedSegment = segmentPresets.find(segment => segment.key === segmentKey) || segmentPresets[0];

    const loadBroadcastPreview = async (text = broadcastText, resetSelection = false) => {
        const requestId = ++previewRequestRef.current;
        setBroadcastLoading(true);
        setBroadcastError('');
        try {
            const res = await fetch('/api/broadcasts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentKey,
                    funnelId: funnelFilter === 'all' ? undefined : funnelFilter,
                    recipientIds: scopedRecipientIdsRef.current,
                    text,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Не удалось собрать предпросмотр');
            if (requestId !== previewRequestRef.current) return;

            setBroadcastPreview(data);
            const readyIds = Array.from(new Set<number>(
                (data.recipients || [])
                    .filter((recipient: PreviewRecipient) => recipient.canSend)
                    .map((recipient: PreviewRecipient) => Number(recipient.id))
            ));
            if (resetSelection) {
                setSelectedRecipientIds(readyIds);
                setConfirmText('');
            } else {
                setSelectedRecipientIds(current => current.filter(id => readyIds.includes(id)));
            }
            setTestRecipientId(current => (
                current && readyIds.includes(current) ? current : readyIds[0] || null
            ));
        } catch (e: any) {
            if (requestId === previewRequestRef.current) {
                setBroadcastError(e.message || 'Не удалось собрать предпросмотр');
            }
        } finally {
            if (requestId === previewRequestRef.current) setBroadcastLoading(false);
        }
    };

    const loadBroadcastData = async () => {
        try {
            const res = await fetch('/api/broadcasts');
            const data = await res.json();
            if (res.ok) setBroadcastData(data);
        } catch (e) {
            console.error('Failed to load broadcasts', e);
        }
    };

    useEffect(() => {
        void loadBroadcastData();
        void loadBroadcastPreview(starterText, true);

    }, []);

    const initializedRef = useRef(false);
    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            return;
        }
        void loadBroadcastPreview(broadcastText, true);

    }, [funnelFilter, segmentKey]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadBroadcastPreview(broadcastText, false);
        }, 450);
        return () => window.clearTimeout(timer);

    }, [broadcastText]);

    useEffect(() => {
        const hasSending = broadcastData.campaigns.some((campaign: any) => campaign.status === 'sending');
        if (!hasSending) return;
        const timer = window.setTimeout(() => void loadBroadcastData(), 2000);
        return () => window.clearTimeout(timer);

    }, [broadcastData]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !broadcastSending) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [broadcastSending, onClose]);

    const previewRecipients: PreviewRecipient[] = broadcastPreview?.recipients || [];
    const recipientGroups = useMemo<RecipientGroup[]>(() => {
        const groups = new Map<number, RecipientGroup>();
        for (const recipient of previewRecipients) {
            const id = Number(recipient.id);
            const current = groups.get(id) || {
                id,
                firstName: recipient.firstName,
                username: recipient.username,
                channels: [],
                readyChannels: 0,
            };
            current.channels.push(recipient);
            if (recipient.canSend) current.readyChannels += 1;
            groups.set(id, current);
        }
        return Array.from(groups.values());
    }, [previewRecipients]);

    const filteredRecipientGroups = useMemo(() => {
        const query = recipientSearch.trim().toLowerCase();
        if (!query) return recipientGroups;
        return recipientGroups.filter(recipient => (
            (recipient.firstName || '').toLowerCase().includes(query)
            || (recipient.username || '').toLowerCase().includes(query.replace(/^@/, ''))
            || recipient.channels.some(channel => (
                (channel.funnel || '').toLowerCase().includes(query)
                || (channel.stage || '').toLowerCase().includes(query)
            ))
        ));
    }, [recipientGroups, recipientSearch]);

    const visibleRecipientGroups = recipientsExpanded
        ? filteredRecipientGroups
        : filteredRecipientGroups.slice(0, 6);
    const selectedPreviewRecipients = previewRecipients.filter(recipient => selectedRecipientIds.includes(Number(recipient.id)));
    const selectedReadyCount = selectedPreviewRecipients.filter(recipient => recipient.canSend).length;
    const selectedContactCount = recipientGroups.filter(recipient => selectedRecipientIds.includes(recipient.id)).length;
    const readyContactCount = recipientGroups.filter(recipient => recipient.readyChannels > 0).length;
    const skippedContactCount = recipientGroups.length - readyContactCount;
    const selectedConfirmPhrase = `ОТПРАВИТЬ ${selectedReadyCount}`;
    const hasBroadcastBody = broadcastText.trim().length >= 3 || (broadcastMediaType !== 'none' && Boolean(broadcastMediaUrl));
    const overDeliveryLimit = selectedReadyCount > MAX_BROADCAST_DELIVERIES;
    const canSendBroadcast = (
        !broadcastSending
        && !broadcastLoading
        && selectedReadyCount > 0
        && !overDeliveryLimit
        && confirmText === selectedConfirmPhrase
        && hasBroadcastBody
    );

    const sendBroadcast = async () => {
        if (!canSendBroadcast) return;
        setBroadcastSending(true);
        setBroadcastError('');
        setBroadcastResult(null);
        try {
            const res = await fetch('/api/broadcasts/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentKey,
                    funnelId: funnelFilter === 'all' ? undefined : funnelFilter,
                    text: broadcastText,
                    confirmText,
                    maxRecipients: MAX_BROADCAST_DELIVERIES,
                    recipientIds: selectedRecipientIds,
                    mediaType: broadcastMediaType,
                    mediaUrl: broadcastMediaUrl,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Не удалось отправить рассылку');
            setBroadcastResult(data);
            setConfirmText('');
            await loadBroadcastData();
            if (data?.id) setExpandedCampaignId(data.id);
            setBroadcastTab('history');
        } catch (e: any) {
            setBroadcastError(e.message || 'Не удалось отправить рассылку');
        } finally {
            setBroadcastSending(false);
        }
    };

    const sendTestBroadcast = async () => {
        if (broadcastSending || !hasBroadcastBody || !testRecipientId) return;
        setBroadcastSending(true);
        setBroadcastError('');
        setBroadcastResult(null);
        try {
            const res = await fetch('/api/broadcasts/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentKey,
                    funnelId: funnelFilter === 'all' ? undefined : funnelFilter,
                    text: broadcastText,
                    chatId: testRecipientId,
                    mediaType: broadcastMediaType,
                    mediaUrl: broadcastMediaUrl,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Не удалось отправить тест');
            setBroadcastResult(data);
            await loadBroadcastData();
        } catch (e: any) {
            setBroadcastError(e.message || 'Не удалось отправить тест');
        } finally {
            setBroadcastSending(false);
        }
    };

    const applyTemplate = (template: any) => {
        setBroadcastText(template.text);
        setBroadcastTab('send');
        setConfirmText('');
    };

    const handleBroadcastMediaUpload = async (file: File) => {
        if (broadcastMediaType === 'none') return;
        setBroadcastMediaUploading(true);
        setBroadcastError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', broadcastMediaType);
            const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Не удалось загрузить медиа');
            setBroadcastMediaUrl(data.url);
        } catch (e: any) {
            setBroadcastError(e.message || 'Не удалось загрузить медиа');
        } finally {
            setBroadcastMediaUploading(false);
        }
    };

    const toggleRecipient = (id: number) => {
        setConfirmText('');
        setSelectedRecipientIds(current => (
            current.includes(id) ? current.filter(item => item !== id) : [...current, id]
        ));
        if (!testRecipientId) setTestRecipientId(id);
    };

    const setAllRecipientsSelected = (selected: boolean) => {
        setConfirmText('');
        setSelectedRecipientIds(selected
            ? recipientGroups.filter(recipient => recipient.readyChannels > 0).map(recipient => recipient.id)
            : []);
    };

    const tabs = [
        { key: 'send', label: 'Новая рассылка', shortLabel: 'Новая', icon: Send },
        { key: 'history', label: 'История', shortLabel: 'История', icon: History },
        { key: 'auto', label: 'Автоматизация', shortLabel: 'Авто', icon: Clock },
    ] as const;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="broadcast-title"
                className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f6f7f9] shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl sm:rounded-2xl"
            >
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Сообщение аудитории</div>
                            <h2 id="broadcast-title" className="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl">
                                Рассылка
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                <span>{audienceLabel}</span>
                                <span aria-hidden="true">·</span>
                                <span>{selectedSegment.label}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={broadcastSending}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            aria-label="Закрыть рассылку"
                        >
                            <X size={19} />
                        </button>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setBroadcastTab(tab.key)}
                                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] transition-colors ${
                                    broadcastTab === tab.key
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                <tab.icon size={15} />
                                <span className="hidden min-[480px]:inline">{tab.label}</span>
                                <span className="min-[480px]:hidden">{tab.shortLabel}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5">
                    {broadcastTab === 'send' && (
                        <div className="mx-auto grid max-w-[1080px] gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
                            <div className="grid min-w-0 gap-4">
                                <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white">1</div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-semibold text-slate-900">Кому отправляем</h3>
                                            <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                                Список зафиксирован при открытии рассылки. Можно снять отдельных людей.
                                            </p>
                                        </div>
                                    </div>

                                    {funnels.length > 0 && (
                                        <label className="mt-4 block">
                                            <span className="mb-1.5 block text-xs text-slate-500">Воронка</span>
                                            <ModernSelect
                                                value={funnelFilter}
                                                onChange={setFunnelFilter}
                                                options={[
                                                    { value: 'all', label: 'Все воронки' },
                                                    ...funnels.map(funnel => ({ value: funnel.id, label: funnel.title })),
                                                ]}
                                                searchable
                                                searchPlaceholder="Найти воронку"
                                                buttonClassName="bg-slate-50 shadow-none"
                                                ariaLabel="Воронка для рассылки"
                                            />
                                        </label>
                                    )}

                                    <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                        <div className="px-3 py-3">
                                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Контактов</div>
                                            <div className="mt-1 text-lg font-semibold text-slate-800">{broadcastLoading ? '…' : recipientGroups.length}</div>
                                        </div>
                                        <div className="border-l border-slate-200 px-3 py-3">
                                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Доступны</div>
                                            <div className="mt-1 text-lg font-semibold text-emerald-700">{broadcastLoading ? '…' : readyContactCount}</div>
                                        </div>
                                        <div className="border-l border-slate-200 px-3 py-3">
                                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Без связи</div>
                                            <div className="mt-1 text-lg font-semibold text-slate-500">{broadcastLoading ? '…' : skippedContactCount}</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="text-sm text-slate-700">
                                                Выбрано: <span className="font-semibold">{pluralizeContacts(selectedContactCount)}</span>
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-400">
                                                Фактических отправок: {selectedReadyCount}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setAllRecipientsSelected(true)}
                                                className="min-h-10 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 hover:bg-slate-200"
                                            >
                                                Выбрать доступных
                                            </button>
                                            <button
                                                onClick={() => setAllRecipientsSelected(false)}
                                                className="min-h-10 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100"
                                            >
                                                Снять
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative mt-3">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={recipientSearch}
                                            onChange={(event) => {
                                                setRecipientSearch(event.target.value);
                                                setRecipientsExpanded(Boolean(event.target.value));
                                            }}
                                            placeholder="Найти получателя"
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                                        />
                                    </div>

                                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                                        {broadcastLoading ? (
                                            <div className="flex items-center justify-center gap-2 p-5 text-sm text-slate-400">
                                                <Loader2 size={16} className="animate-spin" />
                                                Проверяем доступность…
                                            </div>
                                        ) : visibleRecipientGroups.length === 0 ? (
                                            <div className="p-5 text-center text-sm text-slate-400">Подходящих получателей нет.</div>
                                        ) : visibleRecipientGroups.map(recipient => {
                                            const checked = selectedRecipientIds.includes(recipient.id);
                                            const canSend = recipient.readyChannels > 0;
                                            const details = recipient.channels
                                                .map(channel => [channel.funnel, channel.stage].filter(Boolean).join(' · '))
                                                .filter(Boolean);
                                            return (
                                                <button
                                                    key={recipient.id}
                                                    onClick={() => canSend && toggleRecipient(recipient.id)}
                                                    disabled={!canSend}
                                                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
                                                >
                                                    {checked
                                                        ? <CheckSquare size={17} className="shrink-0 text-slate-800" />
                                                        : <Square size={17} className="shrink-0 text-slate-300" />}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-[13px] font-medium text-slate-800">
                                                            {recipient.firstName || 'Без имени'} {recipient.username ? `@${recipient.username}` : ''}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-[11px] text-slate-400">
                                                            {details[0] || 'Без воронки'}
                                                            {details.length > 1 ? ` · ещё ${details.length - 1}` : ''}
                                                        </div>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${
                                                        canSend ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {canSend
                                                            ? recipient.readyChannels > 1 ? `${recipient.readyChannels} бота` : 'доступен'
                                                            : 'нет бота'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {filteredRecipientGroups.length > 6 && !recipientSearch && (
                                        <button
                                            onClick={() => setRecipientsExpanded(current => !current)}
                                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                        >
                                            {recipientsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {recipientsExpanded
                                                ? 'Свернуть список'
                                                : `Показать ещё ${filteredRecipientGroups.length - 6}`}
                                        </button>
                                    )}
                                </section>

                                <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white">2</div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-semibold text-slate-900">Что отправляем</h3>
                                            <p className="mt-0.5 text-xs leading-5 text-slate-500">Напишите сообщение или добавьте медиа.</p>
                                        </div>
                                    </div>

                                    {broadcastData.templates.filter(template => template.segmentKey === segmentKey || segmentKey === 'all').length > 0 && (
                                        <div className="mt-4">
                                            <div className="mb-2 text-xs text-slate-500">Готовые шаблоны</div>
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {broadcastData.templates
                                                    .filter(template => template.segmentKey === segmentKey || segmentKey === 'all')
                                                    .slice(0, 5)
                                                    .map(template => (
                                                        <button
                                                            key={`${template.segmentKey}-${template.label}`}
                                                            onClick={() => applyTemplate(template)}
                                                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:border-slate-300 hover:bg-white"
                                                        >
                                                            <Copy size={13} />
                                                            {template.label}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    <label className="mt-4 block">
                                        <span className="mb-1.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                                            <span>Текст сообщения</span>
                                            <span>{broadcastText.length} знаков</span>
                                        </span>
                                        <textarea
                                            value={broadcastText}
                                            onChange={(event) => {
                                                setBroadcastText(event.target.value);
                                                setConfirmText('');
                                            }}
                                            rows={6}
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition-all focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                                            placeholder="Напишите текст рассылки…"
                                        />
                                    </label>
                                    <div className="mt-2 text-[11px] leading-5 text-slate-400">
                                        Подстановка для каждого: {'{name}'}, {'{username}'}, {'{stage}'}, {'{funnel}'}
                                    </div>

                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                        <div className="mb-2 text-xs text-slate-500">Формат</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { key: 'none', label: 'Текст', icon: Send },
                                                { key: 'photo', label: 'Фото', icon: ImageIcon },
                                                { key: 'videoNote', label: 'Кружок', icon: Video },
                                            ].map((item: any) => (
                                                <button
                                                    key={item.key}
                                                    onClick={() => {
                                                        setBroadcastMediaType(item.key);
                                                        setBroadcastMediaUrl('');
                                                        setConfirmText('');
                                                    }}
                                                    className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs transition-colors ${
                                                        broadcastMediaType === item.key
                                                            ? 'border-slate-900 bg-slate-900 text-white'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                                                    }`}
                                                >
                                                    <item.icon size={14} />
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>

                                        {broadcastMediaType !== 'none' && (
                                            <div className="mt-3 grid gap-2">
                                                <input
                                                    ref={mediaInputRef}
                                                    type="file"
                                                    accept={broadcastMediaType === 'photo' ? 'image/*' : 'video/*'}
                                                    className="hidden"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (file) void handleBroadcastMediaUpload(file);
                                                        event.target.value = '';
                                                    }}
                                                />
                                                <button
                                                    onClick={() => mediaInputRef.current?.click()}
                                                    disabled={broadcastMediaUploading}
                                                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-white disabled:opacity-60"
                                                >
                                                    {broadcastMediaUploading
                                                        ? <Loader2 size={16} className="animate-spin" />
                                                        : broadcastMediaUrl ? <Check size={16} className="text-emerald-600" /> : <Upload size={16} />}
                                                    {broadcastMediaUploading
                                                        ? 'Загружаем…'
                                                        : broadcastMediaUrl ? 'Файл загружен — заменить' : 'Загрузить файл'}
                                                </button>
                                                {broadcastMediaType === 'videoNote' && (
                                                    <div className="text-[11px] leading-5 text-amber-700">
                                                        Telegram отправит кружок отдельно, затем текст.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div className="grid min-w-0 gap-4 lg:sticky lg:top-0">
                                <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white">3</div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-semibold text-slate-900">Проверка и отправка</h3>
                                            <p className="mt-0.5 text-xs leading-5 text-slate-500">Сначала можно отправить тест себе или коллеге.</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-2xl bg-[#dfe8de] p-3 sm:p-4">
                                        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                                            <Bot size={13} />
                                            Предпросмотр в Telegram
                                        </div>
                                        {broadcastMediaType !== 'none' && broadcastMediaUrl && (
                                            <div className="mb-1 rounded-t-xl bg-slate-200 px-3 py-7 text-center text-xs text-slate-500">
                                                {broadcastMediaType === 'photo' ? 'Фотография' : 'Видеокружок'}
                                            </div>
                                        )}
                                        <div className={`ml-auto max-w-[92%] whitespace-pre-wrap bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-700 shadow-sm ${
                                            broadcastMediaType !== 'none' && broadcastMediaUrl ? 'rounded-b-xl rounded-tl-xl' : 'rounded-2xl rounded-br-md'
                                        }`}>
                                            {broadcastLoading
                                                ? 'Обновляем пример…'
                                                : broadcastPreview?.sampleText || 'Добавьте текст, чтобы увидеть сообщение.'}
                                        </div>
                                    </div>

                                    <label className="mt-4 block">
                                        <span className="mb-1.5 block text-xs text-slate-500">Получатель теста</span>
                                        <ModernSelect
                                            value={testRecipientId ? String(testRecipientId) : ''}
                                            onChange={nextValue => setTestRecipientId(Number(nextValue) || null)}
                                            disabled={readyContactCount === 0}
                                            options={recipientGroups
                                                .filter(recipient => recipient.readyChannels > 0)
                                                .map(recipient => ({
                                                    value: String(recipient.id),
                                                    label: `${recipient.firstName || 'Без имени'}${recipient.username ? ` @${recipient.username}` : ''}`,
                                                }))}
                                            searchable
                                            searchPlaceholder="Найти себя в Telegram"
                                            buttonClassName="bg-slate-50 shadow-none"
                                            ariaLabel="Получатель теста"
                                        />
                                    </label>
                                    <button
                                        onClick={() => void sendTestBroadcast()}
                                        disabled={broadcastSending || broadcastLoading || !testRecipientId || !hasBroadcastBody}
                                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {broadcastSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                        Отправить тест
                                    </button>

                                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                                        <div className="flex items-start gap-2">
                                            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-500" />
                                            <div className="min-w-0">
                                                <div className="text-xs text-slate-700">Защита от случайной отправки</div>
                                                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                                    Введите <span className="font-mono text-slate-900">{selectedConfirmPhrase}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            value={confirmText}
                                            onChange={(event) => setConfirmText(event.target.value)}
                                            placeholder={selectedConfirmPhrase}
                                            autoComplete="off"
                                            className="mt-2.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                        />
                                    </div>

                                    {overDeliveryLimit && (
                                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                            Выбрано {selectedReadyCount} отправок. За один запуск можно не больше {MAX_BROADCAST_DELIVERIES}: снимите часть получателей или выберите одну воронку.
                                        </div>
                                    )}

                                    <button
                                        onClick={() => void sendBroadcast()}
                                        disabled={!canSendBroadcast}
                                        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {broadcastSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        {broadcastSending
                                            ? 'Запускаем…'
                                            : selectedReadyCount > 0 ? `Отправить · ${selectedReadyCount}` : 'Выберите получателей'}
                                    </button>
                                    <div className="mt-2 text-center text-[11px] leading-5 text-slate-400">
                                        Результат и ошибки появятся во вкладке «История».
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {broadcastTab === 'history' && (
                        <div className="mx-auto max-w-3xl">
                            <BroadcastHistory
                                campaigns={broadcastData.campaigns}
                                expandedCampaignId={expandedCampaignId}
                                onToggleExpanded={setExpandedCampaignId}
                            />
                        </div>
                    )}

                    {broadcastTab === 'auto' && (
                        <div className="mx-auto max-w-3xl">
                            <BroadcastRulesTab
                                rules={broadcastData.rules}
                                onRuleCreated={(rule) => setBroadcastData(previous => ({ ...previous, rules: [rule, ...previous.rules] }))}
                                onRuleUpdated={(rule) => setBroadcastData(previous => ({
                                    ...previous,
                                    rules: previous.rules.map(item => item.id === rule.id ? rule : item),
                                }))}
                                onError={setBroadcastError}
                            />
                        </div>
                    )}

                    {broadcastError && (
                        <div className="mx-auto mt-4 flex max-w-3xl items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {broadcastError}
                        </div>
                    )}

                    {broadcastResult && (
                        <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {broadcastResult.type === 'test' ? 'Тест отправлен.' : 'Рассылка запущена.'}
                            {' '}Доставлено: {broadcastResult.result?.sent ?? broadcastResult.sent ?? 0}.
                            {' '}Ошибок: {broadcastResult.result?.failed ?? broadcastResult.failed ?? 0}.
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
                    <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3">
                        <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
                            <Users size={14} />
                            {broadcastTab === 'send'
                                ? `${pluralizeContacts(selectedContactCount)} · ${selectedReadyCount} отправок`
                                : 'Все изменения и результаты сохраняются'}
                        </div>
                        <button
                            onClick={onClose}
                            disabled={broadcastSending}
                            className="ml-auto min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
