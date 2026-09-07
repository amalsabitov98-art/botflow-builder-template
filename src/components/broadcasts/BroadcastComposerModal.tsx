import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Bot,
    CalendarClock,
    Check,
    FileText,
    ImageIcon,
    Images,
    Loader2,
    Pin,
    Save,
    Search,
    Send,
    TestTube2,
    Upload,
    Users,
    Video,
    X,
} from 'lucide-react';
import { pluralizeContacts, segmentPresets, type BroadcastMediaType } from '../audience/shared';
import AudienceFilterPicker from '../audience/AudienceFilterPicker';
import { isEmptyAudienceFilter, type AudienceFilter } from '../../../shared/audience';
import ModernSelect from '../ui/ModernSelect';
import DateTimePicker from '../ui/DateTimePicker';

interface BroadcastComposerModalProps {
    funnels: { id: string; title: string }[];
    initialRecipientIds?: number[];
    initialAudienceLabel?: string;
    initialSegmentKey?: string;
    initialFunnelId?: string;
    initialCampaign?: any | null;
    onClose: () => void;
    onSaved: () => void;
}

interface PreviewRecipient {
    id: number;
    firstName?: string;
    username?: string;
    funnel?: string;
    stage?: string;
    canSend: boolean;
}

interface GalleryMediaItem {
    id: string;
    filename: string;
    name: string;
    url: string;
    type: 'image' | 'video' | 'pdf';
}

type AttachmentType = Exclude<BroadcastMediaType, 'none'>;

const MAX_BROADCAST_DELIVERIES = 100;

