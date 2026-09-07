import React from 'react';

interface ProgressStatsProps {
    stats: { label: string; count: number; percent: number }[];
}

export default function ProgressStats({ stats }: ProgressStatsProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
            {stats.map((stat) => (
                <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="text-[13px] font-medium text-slate-500">{stat.label}</div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="text-2xl font-semibold text-slate-800">{stat.count}</div>
                        <div className="text-[12px] font-medium text-slate-500">{stat.percent}%</div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-slate-800"
                            style={{ width: `${stat.percent}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
