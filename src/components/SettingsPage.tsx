import React, { useState, useEffect } from 'react';
import { Settings, Bot, Globe, Key, Eye, EyeOff, Save, CheckCircle2, Loader2, AlertCircle, Plus, Trash2, X, Bell } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface BotEntry {
    id: string;
    token: string;
    name: string;
    firstName: string;
    active: boolean;
    addedAt: string;
}

interface SettingsData {
    bots: BotEntry[];
    geminiApiKey: string;
    appUrl: string;
    notifications: boolean;
    lavaApiKey: string;
    lavaWebhookSecret: string;
    deepseekApiKey: string;
    adminTelegramChatId?: string;
    expertTelegramUsername?: string;
    xaiApiKey?: string;
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsData>({
        bots: [],
        geminiApiKey: '',
        appUrl: 'http://localhost:3000',
        notifications: true,
        lavaApiKey: '',
        lavaWebhookSecret: '',
        deepseekApiKey: '',
        adminTelegramChatId: '',
        expertTelegramUsername: '',
        xaiApiKey: '',
    });




    const [showApiKey, setShowApiKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Bot adding
    const [showAddBot, setShowAddBot] = useState(false);
    const [newBotToken, setNewBotToken] = useState('');
    const [addingBot, setAddingBot] = useState(false);
    const [addBotError, setAddBotError] = useState('');
    const [addBotSuccess, setAddBotSuccess] = useState<BotEntry | null>(null);

    // Bot deletion
    const [botToDelete, setBotToDelete] = useState<string | null>(null);

    // Real API key (not masked)
    const [realApiKey, setRealApiKey] = useState('');

    useEffect(() => {
        apiFetch<SettingsData>('/api/settings')
            .then(data => setSettings(data))
            .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки'));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);

        try {
            const payload: any = {
                appUrl: settings.appUrl,
                notifications: settings.notifications,
                lavaApiKey: settings.lavaApiKey,
                lavaWebhookSecret: settings.lavaWebhookSecret,
                deepseekApiKey: settings.deepseekApiKey,
                adminTelegramChatId: settings.adminTelegramChatId,
                expertTelegramUsername: settings.expertTelegramUsername,
                xaiApiKey: settings.xaiApiKey,
            };




            if (realApiKey) {
                payload.geminiApiKey = realApiKey;
            }

            await apiFetch<{ success: true }>('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            setSaved(true);
            setRealApiKey('');
            setSettings(await apiFetch<SettingsData>('/api/settings'));
            setTimeout(() => setSaved(false), 3000);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Ошибка подключения к серверу');
        } finally {
            setSaving(false);
        }
    };

    const handleAddBot = async () => {
        if (!newBotToken.trim()) return;
        setAddingBot(true);
        setAddBotError('');
        setAddBotSuccess(null);

        try {
            const result = await apiFetch<{ success: true; bot: BotEntry }>('/api/settings/bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: newBotToken.trim() }),
            });

            setAddBotSuccess(result.bot);
            setNewBotToken('');
            setSettings(await apiFetch<SettingsData>('/api/settings'));
            setTimeout(() => {
                setAddBotSuccess(null);
                setShowAddBot(false);
            }, 3000);
        } catch (caught) {
            setAddBotError(caught instanceof Error ? caught.message : 'Ошибка подключения к серверу');
        } finally {
            setAddingBot(false);
        }
    };

    const confirmRemoveBot = (botId: string) => {
        setBotToDelete(botId);
    };

    const handleRemoveBot = async () => {
        if (!botToDelete) return;

        try {
            await apiFetch(`/api/settings/bots/${botToDelete}`, { method: 'DELETE' });
            setSettings(await apiFetch<SettingsData>('/api/settings'));
            setBotToDelete(null);
            setError('');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Не удалось удалить бота');
        }
    };

    return (
        <div className="admin-page flex-1 min-w-0 flex flex-col bg-[#f8f8fb] h-full overflow-hidden">
            {/* Header */}
            <header className="min-h-16 border-b border-slate-200 px-4 py-3 sm:px-8 flex items-center justify-between gap-3 bg-white shrink-0">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <Settings size={20} className="text-slate-400" />
                    <h1 className="font-semibold text-slate-800 text-[15px] tracking-wide">Настройки</h1>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium animate-pulse">
                            <CheckCircle2 size={16} /> Сохранено!
                        </span>
                    )}
                    {error && (
                        <span className="flex items-center gap-1.5 text-red-500 text-[13px] font-medium">
                            <AlertCircle size={16} /> {error}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1677e8] px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#0f69ce] disabled:opacity-50 sm:px-6"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Сохранить
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto px-4 py-5 sm:px-8 sm:py-8">
                <div className="max-w-2xl mx-auto space-y-6">

                    {/* Telegram Bots */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                <Bot size={18} className="text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[14px] font-semibold text-slate-800">Telegram Боты</h3>
                                <p className="text-[12px] text-slate-400">Подключите до 10 ботов для автоворонок</p>
                            </div>
                            <span className="text-[12px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                                {settings.bots.length} / 10
                            </span>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* Bot list */}
                            {settings.bots.map((bot) => (
                                <div
                                    key={bot.id}
                                    className="flex flex-wrap items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                                >
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-semibold text-[14px]">
                                        {bot.firstName?.charAt(0) || '🤖'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[14px] font-semibold text-slate-800 truncate">{bot.firstName}</span>
                                            <span className="text-[12px] text-slate-400 truncate">@{bot.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="block max-w-full truncate text-[11px] text-slate-400 font-mono">{bot.token}</span>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0 ${bot.active ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${bot.active ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                        {bot.active ? 'Активен' : 'Отключён'}
                                    </span>
                                    <button
                                        onClick={() => confirmRemoveBot(bot.id)}
                                        className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                        title="Удалить бота"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {settings.bots.length === 0 && !showAddBot && (
                                <div className="text-center py-8 text-slate-400 text-[13px]">
                                    Боты ещё не добавлены. Нажмите «+ Добавить бота» чтобы начать.
                                </div>
                            )}

                            {/* Add bot form */}
                            {showAddBot ? (
                                <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 space-y-3">
                                    {addBotSuccess ? (
                                        <div className="flex items-center gap-3 py-2 animate-in fade-in">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                <CheckCircle2 size={20} className="text-emerald-500" />
                                            </div>
                                            <div>
                                                <div className="text-[14px] font-semibold text-emerald-700">
                                                    Бот добавлен! ✓
                                                </div>
                                                <div className="text-[12px] text-emerald-600">
                                                    {addBotSuccess.firstName} (@{addBotSuccess.name}) подключён и работает
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[12px] font-medium text-slate-600">Токен нового бота</label>
                                                <button onClick={() => { setShowAddBot(false); setAddBotError(''); }} className="text-slate-400 hover:text-slate-600">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={newBotToken}
                                                    onChange={(e) => setNewBotToken(e.target.value)}
                                                    placeholder="Вставьте токен от @BotFather"
                                                    className="min-w-0 flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBot()}
                                                />
                                                <button
                                                    onClick={handleAddBot}
                                                    disabled={addingBot || !newBotToken.trim()}
                                                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                                                >
                                                    {addingBot ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                    {addingBot ? 'Проверка...' : 'Подключить'}
                                                </button>
                                            </div>
                                            {addBotError && (
                                                <div className="flex items-center gap-2 text-[12px] text-red-500 font-medium">
                                                    <AlertCircle size={14} /> {addBotError}
                                                </div>
                                            )}
                                            <p className="text-[11px] text-slate-400">
                                                Создайте бота через <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">@BotFather</a>, скопируйте токен и вставьте выше
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                settings.bots.length < 10 && (
                                    <button
                                        onClick={() => setShowAddBot(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 border border-dashed border-indigo-200 rounded-xl transition-colors"
                                    >
                                        <Plus size={16} /> Добавить бота
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Web App Domain */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                                <Globe size={18} className="text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-semibold text-slate-800">Web App домен</h3>
                                <p className="text-[12px] text-slate-400">URL для Telegram Web Apps</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6">
                            <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">APP_URL</label>
                            <input
                                type="text"
                                value={settings.appUrl}
                                onChange={(e) => setSettings(s => ({ ...s, appUrl: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                            />
                            <p className="text-[11px] text-slate-400 mt-2">Домен, на котором развёрнуто приложение</p>
                        </div>
                    </div>

                    {/* Telegram Notifications for Admin */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                    <Bell size={18} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-semibold text-slate-800">Уведомления администратору</h3>
                                    <p className="text-[12px] text-slate-400">Моментальные алерты в Telegram об оплатах и вызовах оператора</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.notifications}
                                    onChange={(e) => setSettings(s => ({ ...s, notifications: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <div className="p-4 sm:p-6 space-y-3">
                            <div>
                                <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                                    Telegram Chat ID получателя
                                </label>
                                <input
                                    type="text"
                                    value={settings.adminTelegramChatId || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, adminTelegramChatId: e.target.value }))}
                                    placeholder="Например: 123456789"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                                <p className="text-[11px] text-slate-400 mt-2">
                                    Укажите ваш цифровой Telegram Chat ID (можно узнать через <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">@userinfobot</a>). Бот платформы будет присылать вам карточки заказов и оповещения, когда подписчик зовёт человека.
                                </p>
                            </div>

                            <div>
                                <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                                    Telegram Username автора / куратора (без @)
                                </label>
                                <input
                                    type="text"
                                    value={settings.expertTelegramUsername || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, expertTelegramUsername: e.target.value.replace(/^@/, '') }))}
                                    placeholder="Например: my_expert_profile"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                                <p className="text-[11px] text-slate-400 mt-2">
                                    Используется для генерации умных ссылок на сдачу ДЗ напрямую в вашу личку через Telegram Business.
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* ИИ-ассистент воронок */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3">

                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                                <Bot size={17} className="text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-semibold text-slate-800">ИИ-ассистент воронок</h3>
                                <p className="text-[12px] text-slate-400">Отвечает подписчикам, которые пишут боту сами</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6">
                            <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">DeepSeek API Key</label>
                            <input
                                type="password"
                                value={settings.deepseekApiKey || ''}
                                onChange={(e) => setSettings(s => ({ ...s, deepseekApiKey: e.target.value }))}
                                placeholder="sk-..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                            />
                            <p className="text-[11px] text-slate-400 mt-2">
                                Ключ создаётся на platform.deepseek.com. Без него ассистент молчит, даже если включён в настройках воронки.
                                Включается он отдельно для каждой воронки.
                            </p>

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                                    xAI API Key (Grok STT & Reasoning)
                                </label>
                                <input
                                    type="password"
                                    value={settings.xaiApiKey || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, xaiApiKey: e.target.value }))}
                                    placeholder="xai-..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                                <p className="text-[11px] text-slate-400 mt-2">
                                    Ключ xAI (console.x.ai). При его наличии распознавание голосовых сообщений переключается на флагманский <b>Grok Speech-to-Text</b> (приоритет №1).
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Lava.top Integration */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                                <span className="text-sky-500 font-bold text-lg">L</span>
                            </div>
                            <div>
                                <h3 className="text-[14px] font-semibold text-slate-800">Оплата Lava.top</h3>
                                <p className="text-[12px] text-slate-400">Интеграция приема платежей и подписок</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">
                            <div>
                                <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">Lava.top API Key</label>
                                <input
                                    type="password"
                                    value={settings.lavaApiKey || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, lavaApiKey: e.target.value }))}
                                    placeholder="Вставьте API-ключ от Lava.top"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">Webhook Secret Key</label>
                                <input
                                    type="password"
                                    value={settings.lavaWebhookSecret || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, lavaWebhookSecret: e.target.value }))}
                                    placeholder="Секретный ключ для вебхука"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                                <p className="text-[11px] text-slate-400 mt-2">
                                    Укажите Webhook URL в кабинете Lava.top: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{settings.appUrl}/api/webhook/lava</code>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bot Delete Confirmation Modal */}
            {botToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setBotToDelete(null)}></div>
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl">
                        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Удалить бота?</h3>
                        <p className="text-slate-500 text-[15px] mb-8 leading-relaxed">
                            Вы уверены, что хотите удалить этого бота? Автоворонки, которые к нему привязаны, перестанут работать, пока вы не подключите нового.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setBotToDelete(null)}
                                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-[15px]"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleRemoveBot}
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
