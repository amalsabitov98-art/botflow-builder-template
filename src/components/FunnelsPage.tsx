import React, { useState, useEffect, useMemo } from 'react';
import { Plus, MoreVertical, Trash2, Edit2, Bot, Users, Zap } from 'lucide-react';
import { FUNNEL_TYPE_ORDER, UNTYPED_LABEL, getFunnelTypeLabel } from '../utils/funnelTypes';

interface FunnelsPageProps {
    funnels: any[];
    onOpenFunnel: (id: string) => void;
    onCreateFunnel: () => void;
    onDeleteFunnel: (id: string, e: React.MouseEvent) => void;
}

function pluralRu(value: number, one: string, few: string, many: string) {
    const abs = Math.abs(value);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
}

export default function FunnelsPage({ funnels, onOpenFunnel, onCreateFunnel, onDeleteFunnel }: FunnelsPageProps) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [funnelToDelete, setFunnelToDelete] = useState<any | null>(null);
    const [bots, setBots] = useState<any[]>([]);
    const [typeFilter, setTypeFilter] = useState<string>('all');

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.bots) {
                    setBots(data.bots);
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-funnel-menu]')) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Показываем только те виды, которые реально есть: пустые кнопки в фильтре
    // ничего не сообщают, кроме того, что таких воронок нет.
    const typeFilters = useMemo(() => {
        const counts = new Map<string, number>();
        for (const funnel of funnels) counts.set(funnel.type || 'none', (counts.get(funnel.type || 'none') || 0) + 1);
        const present = [...FUNNEL_TYPE_ORDER, 'none'].filter(value => counts.has(value));
        if (present.length < 2) return [];
        return [
            { value: 'all', label: 'Все', count: funnels.length },
            ...present.map(value => ({
                value,
                label: value === 'none' ? UNTYPED_LABEL : getFunnelTypeLabel(value),
                count: counts.get(value) || 0,
            })),
        ];
    }, [funnels]);

    const visibleFunnels = useMemo(() => (
        typeFilter === 'all'
            ? funnels
            : funnels.filter(funnel => (funnel.type || 'none') === typeFilter)
    ), [funnels, typeFilter]);

    const getConnectedBotName = (botId: string) => {
        const bot = bots.find(b => b.id === botId);
        return bot ? `@${bot.name}` : 'Нет бота';
    };

    return (
        <div className="admin-page flex-1 min-w-0 overflow-y-auto bg-[#f8f8fb] p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header Section */}
                <div className="admin-page-header flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Мои воронки</h1>
                        <p className="text-slate-500 text-sm mt-1">Управляйте вашими проектами и запускайте ботов.</p>
                    </div>
                    <div className="flex w-full gap-3 sm:w-auto">
                        <button
                            onClick={onCreateFunnel}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-indigo-600 px-5 py-3 sm:py-2.5 rounded-xl text-[13px] font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={16} />
                            Создать воронку
                        </button>
                    </div>
                </div>

                {typeFilters.length > 0 && (
                    <div className="mb-5 flex flex-wrap gap-2">
                        {typeFilters.map(item => (
                            <button
                                key={item.value}
                                onClick={() => setTypeFilter(item.value)}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition ${
                                    typeFilter === item.value
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                {item.label}
                                <span className="text-[11px] font-bold text-slate-400">{item.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Funnels Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">

                    {/* New Funnel Card */}
                    <div
                        onClick={onCreateFunnel}
                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 border-dashed flex flex-col items-center justify-center h-[280px] p-6 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all group"
                    >
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            <Plus size={32} />
                        </div>
                        <h3 className="font-bold text-slate-700 text-base mb-1">Новая воронка</h3>
                        <p className="text-slate-400 text-[13px] text-center">Создайте новую воронку и настройте её</p>
                    </div>

                    {/* Dynamic Funnel Cards */}
                    {visibleFunnels.map((funnel) => (
                        <div
                            key={funnel.id}
                            onClick={(e) => {
                                // Don't navigate if the click was on the context menu or its button
                                if ((e.target as HTMLElement).closest('[data-funnel-menu]')) return;
                                onOpenFunnel(funnel.id);
                            }}
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 transition-all group flex flex-col h-[280px] relative"
                        >
                            {/* Context Menu Button */}
                            <div className="absolute top-3 right-3 z-30" data-funnel-menu>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setActiveMenu(activeMenu === funnel.id ? null : funnel.id);
                                    }}
                                    className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600 shadow-sm transition-all"
                                >
                                    <MoreVertical size={18} />
                                </button>

                                {activeMenu === funnel.id && (
                                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-30">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onOpenFunnel(funnel.id); setActiveMenu(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 text-left"
                                        >
                                            <Edit2 size={16} className="text-slate-400" />
                                            Редактировать
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFunnelToDelete(funnel);
                                                setActiveMenu(null);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 text-left"
                                        >
                                            <Trash2 size={16} className="text-rose-400" />
                                            Удалить
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Cover / Header Section */}
                            <div className={`h-40 relative overflow-hidden flex flex-col justify-between ${funnel.status === 'active' ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                                <img
                                    src={`https://picsum.photos/seed/${funnel.id}/400/300`}
                                    alt={funnel.title}
                                    className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500 absolute inset-0 z-0"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-10"></div>

                                <div className="relative z-20 p-3 flex flex-col h-full justify-between">
                                    <div>
                                        {funnel.status === 'active' ? (
                                            <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md text-[11px] font-bold text-emerald-600 shadow-sm uppercase tracking-wider">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                Запущена
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 shadow-sm uppercase tracking-wider">
                                                Черновик
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium shadow-sm border bg-black/50 backdrop-blur-md text-white border-white/20">
                                            <Bot size={12} className={funnel.status === 'active' ? 'text-cyan-300' : 'text-slate-300'} />
                                            <span className="truncate max-w-[120px]">{getConnectedBotName(funnel.connectedBotId)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="p-5 flex-1 flex flex-col justify-between bg-white relative z-20">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-[15px] leading-tight mb-1 pr-4 line-clamp-2">{funnel.title}</h3>
                                    <div className="mb-1.5 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                        {getFunnelTypeLabel(funnel.type)}
                                    </div>
                                    <p className="text-[12px] text-slate-400 mb-4">{funnel.stages?.length || 0} {pluralRu(funnel.stages?.length || 0, 'этап', 'этапа', 'этапов')} • Создана {funnel.createdAt || 'Недавно'}</p>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] text-slate-400 mb-0.5 flex items-center gap-1"><Users size={12} /> Подписчики</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-700">{funnel.subscribers || 0}</span>
                                            {funnel.activeSubscribers > 0 && (
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md" title="Активные (не заблокировали бота)">
                                                    {funnel.activeSubscribers} акт.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-slate-400 mb-0.5 flex items-center gap-1"><Zap size={12} /> Конверсия</span>
                                        <span className="font-semibold text-emerald-600 border border-emerald-100 bg-emerald-50/50 px-2 rounded">{funnel.conversion || '0%'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Delete Confirmation Modal */}
            {funnelToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setFunnelToDelete(null)}></div>
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl">
                        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Удалить воронку?</h3>
                        <p className="text-slate-500 text-[15px] mb-8 leading-relaxed">
                            Вы уверены, что хотите удалить «<span className="font-medium text-slate-700">{funnelToDelete.title}</span>»? Это действие нельзя отменить.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setFunnelToDelete(null)}
                                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-[15px]"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={(e) => {
                                    onDeleteFunnel(funnelToDelete.id, e);
                                    setFunnelToDelete(null);
                                }}
                                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors text-[15px]"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
