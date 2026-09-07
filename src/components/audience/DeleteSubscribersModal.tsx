import React from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteSubscribersModalProps {
    targets: any[];
    deleting: boolean;
    error: string;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteSubscribersModal({ targets, deleting, error, onCancel, onConfirm }: DeleteSubscribersModalProps) {
    const shown = targets.slice(0, 5);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start gap-4 px-6 pt-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                        <Trash2 size={20} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Удалить {targets.length === 1 ? 'подписчика' : `${targets.length} подписчиков`}?
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                            Профиль, история переписки и прогресс будут удалены без возможности восстановления.
                        </p>
                    </div>
                </div>

                <div className="mx-6 mt-4 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {shown.map(s => (
                        <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                                {s.firstName?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <span className="truncate font-medium">{s.firstName} {s.lastName || ''}</span>
                            {s.username && <span className="truncate text-slate-400">@{s.username}</span>}
                        </div>
                    ))}
                    {targets.length > shown.length && (
                        <div className="px-2 py-1.5 text-xs font-medium text-slate-400">и ещё {targets.length - shown.length}…</div>
                    )}
                </div>

                {error && (
                    <div className="mx-6 mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                        onClick={onCancel}
                        disabled={deleting}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                        {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        Удалить
                    </button>
                </div>
            </div>
        </div>
    );
}
