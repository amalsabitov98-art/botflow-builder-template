import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Search,
    Download,
    Send,
    CheckSquare,
    Trash2,
    UserCheck,
    CircleAlert,
    CircleDollarSign,
} from 'lucide-react';
import ChatPanel from './ChatPanel';
import { segmentPresets, pluralizeContacts, getProgressLabel, getNextActionLabel } from './audience/shared';
import BroadcastComposerModal from './broadcasts/BroadcastComposerModal';
import SubscribersTable from './audience/SubscribersTable';
import DeleteSubscribersModal from './audience/DeleteSubscribersModal';
import ModernSelect from './ui/ModernSelect';

export default function AudiencePage() {
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState<number[] | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [segmentFilter, setSegmentFilter] = useState<string>('all');
    const [funnelFilter, setFunnelFilter] = useState<string>('all');
    const [funnels, setFunnels] = useState<{ id: string; title: string }[]>([]);
    const [selectedSubscriber, setSelectedSubscriber] = useState<any | null>(null);
    const [broadcastOpen, setBroadcastOpen] = useState(false);

    useEffect(() => {
        // Выбор относится только к видимому срезу. Иначе после смены фильтра
        // рассылка незаметно захватывала скрытых подписчиков.
        setSelectedIds(new Set());
    }, [searchQuery, statusFilter, segmentFilter, funnelFilter]);

    useEffect(() => {
        let active = true;
        const loadSubscribers = async (silent = false) => {
            try {
                const res = await fetch('/api/subscribers');
                const data = await res.json();
                if (!active || !Array.isArray(data)) return;
                data.sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
                setSubscribers(data);
                setSelectedSubscriber((current: any) => {
                    if (!current) return null;
                    return data.find((subscriber: any) => subscriber.id === current.id) || current;
                });
            } catch (err) {
                if (!silent) console.error("Failed to load subscribers", err);
            } finally {
                if (active && !silent) setLoading(false);
            }
        };

        void loadSubscribers();
        const refreshOnFocus = () => void loadSubscribers(true);
        window.addEventListener('focus', refreshOnFocus);

        fetch('/api/funnels')
            .then(res => res.json())
            .then((data: any[]) => {
                setFunnels((Array.isArray(data) ? data : []).map(funnel => ({
                    id: funnel.id,
                    title: funnel.title || funnel.id,
                })));
            })
            .catch(err => console.error("Failed to load funnels", err));

        return () => {
            active = false;
            window.removeEventListener('focus', refreshOnFocus);
        };
    }, []);

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const performDelete = async (ids: number[]) => {
        if (ids.length === 0) return;
        setDeleting(true);
        setDeleteError('');
        try {
            let ok = false;
            if (ids.length === 1) {
                const res = await fetch(`/api/subscribers/${ids[0]}`, { method: 'DELETE' });
                ok = res.ok;
                if (!ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось удалить');
            } else {
                const res = await fetch('/api/subscribers/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids }),
                });
                ok = res.ok;
                if (!ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось удалить');
            }
            const removed = new Set(ids);
            setSubscribers(prev => prev.filter(sub => !removed.has(sub.id)));
            setSelectedIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            setDeleteConfirm(null);
            setSelectedSubscriber((current: any) => (current && removed.has(current.id) ? null : current));
        } catch (e: any) {
            setDeleteError(e.message || 'Не удалось удалить подписчиков');
        } finally {
            setDeleting(false);
        }
    };

    const handleExport = () => {
        if (filteredSubscribers.length === 0) return;

        // Build CSV string
        const headers = ['ID', 'Имя', 'Фамилия', 'Username', 'Воронка', 'Этап', 'Прогресс', 'Где застрял', 'Сегменты', 'Статус', 'Последняя активность'];
        const rows = filteredSubscribers.map(sub => [
            sub.id,
            `"${sub.firstName || ''}"`,
            `"${sub.lastName || ''}"`,
            `"${sub.username ? '@' + sub.username : ''}"`,
            `"${sub.funnel || ''}"`,
            `"${sub.stage || ''}"`,
            `"${getProgressLabel(sub)}"`,
            `"${getNextActionLabel(sub)}"`,
            `"${sub.progress?.segments?.join('; ') || ''}"`,
            sub.status === 'active' ? 'Активен' : 'Отписался',
            `"${new Date(sub.progress?.lastActionAt || sub.lastActive).toLocaleString('ru-RU')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(',') + '\n'
            + rows.map(e => e.join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `subscribers_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredSubscribers = useMemo(() => {
        return subscribers.filter(sub => {
            const matchesSearch =
                (sub.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sub.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sub.username || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesFilter = statusFilter === 'all' ? true : sub.status === statusFilter;
            const matchesSegment = segmentFilter === 'all' ? true : sub.progress?.segments?.includes(segmentFilter);
            const matchesFunnel = funnelFilter === 'all'
                ? true
                : (sub.funnelId === funnelFilter || (sub.funnels || []).some((f: any) => f.id === funnelFilter));

            return matchesSearch && matchesFilter && matchesSegment && matchesFunnel;
        });
    }, [subscribers, searchQuery, statusFilter, segmentFilter, funnelFilter]);

    const broadcastRecipientIds = useMemo(
        () => selectedIds.size > 0
            ? Array.from(selectedIds)
            : filteredSubscribers.map(subscriber => subscriber.id),
        [selectedIds, filteredSubscribers]
    );

    const segmentStats = useMemo(() => {
        return segmentPresets.map(segment => {
            const count = segment.key === 'all'
                ? subscribers.length
                : subscribers.filter(sub => sub.progress?.segments?.includes(segment.key)).length;
            return { ...segment, count };
        });
    }, [subscribers]);

    const overviewStats = useMemo(() => {
        const active = subscribers.filter(sub => sub.status === 'active').length;
        const paid = subscribers.filter(sub => sub.progress?.purchaseStatus === 'paid').length;
        const needsAttention = subscribers.filter(sub =>
            sub.status === 'active' &&
            sub.progress?.segments?.includes('lesson_opened_not_viewed')
        ).length;

        return [
            { label: 'Всего контактов', value: subscribers.length, hint: 'в единой базе', icon: Users, tone: 'slate' },
            { label: 'Активные', value: active, hint: 'получают сообщения', icon: UserCheck, tone: 'emerald' },
            { label: 'Требуют внимания', value: needsAttention, hint: 'открыли, но не завершили', icon: CircleAlert, tone: 'amber' },
            { label: 'Оплатили', value: paid, hint: 'успешных покупок', icon: CircleDollarSign, tone: 'blue' },
        ];
    }, [subscribers]);

    const toggleSelectAll = () => {
        const allSelected = filteredSubscribers.length > 0 && filteredSubscribers.every(s => selectedIds.has(s.id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) filteredSubscribers.forEach(s => next.delete(s.id));
            else filteredSubscribers.forEach(s => next.add(s.id));
            return next;
        });
    };

    return (
        <>
            <div className="admin-page flex-1 min-w-0 flex flex-col bg-[#f6f7f9] h-full overflow-hidden">
                <header className="border-b border-slate-200 bg-white px-4 py-5 shrink-0 sm:px-8 sm:py-6">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-2xl">Контакты</h1>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    {pluralizeContacts(subscribers.length)}
                                </span>
                            </div>
                            <p className="mt-1 text-[13px] text-slate-500 sm:text-sm">
                                Лиды и участники всех ваших воронок
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <button
                                onClick={handleExport}
                                disabled={filteredSubscribers.length === 0}
                                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download size={15} />
                                Экспорт
                            </button>
                            <button
                                onClick={() => setBroadcastOpen(true)}
                                disabled={filteredSubscribers.length === 0}
                                className="flex items-center justify-center gap-2 rounded-xl border border-[#1677e8] bg-[#1677e8] px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:border-[#0f69ce] hover:bg-[#0f69ce] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Send size={15} />
                                {selectedIds.size > 0 ? `Рассылка · ${selectedIds.size}` : 'Рассылка'}
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto">
                    <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-8 sm:py-7">
                        <section className="mb-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-4">
                            {overviewStats.map((stat, index) => {
                                const Icon = stat.icon;
                                const tones: Record<string, string> = {
                                    slate: 'bg-slate-100 text-slate-500',
                                    emerald: 'bg-emerald-50 text-emerald-600',
                                    amber: 'bg-amber-50 text-amber-600',
                                    blue: 'bg-blue-50 text-blue-600',
                                };
                                return (
                                    <div
                                        key={stat.label}
                                        className={`min-w-0 p-4 sm:p-5 ${index % 2 !== 0 ? 'border-l border-slate-100' : ''} ${index >= 2 ? 'border-t border-slate-100 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-slate-100' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400 sm:text-xs">{stat.label}</div>
                                                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px]">{stat.value}</div>
                                                <div className="mt-1 hidden text-xs text-slate-400 sm:block">{stat.hint}</div>
                                            </div>
                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[stat.tone]}`}>
                                                <Icon size={17} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>

                        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(260px,1fr)_190px_190px_220px]">
                                <div className="relative col-span-2 lg:col-span-1">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Найти по имени или @username"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[13px] text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                                    />
                                </div>
                                <ModernSelect
                                    value={statusFilter}
                                    onChange={(nextValue) => setStatusFilter(nextValue as 'all' | 'active' | 'inactive')}
                                    options={[
                                        { value: 'all', label: 'Любой статус' },
                                        { value: 'active', label: 'Активные' },
                                        { value: 'inactive', label: 'Отписались' },
                                    ]}
                                    buttonClassName="h-10 bg-slate-50 text-[13px] shadow-none"
                                    ariaLabel="Фильтр по статусу"
                                />
                                <ModernSelect
                                    value={funnelFilter}
                                    onChange={setFunnelFilter}
                                    options={[
                                        { value: 'all', label: 'Все воронки' },
                                        ...funnels.map(funnel => ({ value: funnel.id, label: funnel.title })),
                                    ]}
                                    searchable
                                    searchPlaceholder="Найти воронку"
                                    buttonClassName="h-10 bg-slate-50 text-[13px] shadow-none"
                                    ariaLabel="Фильтр по воронке"
                                />
                                <ModernSelect
                                    value={segmentFilter}
                                    onChange={setSegmentFilter}
                                    options={segmentStats.map(segment => ({
                                        value: segment.key,
                                        label: `${segment.label} · ${segment.count}`,
                                    }))}
                                    className="col-span-2 lg:col-span-1"
                                    buttonClassName="h-10 bg-slate-50 text-[13px] shadow-none"
                                    ariaLabel="Фильтр по сегменту"
                                />
                            </div>
                        </section>

                        {selectedIds.size > 0 && (
                            <div className="mb-3 flex flex-col items-stretch gap-3 rounded-2xl border border-slate-300 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <CheckSquare size={16} />
                                    Выбрано: {selectedIds.size}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        Отменить
                                    </button>
                                    <button
                                        onClick={() => setBroadcastOpen(true)}
                                        className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-1.5 text-[13px] text-white transition-colors hover:bg-white/15"
                                    >
                                        <Send size={15} />
                                        Написать
                                    </button>
                                    <button
                                        onClick={() => { setDeleteError(''); setDeleteConfirm(Array.from(selectedIds)); }}
                                        className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                                    >
                                        <Trash2 size={15} />
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        )}

                        <SubscribersTable
                            loading={loading}
                            subscribers={filteredSubscribers}
                            emptyBecauseFilters={Boolean(searchQuery) || statusFilter !== 'all' || segmentFilter !== 'all' || funnelFilter !== 'all'}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onToggleSelectAll={toggleSelectAll}
                            onSelectSubscriber={setSelectedSubscriber}
                            onDeleteRequest={(ids) => { setDeleteError(''); setDeleteConfirm(ids); }}
                        />
                    </main>
                </div>
            </div>

            {deleteConfirm && (
                <DeleteSubscribersModal
                    targets={subscribers.filter(s => deleteConfirm.includes(s.id))}
                    deleting={deleting}
                    error={deleteError}
                    onCancel={() => { setDeleteConfirm(null); setDeleteError(''); }}
                    onConfirm={() => performDelete(deleteConfirm)}
                />
            )}

            {broadcastOpen && (
                <BroadcastComposerModal
                    funnels={funnels}
                    initialSegmentKey={segmentFilter}
                    initialFunnelId={funnelFilter}
                    initialRecipientIds={broadcastRecipientIds}
                    initialAudienceLabel={selectedIds.size > 0
                        ? `Выбрано вручную: ${pluralizeContacts(selectedIds.size)}`
                        : `Текущий список: ${pluralizeContacts(filteredSubscribers.length)}`}
                    onClose={() => setBroadcastOpen(false)}
                    onSaved={() => undefined}
                />
            )}

            {/* Chat Panel */}
            {
                selectedSubscriber && (
                    <ChatPanel
                        subscriber={selectedSubscriber}
                        onClose={() => setSelectedSubscriber(null)}
                    />
                )
            }
        </>
    );
}
