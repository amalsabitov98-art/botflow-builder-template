import React from 'react';
import { History, ChevronDown, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';

const campaignStatusMeta: Record<string, { label: string; cls: string }> = {
    sending: { label: 'Отправляется…', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    sent: { label: 'Доставлено', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partial: { label: 'Частично', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    failed: { label: 'Не доставлено', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    skipped: { label: 'Пропущено', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const campaignTypeLabels: Record<string, string> = {
    manual: 'Ручная',
    auto: 'Авто-дожим',
    test: 'Тест',
};

interface BroadcastHistoryProps {
    campaigns: any[];
    expandedCampaignId: string | null;
    onToggleExpanded: (campaignId: string | null) => void;
}

export default function BroadcastHistory({ campaigns, expandedCampaignId, onToggleExpanded }: BroadcastHistoryProps) {
    return (
        <div className="grid gap-3">
            {campaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <History size={28} className="mx-auto mb-2 text-slate-300" />
                    <div className="text-sm font-medium text-slate-500">Здесь появятся отправленные рассылки</div>
                    <div className="mt-1 text-xs text-slate-400">По каждой будет видно, кому ушло, а кому нет.</div>
                </div>
            ) : campaigns.slice(0, 30).map(campaign => {
                const meta = campaignStatusMeta[campaign.status] || campaignStatusMeta.failed;
                const expanded = expandedCampaignId === campaign.id;
                const recipients = campaign.recipients || [];
                return (
                    <div key={campaign.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                                        <span className="text-sm font-semibold text-slate-800">{campaign.name || campaign.segmentLabel}</span>
                                        {campaign.funnelLabel && (
                                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{campaign.funnelLabel}</span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 text-xs text-slate-500">
                                        {campaign.segmentLabel} · {campaignTypeLabels[campaign.type] || campaign.type} · {new Date(campaign.createdAt).toLocaleString('ru-RU')}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-lg font-semibold text-slate-800">{campaign.result.sent}<span className="text-sm font-medium text-slate-400">/{campaign.result.total}</span></div>
                                    <div className="text-[11px] text-slate-400">доставлено</div>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                    <CheckCircle2 size={12} /> Доставлено {campaign.result.sent}
                                </span>
                                {campaign.result.failed > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600">
                                        <XCircle size={12} /> Ошибки {campaign.result.failed}
                                    </span>
                                )}
                                {(campaign.result.blocked || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                        <XCircle size={12} /> Заблокировали бота {campaign.result.blocked}
                                    </span>
                                )}
                                {campaign.result.skipped > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                        <MinusCircle size={12} /> Без бота {campaign.result.skipped}
                                    </span>
                                )}
                            </div>

                            {campaign.error && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] leading-4 text-rose-700">
                                    <AlertTriangle size={13} className="mt-px shrink-0" />
                                    <span>{campaign.error}</span>
                                </div>
                            )}

                            {campaign.text && (
                                <div className="mt-3 line-clamp-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{campaign.text}</div>
                            )}

                            {recipients.length > 0 && (
                                <button
                                    onClick={() => onToggleExpanded(expanded ? null : campaign.id)}
                                    className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                    {expanded ? 'Скрыть получателей' : `Показать получателей (${recipients.length})`}
                                </button>
                            )}
                        </div>

                        {expanded && recipients.length > 0 && (
                            <div className="max-h-52 overflow-auto border-t border-slate-100 bg-slate-50/60">
                                {recipients.map((recipient: any, idx: number) => {
                                    const rMeta = recipient.status === 'sent'
                                        ? { icon: CheckCircle2, cls: 'text-emerald-600', label: 'доставлено' }
                                        : recipient.status === 'failed'
                                            ? { icon: XCircle, cls: 'text-rose-500', label: 'ошибка' }
                                            : recipient.status === 'blocked'
                                                ? { icon: XCircle, cls: 'text-slate-500', label: 'заблокировал бота' }
                                                : { icon: MinusCircle, cls: 'text-slate-400', label: 'без бота' };
                                    const RIcon = rMeta.icon;
                                    return (
                                        <div key={`${recipient.chatId}-${idx}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
                                            <RIcon size={15} className={`shrink-0 ${rMeta.cls}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[13px] font-medium text-slate-700">
                                                    {recipient.firstName || 'Без имени'} {recipient.username ? `@${recipient.username}` : ''}
                                                </div>
                                                {recipient.error && <div className="truncate text-[11px] text-rose-400">{recipient.error}</div>}
                                            </div>
                                            <span className={`shrink-0 text-[11px] font-medium ${rMeta.cls}`}>{rMeta.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
