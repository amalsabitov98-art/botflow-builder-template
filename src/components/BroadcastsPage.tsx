import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarClock,
    Clock3,
    FilePenLine,
    Loader2,
    Megaphone,
    Plus,
    Search,
    Send,
    Sparkles,
    Trash2,
} from 'lucide-react';
import BroadcastHistory from './audience/BroadcastHistory';
import BroadcastRulesTab from './audience/BroadcastRulesTab';
import BroadcastComposerModal from './broadcasts/BroadcastComposerModal';

type CampaignFilter = 'sent' | 'draft' | 'scheduled';
type PageSection = 'campaigns' | 'automation';

const sentStatuses = new Set(['sending', 'sent', 'partial', 'failed', 'skipped']);

export default function BroadcastsPage() {
    const [data, setData] = useState<{ campaigns: any[]; rules: any[]; templates: any[] }>({
        campaigns: [],
        rules: [],
        templates: [],
    });
    const [funnels, setFunnels] = useState<{ id: string; title: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [section, setSection] = useState<PageSection>('campaigns');
    const [filter, setFilter] = useState<CampaignFilter>('sent');
    const [search, setSearch] = useState('');
    const [composerOpen, setComposerOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
    const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [broadcastResponse, funnelsResponse] = await Promise.all([
                fetch('/api/broadcasts'),
                fetch('/api/funnels'),
            ]);
            const broadcastData = await broadcastResponse.json();
            const funnelData = await funnelsResponse.json();
            if (!broadcastResponse.ok) throw new Error(broadcastData.error || 'Не удалось загрузить рассылки');
            setData({
                campaigns: Array.isArray(broadcastData.campaigns) ? broadcastData.campaigns : [],
                rules: Array.isArray(broadcastData.rules) ? broadcastData.rules : [],
                templates: Array.isArray(broadcastData.templates) ? broadcastData.templates : [],
            });
            setFunnels((Array.isArray(funnelData) ? funnelData : []).map((funnel: any) => ({
                id: funnel.id,
                title: funnel.title || funnel.id,
            })));
            setError('');
        } catch (cause: any) {
            setError(cause.message || 'Не удалось загрузить рассылки');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const hasActiveSendingCampaign = data.campaigns.some(campaign => {
        if (campaign.status !== 'sending') return false;
        const startedAt = new Date(campaign.updatedAt || campaign.sentAt || campaign.createdAt || 0).getTime();
        return Number.isFinite(startedAt) && Date.now() - startedAt < 5 * 60_000;
    });

    useEffect(() => {
        if (!hasActiveSendingCampaign) return;
        const timer = window.setInterval(() => void loadData(true), 2000);
        return () => window.clearInterval(timer);

    }, [hasActiveSendingCampaign]);

    const counts = useMemo(() => ({
        sent: data.campaigns.filter(campaign => sentStatuses.has(campaign.status)).length,
        draft: data.campaigns.filter(campaign => campaign.status === 'draft').length,
        scheduled: data.campaigns.filter(campaign => campaign.status === 'scheduled').length,
    }), [data.campaigns]);

    const filteredCampaigns = useMemo(() => {
        const query = search.trim().toLowerCase();
        return data.campaigns.filter(campaign => {
            const matchesStatus = filter === 'sent'
                ? sentStatuses.has(campaign.status)
                : campaign.status === filter;
            if (!matchesStatus) return false;
            if (!query) return true;
            return [
                campaign.name,
                campaign.text,
                campaign.segmentLabel,
                campaign.funnelLabel,
            ].some(value => String(value || '').toLowerCase().includes(query));
        });
    }, [data.campaigns, filter, search]);

    const openComposer = (campaign: any | null = null) => {
        setEditingCampaign(campaign);
        setComposerOpen(true);
    };

    const deleteCampaign = async (campaign: any) => {
        const label = campaign.status === 'scheduled' ? 'запланированную рассылку' : 'черновик';
        if (!window.confirm(`Удалить ${label} «${campaign.name || 'Без названия'}»?`)) return;
        try {
            const response = await fetch(`/api/broadcasts/${campaign.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Не удалось удалить');
            await loadData(true);
        } catch (cause: any) {
            setError(cause.message || 'Не удалось удалить');
        }
    };

    const statusTabs: Array<{ key: CampaignFilter; label: string; icon: React.ElementType }> = [
        { key: 'sent', label: 'Отправлены', icon: Send },
        { key: 'draft', label: 'Черновики', icon: FilePenLine },
        { key: 'scheduled', label: 'Запланированы', icon: CalendarClock },
    ];

    return (
        <>
            <div className="admin-page flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f6f7f9]">
                <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-5 sm:px-8 sm:py-6">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-2xl">Рассылки</h1>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    {data.campaigns.length}
                                </span>
                            </div>
                            <p className="mt-1 text-[13px] text-slate-500 sm:text-sm">
                                Сегменты, сообщения, планирование и результаты в одном месте
                            </p>
                        </div>
                        <button
                            onClick={() => openComposer()}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1677e8] px-5 text-[13px] font-medium text-white shadow-sm hover:bg-[#0f69ce]"
                        >
                            <Plus size={16} />
                            Новая рассылка
                        </button>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-auto">
                    <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-8 sm:py-7">
                        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
                            <button
                                onClick={() => setSection('campaigns')}
                                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] ${
                                    section === 'campaigns' ? 'bg-blue-50 text-[#1677e8]' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                <Megaphone size={15} /> Рассылки
                            </button>
                            <button
                                onClick={() => setSection('automation')}
                                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] ${
                                    section === 'automation' ? 'bg-blue-50 text-[#1677e8]' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                <Sparkles size={15} /> Автосообщения
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                    section === 'automation' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                }`}>{data.rules.length}</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                                {error}
                            </div>
                        )}

                        {section === 'automation' ? (
                            <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                                <BroadcastRulesTab
                                    rules={data.rules}
                                    onRuleCreated={rule => setData(current => ({ ...current, rules: [rule, ...current.rules] }))}
                                    onRuleUpdated={rule => setData(current => ({
                                        ...current,
                                        rules: current.rules.map(item => item.id === rule.id ? rule : item),
                                    }))}
                                    onError={setError}
                                />
                            </div>
                        ) : (
                            <>
                                <section className="mb-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {statusTabs.map((tab, index) => {
                                        const Icon = tab.icon;
                                        const active = filter === tab.key;
                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => setFilter(tab.key)}
                                                className={`min-w-0 p-3 text-left transition-colors sm:p-5 ${
                                                    index > 0 ? 'border-l border-slate-200' : ''
                                                } ${active ? 'bg-blue-50 text-[#1677e8]' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <Icon size={16} className={active ? 'text-[#1677e8]' : 'text-slate-400'} />
                                                    <span className={`text-xl font-semibold sm:text-2xl ${active ? 'text-[#1677e8]' : 'text-slate-900'}`}>
                                                        {counts[tab.key]}
                                                    </span>
                                                </div>
                                                <div className={`mt-2 truncate text-[11px] sm:text-[13px] ${active ? 'text-blue-600' : 'text-slate-500'}`}>
                                                    {tab.label}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </section>

                                <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={search}
                                            onChange={event => setSearch(event.target.value)}
                                            placeholder="Найти по названию, тексту, сегменту или воронке"
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                                        />
                                    </div>
                                </section>

                                {loading ? (
                                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-400">
                                        <Loader2 size={18} className="animate-spin" /> Загружаем рассылки
                                    </div>
                                ) : filter === 'sent' ? (
                                    <BroadcastHistory
                                        campaigns={filteredCampaigns}
                                        expandedCampaignId={expandedCampaignId}
                                        onToggleExpanded={setExpandedCampaignId}
                                    />
                                ) : filteredCampaigns.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                                        {filter === 'draft'
                                            ? <FilePenLine size={30} className="mx-auto text-slate-300" />
                                            : <CalendarClock size={30} className="mx-auto text-slate-300" />}
                                        <div className="mt-3 text-sm font-medium text-slate-700">
                                            {filter === 'draft' ? 'Черновиков пока нет' : 'Нет запланированных рассылок'}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-400">
                                            Создайте рассылку и сохраните её на нужном шаге.
                                        </div>
                                        <button
                                            onClick={() => openComposer()}
                                            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1677e8] px-4 text-[13px] text-white hover:bg-[#0f69ce]"
                                        >
                                            <Plus size={15} /> Новая рассылка
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {filteredCampaigns.map(campaign => (
                                            <article key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`rounded-full px-2.5 py-1 text-[11px] ${
                                                                campaign.status === 'scheduled'
                                                                    ? 'bg-sky-50 text-sky-700'
                                                                    : 'bg-amber-50 text-amber-700'
                                                            }`}>
                                                                {campaign.status === 'scheduled' ? 'Запланирована' : 'Черновик'}
                                                            </span>
                                                            <span className="text-sm font-medium text-slate-900">{campaign.name || 'Без названия'}</span>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                                                            <span>{campaign.segmentLabel}</span>
                                                            {campaign.funnelLabel && <span>{campaign.funnelLabel}</span>}
                                                            <span>{campaign.result?.total || 0} получателей</span>
                                                        </div>
                                                        {campaign.status === 'scheduled' && campaign.scheduledAt && (
                                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-700">
                                                                <Clock3 size={13} />
                                                                {new Date(campaign.scheduledAt).toLocaleString('ru-RU')}
                                                            </div>
                                                        )}
                                                        {campaign.text && (
                                                            <div className="mt-3 line-clamp-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                                                {campaign.text}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 gap-2">
                                                        <button
                                                            onClick={() => openComposer(campaign)}
                                                            className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-600 hover:bg-slate-50"
                                                        >
                                                            <FilePenLine size={14} /> Продолжить
                                                        </button>
                                                        <button
                                                            onClick={() => void deleteCampaign(campaign)}
                                                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                                            aria-label="Удалить"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>

            {composerOpen && (
                <BroadcastComposerModal
                    funnels={funnels}
                    initialCampaign={editingCampaign}
                    onClose={() => {
                        setComposerOpen(false);
                        setEditingCampaign(null);
                    }}
                    onSaved={() => void loadData(true)}
                />
            )}
        </>
    );
}
