import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageCircle, FileText, Download } from 'lucide-react';
import ContactAvatar from './audience/ContactAvatar';

interface Subscriber {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    funnel?: string;
    funnelId?: string | null;
    stage?: string;
    status?: string;
}

interface Message {
    id: string;
    from: 'bot' | 'user';
    text: string;
    timestamp: string;
    media?: {
        type: 'photo' | 'video' | 'videoNote' | 'animation' | 'document' | 'sticker' | 'voice' | 'audio';
        fileId?: string;
        botId?: string;
        url?: string;
        fileName?: string;
        mimeType?: string;
    };
}

interface ChatPanelProps {
    subscriber: Subscriber;
    onClose: () => void;
}

export default function ChatPanel({ subscriber, onClose }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load messages
    const fetchMessages = async () => {
        try {
            const query = subscriber.funnelId ? `?funnelId=${encodeURIComponent(subscriber.funnelId)}` : '';
            const res = await fetch(`/api/messages/${subscriber.id}${query}`);
            const data = await res.json();
            if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Не удалось загрузить переписку');
            setMessages(data);
            setError('');
            setLoading(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Не удалось загрузить переписку');
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchMessages();
        // Poll for new messages every 3 seconds
        pollRef.current = setInterval(fetchMessages, 3000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [subscriber.id, subscriber.funnelId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;

        const text = input.trim();
        setInput('');
        setSending(true);
        setError('');

        // Optimistic update
        const tempMsg: Message = {
            id: `temp-${Date.now()}`,
            from: 'bot',
            text,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const res = await fetch(`/api/messages/${subscriber.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, funnelId: subscriber.funnelId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Ошибка отправки');
                setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
            } else {
                // Refresh messages from server
                await fetchMessages();
            }
        } catch {
            setError('Ошибка сети');
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        } finally {
            setSending(false);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Сегодня';
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    const getMediaUrl = (message: Message) => {
        if (message.media?.url) {
            try {
                const url = new URL(message.media.url, window.location.origin);
                if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
            } catch {
                return '';
            }
        }
        if (message.media?.fileId && message.media?.botId) {
            return `/api/telegram/media/${encodeURIComponent(message.media.botId)}/${encodeURIComponent(message.media.fileId)}`;
        }
        return '';
    };

    const renderMedia = (message: Message) => {
        if (!message.media) return null;
        const url = getMediaUrl(message);
        if (!url) return <div className="text-xs opacity-70">Медиафайл недоступен</div>;

        if (message.media.type === 'photo' || message.media.type === 'sticker') {
            return (
                <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                    <img
                        src={url}
                        alt={message.media.type === 'sticker' ? 'Стикер' : 'Фотография'}
                        className={`block w-full object-contain ${message.media.type === 'sticker' ? 'max-h-40' : 'max-h-72'}`}
                        loading="lazy"
                    />
                </a>
            );
        }

        if (message.media.type === 'video' || message.media.type === 'videoNote' || message.media.type === 'animation') {
            return (
                <video
                    src={url}
                    controls
                    playsInline
                    className={`block max-h-72 w-full bg-black ${message.media.type === 'videoNote' ? 'aspect-square rounded-full object-cover' : 'rounded-xl'}`}
                />
            );
        }

        if (message.media.type === 'voice' || message.media.type === 'audio') {
            return <audio src={url} controls className="max-w-full" />;
        }

        return (
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-[210px] items-center gap-3 rounded-xl bg-black/5 p-3 text-inherit"
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
                    <FileText size={19} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{message.media.fileName || 'Документ'}</div>
                    <div className="mt-0.5 text-[10px] opacity-60">Открыть файл</div>
                </div>
                <Download size={16} className="shrink-0 opacity-60" />
            </a>
        );
    };

    // Group messages by date
    const groupedMessages: { date: string; msgs: Message[] }[] = [];
    let lastDate = '';
    for (const msg of messages) {
        const date = formatDate(msg.timestamp);
        if (date !== lastDate) {
            groupedMessages.push({ date, msgs: [msg] });
            lastDate = date;
        } else {
            groupedMessages[groupedMessages.length - 1].msgs.push(msg);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
                {/* Header */}
                <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <ContactAvatar
                            contactId={subscriber.id}
                            firstName={subscriber.firstName}
                            lastName={subscriber.lastName}
                        />
                        <div>
                            <h3 className="font-semibold text-slate-800 text-[14px]">
                                {subscriber.firstName} {subscriber.lastName || ''}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                {subscriber.username ? `@${subscriber.username}` : `ID: ${subscriber.id}`}
                                {subscriber.funnel && subscriber.funnel !== '—' && ` • ${subscriber.funnel}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#f8f8fb] space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загрузка...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                            <MessageCircle size={40} className="text-slate-200 mb-3" />
                            <p className="font-medium text-slate-500">Нет сообщений</p>
                            <p className="text-[12px] mt-1">Отправьте первое сообщение подписчику</p>
                        </div>
                    ) : (
                        <>
                            {groupedMessages.map((group, gi) => (
                                <div key={gi}>
                                    <div className="flex justify-center my-4">
                                        <span className="text-[11px] text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                                            {group.date}
                                        </span>
                                    </div>
                                    {group.msgs.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex mb-2 ${msg.from === 'bot' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${msg.from === 'bot'
                                                        ? 'bg-indigo-600 text-white rounded-br-md'
                                                        : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100'
                                                    }`}
                                            >
                                                {msg.media && <div className={msg.text ? 'mb-2' : ''}>{renderMedia(msg)}</div>}
                                                {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
                                                <div
                                                    className={`text-[10px] mt-1 ${msg.from === 'bot' ? 'text-indigo-200' : 'text-slate-400'
                                                        }`}
                                                >
                                                    {formatTime(msg.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="px-5 py-2 bg-rose-50 text-rose-600 text-[12px] font-medium border-t border-rose-100">
                        {error}
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-200 p-3 bg-white shrink-0">
                    <div className="flex gap-2 items-end">
                        <textarea
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleSend();
                                }
                            }}
                            placeholder="Написать сообщение..."
                            disabled={sending}
                            rows={1}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none overflow-y-auto placeholder-slate-400 disabled:opacity-50"
                            style={{ maxHeight: '100px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || !input.trim()}
                            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600 shrink-0"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
        </div>
    );
}
