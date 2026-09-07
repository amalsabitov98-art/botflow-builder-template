import React from 'react';
import type { SegmentPreset } from './shared';

interface SegmentCardsProps {
    stats: (SegmentPreset & { count: number })[];
    activeKey: string;
    onSelect: (key: string) => void;
}

export default function SegmentCards({ stats, activeKey, onSelect }: SegmentCardsProps) {
    return (
        <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-[15px] font-semibold text-slate-800">Сегменты</h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">Быстрый выбор аудитории для будущих рассылок.</p>
                </div>
                {activeKey !== 'all' && (
                    <button
                        onClick={() => onSelect('all')}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        Сбросить сегмент
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {stats.map(segment => (
                    <button
                        key={segment.key}
                        onClick={() => onSelect(segment.key)}
                        className={`rounded-2xl border p-3 sm:p-4 text-left transition-all ${
                            activeKey === segment.key
                                ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                activeKey === segment.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                <segment.icon size={16} />
                            </div>
                            <span className="text-xl font-semibold text-slate-900">{segment.count}</span>
                        </div>
                        <div className="mt-3 text-[13px] font-semibold text-slate-800 leading-tight">{segment.label}</div>
                        <div className="mt-1 text-xs leading-4 text-slate-500">{segment.description}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
