import React from 'react';
import { Users, Loader2, CheckSquare, Square, Trash2 } from 'lucide-react';
import { formatRelativeTime, getProgressLabel, getProgressClass, getNextActionLabel, getLastEventLabel } from './shared';
import ContactAvatar from './ContactAvatar';

interface SubscribersTableProps {
    loading: boolean;
    subscribers: any[];
    emptyBecauseFilters: boolean;
    selectedIds: Set<number>;
    onToggleSelect: (id: number) => void;
    onToggleSelectAll: () => void;
    onSelectSubscriber: (contact: any) => void;
    onDeleteRequest: (ids: number[]) => void;
}

export default function SubscribersTable({
    loading,
    subscribers,
    emptyBecauseFilters,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onSelectSubscriber,
    onDeleteRequest,
}: SubscribersTableProps) {
    const allSelected = subscribers.length > 0 && subscribers.every(s => selectedIds.has(s.id));
    const getMessagePreview = (contact: any) => {
        const message = contact.lastMessage;
        if (!message) return '';
        if (message.text) return message.text;
        const mediaLabels: Record<string, string> = {
            photo: 'Фотография',
            video: 'Видео',
            videoNote: 'Видеосообщение',
            animation: 'GIF',
            document: 'Документ',
            sticker: 'Стикер',
            voice: 'Голосовое сообщение',
            audio: 'Аудио',
        };
        return mediaLabels[message.media?.type] || 'Новое сообщение';
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {loading ? (
                <div className="flex items-center justify-center p-10 text-sm text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Загрузка подписчиков...
                </div>
            ) : subscribers.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">
                    <Users size={32} className="mx-auto text-slate-300 mb-3" />
                    {emptyBecauseFilters
                        ? 'Ничего не найдено по вашему запросу.'
                        : <>Пока нет ни одного подписчика.<br />Пользователи появятся здесь, как только начнут взаимодействовать с ботом.</>}
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
                        <div>
                            <h2 className="text-[14px] font-medium text-slate-800">База контактов</h2>
                            <p className="mt-0.5 text-xs text-slate-400">Нажмите на контакт, чтобы открыть карточку и переписку</p>
                        </div>
                        <button
                            onClick={onToggleSelectAll}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 md:hidden"
                        >
                            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            {allSelected ? 'Снять все' : 'Выбрать все'}
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100 md:hidden">
                        {subscribers.map(contact => {
                            const progressLabel = getProgressLabel(contact);
                            return (
                                <div
                                    key={contact.id}
                                    onClick={() => onSelectSubscriber(contact)}
                                    className={`cursor-pointer p-4 transition-colors ${selectedIds.has(contact.id) ? 'bg-slate-50' : 'bg-white active:bg-slate-50'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleSelect(contact.id); }}
                                            className="mt-2 flex shrink-0 items-center text-slate-300"
                                            aria-label="Выбрать контакт"
                                        >
                                            {selectedIds.has(contact.id)
                                                ? <CheckSquare size={17} className="text-slate-800" />
                                                : <Square size={17} />}
                                        </button>
                                        <ContactAvatar
                                            contactId={contact.id}
                                            firstName={contact.firstName}
                                            lastName={contact.lastName}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[14px] font-medium text-slate-800">
                                                        {contact.firstName} {contact.lastName}
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                                                        <span className="truncate">{contact.username ? `@${contact.username}` : 'Без username'}</span>
                                                        {contact.isTest && (
                                                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-600">Тест</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${contact.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${contact.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {contact.status === 'active' ? 'Активен' : 'Отписался'}
                                                </span>
                                            </div>
                                            <div className="mt-3 rounded-xl bg-slate-50 p-3">
                                                <div className="truncate text-xs text-slate-500">{contact.funnel || 'Без воронки'}</div>
                                                <div className="mt-1 truncate text-[13px] font-medium text-slate-700">{contact.stage || 'Этап не указан'}</div>
                                                {contact.source && (
                                                    <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                                        <span className="shrink-0">Источник:</span>
                                                        <span className="truncate font-medium text-slate-700">{contact.source}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Состояние</div>
                                                    <span className={`mt-1 inline-flex rounded-lg px-2 py-1 text-[11px] font-medium ${getProgressClass(progressLabel)}`}>
                                                        {progressLabel}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Следующий шаг</div>
                                                    <div className={`mt-1 text-xs ${contact.awaitingHumanReply ? 'font-semibold text-rose-700' : contact.pendingReplyCount > 0 ? 'font-medium text-amber-700' : 'text-slate-600'}`}>
                                                        {contact.awaitingHumanReply
                                                            ? 'Ассистент передал вам'
                                                            : contact.pendingReplyCount > 0 ? 'Ответить клиенту' : getNextActionLabel(contact)}
                                                    </div>
                                                </div>
                                            </div>
                                            {contact.lastMessage && (
                                                <div className={`mt-3 truncate rounded-lg px-2.5 py-2 text-xs ${contact.pendingReplyCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500'}`}>
                                                    {contact.lastMessage.from === 'user' ? 'Клиент: ' : 'Вы: '}
                                                    {getMessagePreview(contact)}
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                                <span className="text-[11px] text-slate-400">
                                                    {formatRelativeTime(contact.progress?.lastActionAt || contact.lastActive)}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteRequest([contact.id]); }}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                    aria-label="Удалить контакт"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="relative w-full min-w-[940px]">
                            <thead className="border-b border-slate-200 bg-slate-50/80">
                                <tr>
                                    <th className="w-12 px-4 py-3">
                                        <button
                                            onClick={onToggleSelectAll}
                                            className="flex items-center text-slate-400 transition-colors hover:text-slate-800"
                                            title="Выбрать всех"
                                        >
                                            {allSelected
                                                ? <CheckSquare size={17} className="text-slate-800" />
                                                : <Square size={17} />}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Контакт</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Воронка и этап</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Состояние</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Следующий шаг</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Активность</th>
                                    <th className="w-14 px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {subscribers.map(contact => {
                                    const progressLabel = getProgressLabel(contact);
                                    return (
                                        <tr
                                            key={contact.id}
                                            onClick={() => onSelectSubscriber(contact)}
                                            className={`group cursor-pointer border-b border-slate-100 transition-colors last:border-0 ${selectedIds.has(contact.id) ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}
                                        >
                                            <td className="w-12 px-4 py-4" onClick={(e) => { e.stopPropagation(); onToggleSelect(contact.id); }}>
                                                <button className="flex items-center text-slate-300 transition-colors hover:text-slate-800">
                                                    {selectedIds.has(contact.id)
                                                        ? <CheckSquare size={17} className="text-slate-800" />
                                                        : <Square size={17} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <ContactAvatar
                                                        contactId={contact.id}
                                                        firstName={contact.firstName}
                                                        lastName={contact.lastName}
                                                        size="sm"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="max-w-[200px] truncate text-[13px] font-medium text-slate-800">{contact.firstName} {contact.lastName}</div>
                                                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                                                            <span className="max-w-[150px] truncate">{contact.username ? `@${contact.username}` : 'Без username'}</span>
                                                            {contact.isTest && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-600">Тест</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="max-w-[230px] truncate text-[13px] text-slate-700">{contact.funnel || 'Без воронки'}</div>
                                                <div className="mt-1 max-w-[230px] truncate text-[11px] text-slate-400">{contact.stage || 'Этап не указан'}</div>
                                                {contact.source && (
                                                    <div className="mt-1 max-w-[230px] truncate text-[11px] text-slate-500">
                                                        Источник: <span className="font-medium text-slate-700">{contact.source}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${getProgressClass(progressLabel)}`}>
                                                    {progressLabel}
                                                </span>
                                                <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${contact.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${contact.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    {contact.status === 'active' ? 'Активен' : 'Отписался'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className={`text-[12px] font-medium ${contact.awaitingHumanReply ? 'font-semibold text-rose-700' : contact.pendingReplyCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                                                    {contact.awaitingHumanReply
                                                        ? 'Ассистент передал вам'
                                                        : contact.pendingReplyCount > 0 ? 'Ждёт ответа' : getNextActionLabel(contact)}
                                                </div>
                                                {contact.lastMessage ? (
                                                    <div className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">
                                                        {contact.lastMessage.from === 'user' ? 'Клиент: ' : 'Вы: '}
                                                        {getMessagePreview(contact)}
                                                    </div>
                                                ) : contact.progress?.events?.length > 0 && (
                                                    <div className="mt-1 text-[11px] text-slate-400">{getLastEventLabel(contact)}</div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-[12px] text-slate-500">
                                                {formatRelativeTime(contact.progress?.lastActionAt || contact.lastActive)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteRequest([contact.id]); }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                                                    title="Удалить подписчика"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