function toLocalDateTimeValue(value?: string) {
    const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function formatPreviewText(template: string, recipient?: PreviewRecipient) {
    if (!template || !recipient) return template;
    return template
        .replace(/\{name\}/g, recipient.firstName || '')
        .replace(/\{firstName\}/g, recipient.firstName || '')
        .replace(/\{username\}/g, recipient.username ? `@${recipient.username}` : '')
        .replace(/\{stage\}/g, recipient.stage || '')
        .replace(/\{funnel\}/g, recipient.funnel || '');
}

export default function BroadcastComposerModal({
    funnels,
    initialRecipientIds,
    initialAudienceLabel,
    initialSegmentKey,
    initialFunnelId,
    initialCampaign,
    onClose,
    onSaved,
}: BroadcastComposerModalProps) {
    const recipientSource = initialCampaign?.recipientIds ?? initialRecipientIds;
    const scopedRecipientKey = Array.isArray(recipientSource)
        ? Array.from(new Set(recipientSource.map(Number))).sort((left, right) => left - right).join(',')
        : null;
    const scopedRecipientIds = useMemo(
        () => scopedRecipientKey === null
            ? undefined
            : scopedRecipientKey
                ? scopedRecipientKey.split(',').map(Number)
                : [],
        [scopedRecipientKey]
    );

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [name, setName] = useState(initialCampaign?.name || `Рассылка ${new Date().toLocaleDateString('ru-RU')}`);
    const [segmentKey, setSegmentKey] = useState(initialCampaign?.segmentKey || initialSegmentKey || 'all');
    const [funnelId, setFunnelId] = useState(initialCampaign?.funnelId || initialFunnelId || 'all');
    // Отбор поверх сегмента: ответы на вопросы воронки и метка диплинка.
    const [filter, setFilter] = useState<AudienceFilter>(initialCampaign?.filter || {});
    // Сравнивать объект по ссылке нельзя: предпросмотр перезапрашивался бы на
    // каждый рендер. Ключ меняется ровно тогда, когда меняются сами условия.
    const filterKey = JSON.stringify(filter);
    const [text, setText] = useState(initialCampaign?.text || '');
    const initialMediaType = (initialCampaign?.mediaType || 'none') as BroadcastMediaType;
    const initialMediaUrl = initialCampaign?.mediaUrl || '';
    const [mediaType, setMediaType] = useState<BroadcastMediaType>(initialMediaType);
    const [pinMessage, setPinMessage] = useState(Boolean(initialCampaign?.pinMessage));
    const [mediaUrls, setMediaUrls] = useState<Partial<Record<AttachmentType, string>>>(() => (
        initialMediaType !== 'none' && initialMediaUrl ? { [initialMediaType]: initialMediaUrl } : {}
    ));
    const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Partial<Record<AttachmentType, string>>>(() => (
        initialMediaType !== 'none' && initialMediaUrl ? { [initialMediaType]: initialMediaUrl } : {}
    ));
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState<GalleryMediaItem[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryError, setGalleryError] = useState('');
    const [sendMode, setSendMode] = useState<'now' | 'scheduled'>(
        initialCampaign?.status === 'scheduled' ? 'scheduled' : 'now'
    );
    const [scheduledAt, setScheduledAt] = useState(toLocalDateTimeValue(initialCampaign?.scheduledAt));
    const [confirmText, setConfirmText] = useState('');
    const [preview, setPreview] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [templates, setTemplates] = useState<any[]>([]);
    const [testRecipients, setTestRecipients] = useState<PreviewRecipient[]>([]);
    const [testRecipientId, setTestRecipientId] = useState<number | null>(null);
    const [testRecipientSearch, setTestRecipientSearch] = useState('');
    const [testPickerOpen, setTestPickerOpen] = useState(false);
    const [testResult, setTestResult] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const previewRequestRef = useRef(0);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const mediaUrl = mediaType === 'none' ? '' : mediaUrls[mediaType] || '';
    const mediaPreviewUrl = mediaType === 'none' ? '' : mediaPreviewUrls[mediaType] || mediaUrl;

    const loadPreview = async (resetSelection: boolean) => {
        const requestId = ++previewRequestRef.current;
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/broadcasts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentKey,
                    funnelId: funnelId === 'all' ? undefined : funnelId,
                    recipientIds: scopedRecipientIds,
                    filter,
                    text: '',
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось собрать аудиторию');
            if (requestId !== previewRequestRef.current) return;
            setPreview(data);

            const readyIds = Array.from(new Set<number>(
                (data.recipients || [])
                    .filter((recipient: PreviewRecipient) => recipient.canSend)
                    .map((recipient: PreviewRecipient) => Number(recipient.id))
            ));
            setSelectedIds(current => resetSelection ? readyIds : current.filter(id => readyIds.includes(id)));
            setConfirmText('');
        } catch (cause: any) {
            if (requestId === previewRequestRef.current) setError(cause.message || 'Не удалось собрать аудиторию');
        } finally {
            if (requestId === previewRequestRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        void fetch('/api/broadcasts')
            .then(response => response.json())
            .then(data => setTemplates(Array.isArray(data.templates) ? data.templates : []))
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (
            initialMediaType === 'none'
            || !initialMediaUrl.includes('/api/admin/media/private/')
        ) return;

        let active = true;
        const encodedFilename = initialMediaUrl.split('/api/admin/media/private/')[1]?.split(/[?#]/)[0] || '';
        const filename = decodeURIComponent(encodedFilename);
        void fetch('/api/admin/media/library')
            .then(response => response.json())
            .then(data => {
                if (!active || !Array.isArray(data.items)) return;
                const item = data.items.find((candidate: GalleryMediaItem) => candidate.filename === filename);
                if (item?.url) {
                    setMediaPreviewUrls(current => ({ ...current, [initialMediaType]: item.url }));
                }
            })
            .catch(() => undefined);

        return () => { active = false; };
        // Initial campaign media is immutable for the lifetime of this modal.

    }, []);

    useEffect(() => {
        let active = true;
        void fetch('/api/broadcasts/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segmentKey: 'all', text: '' }),
        })
            .then(response => response.json().then(data => ({ response, data })))
            .then(({ response, data }) => {
                if (!response.ok || !active) return;
                const unique = new Map<number, PreviewRecipient>();
                for (const recipient of data.recipients || []) {
                    const id = Number(recipient.id);
                    if (!recipient.canSend || unique.has(id)) continue;
                    unique.set(id, { ...recipient, id });
                }
                const available = Array.from(unique.values());
                setTestRecipients(available);
                setTestRecipientId(current => (
                    current && available.some(recipient => recipient.id === current)
                        ? current
                        : null
                ));
            })
            .catch(() => {
                if (active) setTestRecipients([]);
            });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        void loadPreview(true);

    }, [segmentKey, funnelId, scopedRecipientIds, filterKey]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [onClose, saving]);

    const recipients: PreviewRecipient[] = preview?.recipients || [];
    const recipientGroups = useMemo(() => {
        const groups = new Map<number, PreviewRecipient & { channels: number }>();
        for (const recipient of recipients) {
            const id = Number(recipient.id);
            const current = groups.get(id);
            if (!current) groups.set(id, { ...recipient, id, channels: recipient.canSend ? 1 : 0 });
            else if (recipient.canSend) {
                current.channels += 1;
                current.canSend = true;
            }
        }
        return Array.from(groups.values());
    }, [recipients]);

    const visibleRecipients = useMemo(() => {
        const query = recipientSearch.trim().toLowerCase().replace(/^@/, '');
        return recipientGroups.filter(recipient => (
            !query
            || (recipient.firstName || '').toLowerCase().includes(query)
            || (recipient.username || '').toLowerCase().includes(query)
            || (recipient.funnel || '').toLowerCase().includes(query)
        ));
    }, [recipientGroups, recipientSearch]);

    const selectedDeliveryCount = recipients.filter(recipient => (
        recipient.canSend && selectedIds.includes(Number(recipient.id))
    )).length;
    const previewRecipient = recipientGroups.find(recipient => (
        recipient.canSend && selectedIds.includes(recipient.id)
    )) || recipientGroups.find(recipient => recipient.canSend);
    const previewText = useMemo(
        () => formatPreviewText(text, previewRecipient),
        [text, previewRecipient]
    );
    const selectedTestRecipient = testRecipients.find(recipient => recipient.id === testRecipientId) || null;
    const filteredTestRecipients = useMemo(() => {
        const query = testRecipientSearch.trim().toLowerCase().replace(/^@/, '');
        if (!query) return testRecipients;
        return testRecipients.filter(recipient => (
            String(recipient.id).includes(query)
            || (recipient.firstName || '').toLowerCase().includes(query)
            || (recipient.username || '').toLowerCase().includes(query)
            || (recipient.funnel || '').toLowerCase().includes(query)
        ));
    }, [testRecipients, testRecipientSearch]);
    const confirmPhrase = `ОТПРАВИТЬ ${selectedDeliveryCount}`;
    const hasContent = text.trim().length >= 3 || (mediaType !== 'none' && Boolean(mediaUrl));
    const overLimit = selectedDeliveryCount > MAX_BROADCAST_DELIVERIES;
    const selectedSegment = segmentPresets.find(segment => segment.key === segmentKey) || segmentPresets[0];

    const toggleRecipient = (id: number) => {
        setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
        setConfirmText('');
    };

    const uploadMedia = async (file: File) => {
        if (mediaType === 'none') return;
        const attachmentType = mediaType;
        setUploading(true);
        setError('');
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('type', mediaType);
            const response = await fetch('/api/media/upload', { method: 'POST', body: form });
            const data = await response.json();
            if (!response.ok || !data.url) throw new Error(data.error || 'Не удалось загрузить файл');
            setMediaUrls(current => ({ ...current, [attachmentType]: data.url }));
            setMediaPreviewUrls(current => ({
                ...current,
                [attachmentType]: URL.createObjectURL(file),
            }));
        } catch (cause: any) {
            setError(cause.message || 'Не удалось загрузить файл');
        } finally {
            setUploading(false);
        }
    };

    const openGallery = async () => {
        setGalleryOpen(true);
        setGalleryLoading(true);
        setGalleryError('');
        try {
            const response = await fetch('/api/admin/media/library');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось загрузить галерею');
            setGalleryItems(Array.isArray(data.items) ? data.items : []);
        } catch (cause: any) {
            setGalleryError(cause?.message || 'Не удалось загрузить галерею');
        } finally {
            setGalleryLoading(false);
        }
    };

    const selectGalleryMedia = (item: GalleryMediaItem) => {
        const attachmentType: AttachmentType = item.type === 'image'
            ? 'photo'
            : mediaType === 'videoNote'
                ? 'videoNote'
                : 'video';
        const stableUrl = item.id.startsWith('project-media-private:')
            ? `/api/admin/media/private/${encodeURIComponent(item.filename)}`
            : item.url;
        setMediaType(attachmentType);
        setMediaUrls(current => ({ ...current, [attachmentType]: stableUrl }));
        setMediaPreviewUrls(current => ({ ...current, [attachmentType]: item.url }));
        setGalleryOpen(false);
    };

    const payload = () => ({
        id: initialCampaign?.id,
        name,
        segmentKey,
        filter,
        funnelId: funnelId === 'all' ? undefined : funnelId,
        recipientIds: selectedIds,
        text,
        mediaType,
        mediaUrl,
        pinMessage,
    });

    const saveDraft = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await fetch('/api/broadcasts/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload(), status: 'draft' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось сохранить черновик');
            onSaved();
            onClose();
        } catch (cause: any) {
            setError(cause.message || 'Не удалось сохранить черновик');
        } finally {
            setSaving(false);
        }
    };

    const sendOrSchedule = async () => {
        if (!hasContent || selectedDeliveryCount === 0 || overLimit || confirmText !== confirmPhrase) return;
        setSaving(true);
        setError('');
        try {
            const isScheduled = sendMode === 'scheduled';
            const endpoint = isScheduled ? '/api/broadcasts/save' : '/api/broadcasts/send';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isScheduled
                    ? {
                        ...payload(),
                        status: 'scheduled',
                        scheduledAt: new Date(scheduledAt).toISOString(),
                        confirmText,
                    }
                    : {
                        ...payload(),
                        sourceCampaignId: initialCampaign?.id,
                        maxRecipients: MAX_BROADCAST_DELIVERIES,
                        confirmText,
                    }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось запустить рассылку');
            onSaved();
            onClose();
        } catch (cause: any) {
            setError(cause.message || 'Не удалось запустить рассылку');
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async () => {
        if (!hasContent || !testRecipientId) return;
        setSaving(true);
        setError('');
        setTestResult('');
        try {
            const response = await fetch('/api/broadcasts/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload(),
                    chatId: testRecipientId,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось отправить тест');
            setTestResult('Тест отправлен в Telegram');
        } catch (cause: any) {
            setError(cause.message || 'Не удалось отправить тест');
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { id: 1 as const, label: 'Сегментация', icon: Users },
        { id: 2 as const, label: 'Сообщение', icon: FileText },
        { id: 3 as const, label: 'Отправка', icon: Send },
    ];

    return createPortal(
        <div className="fixed inset-y-0 left-0 right-0 z-30 bg-white sm:left-[var(--botflow-sidebar-width)]">
            <div className="flex h-[100dvh] w-full overflow-hidden bg-white">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <header className="shrink-0 border-b border-slate-200 bg-white px-4 pb-0 pt-4 sm:px-8 sm:pt-5">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={saving}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                                    aria-label="Назад к списку рассылок"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="min-w-0">
                                    <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-2xl">
                                        {initialCampaign ? 'Редактирование рассылки' : 'Новая рассылка'}
                                    </h2>
                                    <div className="mt-1 truncate text-xs text-slate-500">
                                        {initialAudienceLabel || selectedSegment.label} · {pluralizeContacts(selectedIds.length)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={saving}
                                    className="hidden min-h-10 items-center rounded-lg px-3 text-[13px] font-medium text-[#1677e8] hover:bg-blue-50 disabled:opacity-50 sm:flex"
                                >
                                    Закрыть
                                </button>
                                <button
                                    onClick={() => void saveDraft()}
                                    disabled={saving}
                                    className="hidden min-h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-[13px] font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 sm:flex"
                                >
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Сохранить и закрыть
                                </button>
                                <button
                                    onClick={onClose}
                                    disabled={saving}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 sm:hidden"
                                    aria-label="Закрыть"
                                >
                                    <X size={19} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 flex max-w-3xl items-center pb-5">
                            {steps.map((item, index) => {
                                const active = step === item.id;
                                const completed = step > item.id;
                                return (
                                    <React.Fragment key={item.id}>
                                        <button
                                            onClick={() => item.id < step && setStep(item.id)}
                                            className={`flex shrink-0 items-center gap-2 text-xs transition-colors sm:text-sm ${
                                                active ? 'font-medium text-slate-900' : completed ? 'text-[#1677e8]' : 'text-slate-500'
                                            }`}
                                        >
                                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                                                active
                                                    ? 'bg-[#2f80ed] text-white'
                                                    : completed
                                                        ? 'bg-blue-50 text-[#1677e8]'
                                                        : 'bg-slate-400 text-white'
                                            }`}>
                                                {completed ? <Check size={15} /> : item.id}
                                            </span>
                                            <span className="hidden min-[460px]:inline">{item.label}</span>
                                        </button>
                                        {index < steps.length - 1 && (
                                            <span className={`mx-3 h-px min-w-5 flex-1 sm:mx-5 ${
                                                completed ? 'bg-blue-200' : 'bg-slate-200'
                                            }`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </header>

                    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-0 py-0">
                    {error && (
                        <div className="mx-auto mb-4 flex max-w-4xl items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="mx-auto grid min-h-full max-w-6xl gap-0 border-b border-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-slate-200">
                            <section className="border-b border-slate-200 bg-white p-5 sm:p-8 lg:border-b-0 lg:p-10">
                                <h3 className="text-sm font-semibold text-slate-900">Кому отправляем</h3>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Выберите воронку и поведение аудитории.</p>

                                <label className="mt-4 block">
                                    <span className="mb-1.5 block text-xs text-slate-500">Воронка</span>
                                    <ModernSelect
                                        value={funnelId}
                                        onChange={setFunnelId}
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

                                <label className="mt-3 block">
                                    <span className="mb-1.5 block text-xs text-slate-500">Сегмент</span>
                                    <ModernSelect
                                        value={segmentKey}
                                        onChange={setSegmentKey}
                                        options={segmentPresets.map(segment => ({ value: segment.key, label: segment.label }))}
                                        buttonClassName="bg-slate-50 shadow-none"
                                        ariaLabel="Сегмент рассылки"
                                    />
                                </label>

                                <div className="mt-3">
                                    <AudienceFilterPicker
                                        value={filter}
                                        onChange={setFilter}
                                        funnelId={funnelId}
                                        disabled={saving}
                                    />
                                </div>

                                <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200">
                                    <div className="p-3 text-center">
                                        <div className="text-lg font-semibold text-slate-900">{loading ? '…' : recipientGroups.length}</div>
                                        <div className="text-[10px] text-slate-400">найдено</div>
                                    </div>
                                    <div className="border-l border-slate-200 p-3 text-center">
                                        <div className="text-lg font-semibold text-emerald-600">{loading ? '…' : selectedIds.length}</div>
                                        <div className="text-[10px] text-slate-400">выбрано</div>
                                    </div>
                                    <div className="border-l border-slate-200 p-3 text-center">
                                        <div className="text-lg font-semibold text-slate-500">{loading ? '…' : selectedDeliveryCount}</div>
                                        <div className="text-[10px] text-slate-400">отправок</div>
                                    </div>
                                </div>
                            </section>

                            <section className="min-w-0 bg-white p-5 sm:p-8 lg:p-10">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">Получатели</h3>
                                        <p className="mt-1 text-xs text-slate-500">Снимите тех, кому сообщение отправлять не нужно.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedIds(recipientGroups.filter(item => item.canSend).map(item => item.id))}
                                            className="text-xs text-slate-600 hover:text-slate-900"
                                        >
                                            Выбрать всех
                                        </button>
                                        <button onClick={() => setSelectedIds([])} className="text-xs text-slate-400 hover:text-slate-700">
                                            Снять
                                        </button>
                                    </div>
                                </div>

                                <div className="relative mt-3">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={recipientSearch}
                                        onChange={event => setRecipientSearch(event.target.value)}
                                        placeholder="Имя, @username или воронка"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-slate-400 focus:bg-white"
                                    />
                                </div>

                                <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200">
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400">
                                            <Loader2 size={17} className="animate-spin" /> Собираем аудиторию
                                        </div>
                                    ) : visibleRecipients.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-slate-400">Подходящих контактов нет</div>
                                    ) : visibleRecipients.map(recipient => {
                                        const selected = selectedIds.includes(recipient.id);
                                        return (
                                            <button
                                                key={recipient.id}
                                                onClick={() => recipient.canSend && toggleRecipient(recipient.id)}
                                                disabled={!recipient.canSend}
                                                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                                    selected ? 'border-[#1677e8] bg-[#1677e8] text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {selected && <Check size={13} />}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[13px] text-slate-800">
                                                        {recipient.firstName || 'Без имени'} {recipient.username ? `@${recipient.username}` : ''}
                                                    </span>
                                                    <span className="block truncate text-[11px] text-slate-400">
                                                        {recipient.funnel || 'Без воронки'}{recipient.stage ? ` · ${recipient.stage}` : ''}
                                                    </span>
                                                </span>
                                                <span className={`rounded-full px-2 py-1 text-[10px] ${
                                                    recipient.canSend ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {recipient.canSend ? recipient.channels > 1 ? `${recipient.channels} бота` : 'доступен' : 'нет бота'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="mx-auto grid min-h-full max-w-6xl gap-0 border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_380px] lg:divide-x lg:divide-slate-200">
                            <section className="min-w-0 border-b border-slate-200 bg-white p-5 sm:p-8 lg:border-b-0 lg:p-10">
                                <h3 className="text-sm font-semibold text-slate-900">Сообщение</h3>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Подстановки: {'{name}'}, {'{username}'}, {'{stage}'}, {'{funnel}'}</p>

                                {templates.length > 0 && (
                                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                                        {templates.slice(0, 5).map(template => (
                                            <button
                                                key={`${template.segmentKey}-${template.label}`}
                                                onClick={() => setText(template.text)}
                                                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-white"
                                            >
                                                {template.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <label className="mt-4 block">
                                    <span className="mb-1.5 flex justify-between text-xs text-slate-500">
                                        <span>Текст</span><span>{text.length} / 4000</span>
                                    </span>
                                    <textarea
                                        value={text}
                                        onChange={event => {
                                            setText(event.target.value.slice(0, 4000));
                                            setConfirmText('');
                                        }}
                                        rows={10}
                                        placeholder="Напишите сообщение…"
                                        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                                    />
                                </label>

                                <div className="mt-5">
                                    <div className="text-sm font-semibold text-slate-900">Вложение к сообщению</div>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Необязательно. Изображение или обычное видео отправится вместе с текстом как одно сообщение.
                                    </p>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {[
                                        { key: 'none', label: 'Без медиа', icon: X },
                                        { key: 'photo', label: 'Изображение', icon: ImageIcon },
                                        { key: 'video', label: 'Видео', icon: Video },
                                        { key: 'videoNote', label: 'Видеокружок', icon: Video },
                                    ].map((item: any) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setMediaType(item.key)}
                                            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs ${
                                                mediaType === item.key
                                                    ? 'border-blue-200 bg-blue-50 text-[#1677e8]'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                                            }`}
                                        >
                                            <item.icon size={14} /> {item.label}
                                        </button>
                                    ))}
                                </div>

                                {mediaType !== 'none' && (
                                    <>
                                        <input
                                            ref={mediaInputRef}
                                            type="file"
                                            accept={mediaType === 'photo' ? 'image/*' : 'video/*'}
                                            className="hidden"
                                            onChange={event => {
                                                const file = event.target.files?.[0];
                                                if (file) void uploadMedia(file);
                                                event.target.value = '';
                                            }}
                                        />
                                        <button
                                            onClick={() => mediaInputRef.current?.click()}
                                            disabled={uploading}
                                            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
                                        >
                                            {uploading ? <Loader2 size={16} className="animate-spin" /> : mediaUrl ? <Check size={16} /> : <Upload size={16} />}
                                            {uploading ? 'Загружаем…' : mediaUrl ? 'Файл загружен — заменить' : 'Загрузить файл'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void openGallery()}
                                            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[#1677e8]"
                                        >
                                            <Images size={16} />
                                            Выбрать из галереи
                                        </button>
                                        {mediaUrl && (
                                            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                <span className="truncate">Медиа прикреплено и сохранится при переключении типа</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (mediaType === 'none') return;
                                                        setMediaUrls(current => ({ ...current, [mediaType]: '' }));
                                                        setMediaPreviewUrls(current => ({ ...current, [mediaType]: '' }));
                                                    }}
                                                    className="shrink-0 text-emerald-600 hover:text-rose-600"
                                                    aria-label="Убрать вложение"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                                    <input
                                        type="checkbox"
                                        checked={pinMessage}
                                        onChange={event => setPinMessage(event.target.checked)}
                                        className="mt-0.5 h-4 w-4 accent-amber-500"
                                    />
                                    <span>
                                        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><Pin size={15} /> Закрепить сообщение у получателей</span>
                                        <span className="mt-1 block text-xs leading-5 text-amber-800/80">После отправки бот закрепит это сообщение в каждом чате. Нужны права на закрепление сообщений.</span>
                                    </span>
                                </label>
                            </section>

                            <section className="bg-[#fbfcfe] p-5 sm:p-8 lg:sticky lg:top-0 lg:p-10">
                                <div className="flex items-center gap-2 text-xs text-slate-500"><Bot size={15} /> Предпросмотр Telegram</div>
                                <div className="mt-3 rounded-2xl bg-[#dfe8de] p-3">
                                    <div className="ml-auto max-w-[94%] overflow-hidden rounded-2xl rounded-br-md bg-white shadow-sm">
                                        {mediaType === 'photo' && mediaPreviewUrl && (
                                            <img
                                                src={mediaPreviewUrl}
                                                alt="Прикреплённое изображение"
                                                className="max-h-72 w-full bg-slate-100 object-contain"
                                            />
                                        )}
                                        {(mediaType === 'video' || mediaType === 'videoNote') && mediaPreviewUrl && (
                                            <video
                                                src={mediaPreviewUrl}
                                                controls
                                                muted
                                                playsInline
                                                className={`max-h-72 bg-slate-950 object-contain ${
                                                    mediaType === 'videoNote' ? 'mx-auto aspect-square w-3/4 rounded-full' : 'w-full'
                                                }`}
                                            />
                                        )}
                                        <div className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-5 text-slate-700">
                                            {previewText || 'Здесь появится сообщение'}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="flex items-start gap-2.5">
                                        <TestTube2 size={17} className="mt-0.5 shrink-0 text-[#1677e8]" />
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Тест перед отправкой</div>
                                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                                Выберите свой Telegram-профиль. Тест уйдёт только вам и не запустит рассылку.
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className="relative mt-3"
                                        onBlur={event => {
                                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                                setTestPickerOpen(false);
                                            }
                                        }}
                                    >
                                        <label htmlFor="test-recipient-search" className="mb-1.5 block text-xs text-slate-500">
                                            Найдите свой Telegram-профиль
                                        </label>
                                        <div className="relative">
                                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                id="test-recipient-search"
                                                value={testRecipientSearch}
                                                onFocus={() => setTestPickerOpen(true)}
                                                onChange={event => {
                                                    setTestRecipientSearch(event.target.value);
                                                    setTestRecipientId(null);
                                                    setTestPickerOpen(true);
                                                }}
                                                placeholder="Имя, @username или Telegram ID"
                                                disabled={testRecipients.length === 0}
                                                autoComplete="off"
                                                className="h-11 w-full rounded-xl border border-blue-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1677e8] disabled:opacity-50"
                                            />
                                        </div>

                                        {testPickerOpen && testRecipients.length > 0 && (
                                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                                                {filteredTestRecipients.length === 0 ? (
                                                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                                                        Профиль не найден
                                                    </div>
                                                ) : filteredTestRecipients.map(recipient => (
                                                    <button
                                                        key={recipient.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTestRecipientId(recipient.id);
                                                            setTestRecipientSearch(
                                                                `${recipient.firstName || 'Без имени'}${recipient.username ? ` @${recipient.username}` : ''}`
                                                            );
                                                            setTestPickerOpen(false);
                                                        }}
                                                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50"
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-[13px] text-slate-800">
                                                                {recipient.firstName || 'Без имени'} {recipient.username ? `@${recipient.username}` : ''}
                                                            </span>
                                                            <span className="block truncate text-[11px] text-slate-400">
                                                                {recipient.funnel || 'Без воронки'}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 font-mono text-[10px] text-slate-400">{recipient.id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {selectedTestRecipient && (
                                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                                            <span className="min-w-0 truncate text-emerald-800">
                                                Выбран: {selectedTestRecipient.firstName || 'Без имени'}
                                                {selectedTestRecipient.username ? ` @${selectedTestRecipient.username}` : ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTestRecipientId(null);
                                                    setTestRecipientSearch('');
                                                }}
                                                className="shrink-0 text-emerald-600 hover:text-emerald-900"
                                                aria-label="Сбросить выбранный профиль"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => void sendTest()}
                                        disabled={saving || !hasContent || !testRecipientId}
                                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-4 text-[13px] font-medium text-white hover:bg-[#0f69ce] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                        Отправить себе
                                    </button>
                                    {testResult && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                                            <Check size={14} /> {testResult}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="mx-auto grid min-h-full max-w-6xl gap-0 border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_380px] lg:divide-x lg:divide-slate-200">
                            <section className="border-b border-slate-200 bg-white p-5 sm:p-8 lg:border-b-0 lg:p-10">
                                <h3 className="text-sm font-semibold text-slate-900">Параметры отправки</h3>
                                <label className="mt-4 block">
                                    <span className="mb-1.5 block text-xs text-slate-500">Название рассылки</span>
                                    <input
                                        value={name}
                                        onChange={event => setName(event.target.value)}
                                        maxLength={120}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                                    />
                                </label>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    <button
                                        onClick={() => setSendMode('now')}
                                        className={`rounded-xl border p-4 text-left ${
                                            sendMode === 'now' ? 'border-blue-300 bg-blue-50 text-[#1677e8]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Send size={17} />
                                        <div className="mt-2 text-sm">Отправить сейчас</div>
                                        <div className={`mt-1 text-xs ${sendMode === 'now' ? 'text-blue-500' : 'text-slate-400'}`}>Запуск сразу после подтверждения</div>
                                    </button>
                                    <button
                                        onClick={() => setSendMode('scheduled')}
                                        className={`rounded-xl border p-4 text-left ${
                                            sendMode === 'scheduled' ? 'border-blue-300 bg-blue-50 text-[#1677e8]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <CalendarClock size={17} />
                                        <div className="mt-2 text-sm">Запланировать</div>
                                        <div className={`mt-1 text-xs ${sendMode === 'scheduled' ? 'text-blue-500' : 'text-slate-400'}`}>Дата и время по вашему компьютеру</div>
                                    </button>
                                </div>

                                {sendMode === 'scheduled' && (
                                    <div className="mt-4">
                                        <span className="mb-1.5 block text-xs text-slate-500">Дата и время</span>
                                        <DateTimePicker
                                            value={scheduledAt}
                                            min={toLocalDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
                                            onChange={setScheduledAt}
                                        />
                                    </div>
                                )}

                                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="text-xs text-amber-900">Защита от случайной отправки</div>
                                    <div className="mt-1 text-[11px] leading-5 text-amber-700">
                                        Введите точную фразу <span className="font-mono font-semibold">{confirmPhrase}</span>
                                    </div>
                                    <input
                                        value={confirmText}
                                        onChange={event => setConfirmText(event.target.value)}
                                        placeholder={confirmPhrase}
                                        autoComplete="off"
                                        className="mt-2.5 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-400"
                                    />
                                </div>

                                {overLimit && (
                                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                                        Выбрано {selectedDeliveryCount} отправок. Максимум за один запуск — {MAX_BROADCAST_DELIVERIES}.
                                    </div>
                                )}
                            </section>

                            <section className="h-fit bg-[#fbfcfe] p-5 sm:p-8 lg:sticky lg:top-0 lg:p-10">
                                <h3 className="text-sm font-semibold text-slate-900">Проверка</h3>
                                <dl className="mt-4 grid gap-3 text-xs">
                                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Аудитория</dt><dd className="text-right text-slate-700">{selectedSegment.label}</dd></div>
                                    {!isEmptyAudienceFilter(filter) && (
                                        <div className="flex justify-between gap-4"><dt className="text-slate-400">Отбор</dt><dd className="text-right text-slate-700">по анкете и источнику</dd></div>
                                    )}
                                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Воронка</dt><dd className="text-right text-slate-700">{funnelId === 'all' ? 'Все' : funnels.find(item => item.id === funnelId)?.title || '—'}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Контактов</dt><dd className="text-right text-slate-700">{selectedIds.length}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Отправок</dt><dd className="text-right font-semibold text-slate-900">{selectedDeliveryCount}</dd></div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-400">Формат</dt>
                                        <dd className="text-right text-slate-700">
                                            {mediaType === 'photo'
                                                ? 'Текст + изображение'
                                                : mediaType === 'video'
                                                    ? 'Текст + видео'
                                                    : mediaType === 'videoNote'
                                                        ? 'Текст + кружок'
                                                        : 'Текст'}
                                        </dd>
                                    </div>
                                </dl>

                                <button
                                    onClick={() => void sendOrSchedule()}
                                    disabled={saving || loading || !hasContent || selectedDeliveryCount === 0 || overLimit || confirmText !== confirmPhrase}
                                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1677e8] px-4 text-sm font-medium text-white hover:bg-[#0f69ce] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : sendMode === 'scheduled' ? <CalendarClock size={16} /> : <Send size={16} />}
                                    {saving ? 'Сохраняем…' : sendMode === 'scheduled' ? 'Запланировать рассылку' : `Отправить · ${selectedDeliveryCount}`}
                                </button>
                            </section>
                        </div>
                    )}
                    </main>

                    <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
                        <button
                            onClick={() => void saveDraft()}
                            disabled={saving}
                            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 sm:hidden"
                        >
                            <Save size={15} />
                            <span className="hidden sm:inline">Сохранить черновик</span>
                            <span className="sm:hidden">Черновик</span>
                        </button>
                        <div className="flex gap-2">
                            {step > 1 && (
                                <button
                                    onClick={() => setStep((step - 1) as 1 | 2)}
                                    className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-[13px] font-medium text-[#1677e8] hover:bg-blue-50"
                                >
                                    <ArrowLeft size={15} /> Назад
                                </button>
                            )}
                            {step < 3 && (
                                <button
                                    onClick={() => setStep((step + 1) as 2 | 3)}
                                    disabled={(step === 1 && selectedDeliveryCount === 0) || (step === 2 && !hasContent)}
                                    className="flex min-h-10 items-center gap-2 rounded-lg bg-[#1677e8] px-5 text-[13px] font-medium text-white hover:bg-[#0f69ce] disabled:opacity-40"
                                >
                                    Далее <ArrowRight size={15} />
                                </button>
                            )}
                        </div>
                    </div>
                    </footer>
                </div>
            </div>

            {galleryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <button
                        type="button"
                        className="absolute inset-0"
                        onClick={() => setGalleryOpen(false)}
                        aria-label="Закрыть галерею"
                    />
                    <div className="relative flex max-h-[86dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">Выбрать из галереи</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {mediaType === 'photo' ? 'Показаны изображения' : 'Показаны видео'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setGalleryOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                                aria-label="Закрыть"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                            {galleryLoading ? (
                                <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-400">
                                    <Loader2 size={18} className="animate-spin" />
                                    Загружаю галерею…
                                </div>
                            ) : galleryError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                    {galleryError}
                                </div>
                            ) : galleryItems.filter(item => (
                                mediaType === 'photo' ? item.type === 'image' : item.type === 'video'
                            )).length === 0 ? (
                                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                                    <Images size={28} className="text-slate-300" />
                                    <p className="mt-3 text-sm text-slate-500">
                                        {mediaType === 'photo' ? 'В галерее нет изображений' : 'В галерее нет видео'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                    {galleryItems
                                        .filter(item => mediaType === 'photo' ? item.type === 'image' : item.type === 'video')
                                        .map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => selectGalleryMedia(item)}
                                                className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-md"
                                            >
                                                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                                                    {item.type === 'image' ? (
                                                        <img
                                                            src={item.url}
                                                            alt={item.name}
                                                            loading="lazy"
                                                            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                                        />
                                                    ) : (
                                                        <video
                                                            src={item.url}
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div className="truncate px-3 py-2.5 text-xs text-slate-700" title={item.name}>
                                                    {item.name}
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
