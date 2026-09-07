import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Save, Plus, Sparkles, Bot, ChevronDown, Check, Loader2, AlertTriangle, BarChart3, ExternalLink, MessageSquare, Smartphone, GraduationCap, Pencil } from 'lucide-react';
import AssistantSettings from './funnel/AssistantSettings';
import PhoneFrame from './ui/PhoneFrame';
import { Funnel, FunnelStage } from '../types/funnel';
import ModernSelect from './ui/ModernSelect';
import { FUNNEL_TYPE_ORDER, UNTYPED_LABEL, getFunnelTypeLabel } from '../utils/funnelTypes';
import StageCard from './StageCard';

interface FunnelViewProps {
  onBack: () => void;
  initialData?: any;
  onUpdateFunnel?: (funnel: Funnel) => void;
  onSaveFunnel?: (funnel: Funnel) => Promise<void>;
  saveError?: string;
  onOpenAnalytics?: (funnelId: string) => void;
  onOpenPlatform?: (funnelId: string) => void;
}

// Convert legacy stage format to new FunnelStage format
function convertLegacyStage(legacy: any, index: number): FunnelStage {
  return {
    id: legacy.id || `stage-${index}`,
    index,
    title: legacy.title || `Этап ${index + 1}`,
    firstMessage: {
      delay: legacy.firstMessage?.delay || legacy.delay || 'Сразу',
      text: legacy.firstMessage?.text || legacy.message || '',
      buttonText: legacy.firstMessage?.buttonText || legacy.buttonText || '',
      buttonAction: legacy.firstMessage?.buttonAction || (legacy.isWebApp ? 'open_webapp' : 'next_stage'),
      photo: legacy.firstMessage?.photo || undefined,
    },
    webApp: legacy.webApp || (legacy.isWebApp ? {
      enabled: true,
      blocks: legacy.webApp?.blocks || [
        { id: 'h1', type: 'header', content: { title: 'БЕСПЛАТНЫЙ ГАЙД' } },
        { id: 'h2', type: 'text', content: { text: legacy.message?.substring(0, 60) || 'Описание', style: 'subheadline' } },
        { id: 'h3', type: 'button', content: { text: '► Смотреть' } },
      ],
      theme: 'dotcom' as const,
      pageEvents: [
        { id: 'ev-1', label: 'Первый вход', eventKey: 'first_visit' },
        { id: 'ev-2', label: 'Вход на страницу', eventKey: 'page_view' },
      ]
    } : undefined),
    nextStage: legacy.nextStage || (legacy.nextStep ? {
      label: legacy.nextStep.replace('Переход на ', 'Далее: '),
    } : undefined),
    rules: legacy.rules || [{
      id: 'rule-default',
      type: 'message' as const,
      message: '🎯 {name}, держи свой гайд!\n\nВот твой PDF-гайд...',
    }],
    reminders: legacy.reminders || [],
  };
}

function convertToFunnel(data: any): Funnel {
  // Already in new format
  if (data.stages?.[0]?.firstMessage) {
    return data as Funnel;
  }

  // Перечисляем только то, у чего есть значение по умолчанию, а остальное
  // переносим как есть. Раньше здесь собирался новый объект с нуля, и воронка,
  // открытая в редакторе, теряла платформу, ассистента и сайты: первая же
  // правка сохраняла её без них.
  return {
    ...data,
    id: data.id || `funnel-${Date.now()}`,
    title: data.title || 'Новая воронка',
    status: data.status || 'draft',
    subscribers: data.subscribers || 0,
    conversion: data.conversion || '0%',
    createdAt: data.createdAt || new Date().toISOString().split('T')[0],
    stages: (data.stages || []).map((s: any, i: number) => convertLegacyStage(s, i)),
  };
}

export default function FunnelView({ onBack, initialData, onUpdateFunnel, onSaveFunnel, saveError, onOpenAnalytics, onOpenPlatform }: FunnelViewProps) {
  const [funnel, setFunnel] = useState<Funnel>(() => convertToFunnel(initialData || {
    title: 'Новая воронка',
    stages: []
  }));
  const [showBotDropdown, setShowBotDropdown] = useState(false);
  const [availableBots, setAvailableBots] = useState<any[]>([]);
  const [allFunnels, setAllFunnels] = useState<any[]>([]);
  const [connectedBotId, setConnectedBotId] = useState<string | null>(initialData?.connectedBotId || null);
  const [botsLoading, setBotsLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      const parsed = convertToFunnel(initialData);
      setFunnel(parsed);
      setTitleDraft(parsed.title);
      setConnectedBotId(parsed.connectedBotId || null);
    }
  }, [initialData]);

  useEffect(() => {
    setTitleDraft(funnel.title);
  }, [funnel.title]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBotDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    void fetchBots();
  }, []);

  const fetchBots = async () => {
    setBotsLoading(true);
    try {
      const [settingsRes, funnelsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/funnels'),
      ]);
      const settingsData = await settingsRes.json();
      const funnelsData = await funnelsRes.json();
      setAvailableBots(settingsData.bots || []);
      setAllFunnels(funnelsData || []);
    } catch (e) { console.error(e); }
    setBotsLoading(false);
  };

  const handleLaunchClick = () => {
    setShowBotDropdown(!showBotDropdown);
  };

  // Get funnel that occupies a given bot (excluding current funnel)
  const getOccupyingFunnel = (botId: string): any | null => {
    return allFunnels.find(f => f.connectedBotId === botId && f.id !== funnel.id) || null;
  };

  const connectBot = async (botId: string | null) => {
    setConnecting(true);
    setConnectError('');

    // Check if bot is already occupied by another funnel
    if (botId) {
      const occupier = getOccupyingFunnel(botId);
      if (occupier) {
        setConnectError(`Бот уже привязан к воронке "${occupier.title}". Сначала отключите его там.`);
        setConnecting(false);
        return;
      }
    }

    setConnectedBotId(botId);
    setShowBotDropdown(false);

    // Save the connected bot association
    try {
      const newStatus: 'active' | 'draft' = botId ? 'active' : 'draft';
      const resp = await fetch(`/api/funnels/${funnel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...funnel, connectedBotId: botId, status: newStatus }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setConnectError(result.error || 'Ошибка подключения');
        setConnectedBotId(connectedBotId); // revert
        setConnecting(false);
        return;
      }
      const updated = { ...funnel, connectedBotId: botId, status: newStatus };
      setFunnel(updated);
      onUpdateFunnel?.(updated);
      // Refresh funnels list to update occupied status
      const funnelsRes = await fetch('/api/funnels');
      setAllFunnels(await funnelsRes.json());
    } catch (e) {
      console.error(e);
      setConnectError('Ошибка подключения к серверу');
    }
    setConnecting(false);
  };

  const connectedBot = availableBots.find(b => b.id === connectedBotId);

  const updateStage = (updatedStage: FunnelStage) => {
    const previousStage = funnel.stages.find(stage => stage.id === updatedStage.id);
    const updated = {
      ...funnel,
      stages: funnel.stages.map(stage => {
        if (stage.id === updatedStage.id) return updatedStage;
        if (
          previousStage?.title !== updatedStage.title &&
          stage.nextStage?.targetStageId === updatedStage.id
        ) {
          return {
            ...stage,
            nextStage: {
              ...stage.nextStage,
              label: `Далее: ${updatedStage.title}`,
            },
          };
        }
        return stage;
      })
    };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  const saveFunnelTitle = () => {
    const cleanTitle = titleDraft.trim();
    if (!cleanTitle) {
      setTitleDraft(funnel.title);
      setEditingTitle(false);
      return;
    }
    if (cleanTitle !== funnel.title) {
      const updated = { ...funnel, title: cleanTitle };
      setFunnel(updated);
      onUpdateFunnel?.(updated);
    }
    setEditingTitle(false);
  };

  // Вид проставляется при создании, но воронки, сделанные раньше, остались без него.
  // Задать его задним числом должен владелец: угадывать за него нечестно.
  const updateFunnelType = (value: string) => {
    const updated = { ...funnel, type: value === 'none' ? undefined : (value as Funnel['type']) };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  // Как открываются страницы воронки в Telegram. Раньше режим был зашит в коде
  // по id воронки, поэтому вторая воронка не могла работать как Mini App.
  const telegramMiniApp = Boolean(funnel.telegramMiniApp);
  const updateTelegramMiniApp = (value: boolean) => {
    const updated = { ...funnel, telegramMiniApp: value };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  const lessonsCount = funnel.platform?.lessons?.length || 0;
  const sessionsCount = funnel.platform?.sessions?.length || 0;
  const bonusEnabled = Boolean(funnel.platform?.bonus?.enabled);
  const curatorConfigured = Boolean(funnel.platform?.curatorUrl);

  const menuButtonText = funnel.introWebApp?.menuButtonText || 'Мой прогресс';
  const menuButtonPreviewUrl = `/?funnel=${encodeURIComponent(funnel.id)}&stage=intro&preview=phone`;

  const updateMenuButtonText = (value: string) => {
    const cleanValue = value.replace(/\|/g, '').slice(0, 64);
    const updated = {
      ...funnel,
      introWebApp: {
        ...(funnel.introWebApp || {}),
        enabled: true,
        theme: funnel.introWebApp?.theme || 'cosmic',
        blocks: funnel.introWebApp?.blocks || [],
        pageEvents: funnel.introWebApp?.pageEvents || [
          { id: 'ev-profile-opened', label: 'Профиль открыт', eventKey: 'profile_opened' },
          { id: 'ev-profile-continue', label: 'Продолжить обучение', eventKey: 'profile_continue_clicked' },
        ],
        menuButtonText: cleanValue,
      },
    };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  const updateAssistant = (assistant: Funnel['assistant']) => {
    const updated = { ...funnel, assistant };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  const addStage = () => {
    const newIndex = funnel.stages.length;
    const newStage: FunnelStage = {
      id: `stage-${Date.now()}`,
      index: newIndex,
      title: `Новый этап ${newIndex + 1}`,
      firstMessage: {
        delay: 'Сразу',
        text: '👋 Привет, {name}!\n\nТут будет текст сообщения этого этапа.',
        buttonText: 'Далее',
        buttonAction: 'next_stage',
      },
      rules: [],
      reminders: [
        {
          id: `rem-${Date.now()}-1`,
          delayMinutes: 60,
          delayLabel: '60 минут',
          message: '👀 {name}, ты ещё не открыл сообщение?\n\nЧас назад я отправил тебе важную информацию — а она до сих пор ждёт тебя!\nПросто нажми кнопку ниже 👇',
          buttonText: 'Далее',
        },
        {
          id: `rem-${Date.now()}-2`,
          delayMinutes: 120,
          delayLabel: '2 часа',
          message: '💡 {name}, пока ты думаешь — другие уже действуют.\n\nНе откладывай, это займёт всего пару минут.\nНажми кнопку и начни прямо сейчас 👇',
          buttonText: 'Далее',
        },
        {
          id: `rem-${Date.now()}-3`,
          delayMinutes: 1380,
          delayLabel: '23 часа',
          message: '😤 {name}, последний шанс!\n\nЯ больше не буду напоминать — но хочу, чтобы ты не упустил эту возможность.\nНажми кнопку ниже, пока она ещё доступна 👇',
          buttonText: 'Далее',
        },
      ],
    };

    // Link previous last stage to new one
    const stages = [...funnel.stages];
    if (stages.length > 0) {
      const lastStage = stages[stages.length - 1];
      stages[stages.length - 1] = {
        ...lastStage,
        nextStage: {
          label: `Далее: ${newStage.title}`,
          targetStageId: newStage.id,
        }
      };
    }

    const updated = { ...funnel, stages: [...stages, newStage] };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
  };

  const confirmDeleteStage = (stageId: string) => {
    setStageToDelete(stageId);
  };

  const deleteStage = () => {
    if (!stageToDelete) return;

    const filtered = funnel.stages
      .filter(s => s.id !== stageToDelete)
      .map((stage, index) => ({
        ...stage,
        index,
        nextStage: stage.nextStage?.targetStageId === stageToDelete ? undefined : stage.nextStage,
      }));

    const updated = { ...funnel, stages: filtered };
    setFunnel(updated);
    onUpdateFunnel?.(updated);
    setStageToDelete(null);
  };

  return (
    <div className="admin-page flex-1 min-w-0 flex flex-col bg-[#f0f0f5] h-full overflow-hidden">
      {/* Header */}
      <header className="min-h-16 border-b border-slate-200 px-3 py-3 sm:px-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between bg-white z-10 shrink-0 shadow-sm">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={saveFunnelTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveFunnelTitle();
                    if (event.key === 'Escape') {
                      setTitleDraft(funnel.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-indigo-300 bg-white px-3 text-sm text-slate-800 outline-none ring-4 ring-indigo-100 sm:max-w-[520px]"
                />
              ) : (
                <>
                  <h1 className="max-w-[560px] truncate text-base sm:text-lg font-bold text-slate-800" title={funnel.title}>{funnel.title}</h1>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    title="Переименовать воронку"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${funnel.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
                }`}>
                {funnel.status === 'active' ? 'Активна' : funnel.status === 'draft' ? 'Черновик' : 'Архив'}
              </span>
              <ModernSelect
                value={funnel.type || 'none'}
                onChange={updateFunnelType}
                options={[
                  { value: 'none', label: UNTYPED_LABEL },
                  ...FUNNEL_TYPE_ORDER.map(type => ({ value: type, label: getFunnelTypeLabel(type) })),
                ]}
                className="w-[160px] shrink-0"
                buttonClassName="h-9! border-slate-200 bg-white text-xs shadow-none"
                ariaLabel="Вид воронки"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-3">
          <button
            onClick={() => onOpenAnalytics?.(funnel.id)}
            className="flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all border shadow-sm bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]"
          >
            <BarChart3 size={16} />
            Аналитика
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              setSaved(false);
              try {
                await onSaveFunnel?.(funnel);
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              } catch (e) {
                console.error(e);
                setSaved(false);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all border shadow-sm active:scale-[0.97] ${
              saved
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : saving
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-wait'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md'
            }`}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <Check size={16} className="text-emerald-600" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Сохраняю...' : saved ? 'Сохранено!' : 'Сохранить'}
          </button>
          {saveError && <span className="sr-only" role="alert">{saveError}</span>}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleLaunchClick}
              className={`flex w-full items-center justify-center gap-1.5 px-2 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all shadow-sm ${connectedBotId
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-[#1677e8] hover:bg-[#0f69ce] text-white'
                }`}
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : connectedBotId ? (
                <Bot size={16} />
              ) : (
                <Play size={16} />
              )}
              {connectedBotId ? (
                <>
                  <span className="sm:hidden">Бот</span>
                  <span className="hidden max-w-36 truncate sm:inline">{connectedBot?.name || 'Бот подключен'}</span>
                </>
              ) : 'Запустить'}
              <ChevronDown size={14} className={`hidden transition-transform sm:block ${showBotDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showBotDropdown && (
              <div className="fixed left-3 right-3 top-[116px] mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Подключить к боту</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Выберите бота для запуска воронки</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {botsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-slate-400" />
                    </div>
                  ) : availableBots.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <Bot size={32} className="text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-500">Нет добавленных ботов</p>
                      <p className="text-xs text-slate-400 mt-1">Добавьте бота в Настройках</p>
                    </div>
                  ) : (
                    <>
                      {availableBots.map((bot: any) => {
                        const occupier = getOccupyingFunnel(bot.id);
                        const isOccupied = !!occupier;
                        const isCurrentBot = connectedBotId === bot.id;
                        return (
                          <button
                            key={bot.id}
                            onClick={() => !isOccupied && connectBot(bot.id)}
                            disabled={isOccupied}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${
                              isCurrentBot ? 'bg-indigo-50' : isOccupied ? 'bg-slate-50/50 cursor-not-allowed opacity-60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isOccupied ? 'bg-amber-100 text-amber-600' : bot.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {isOccupied ? <AlertTriangle size={18} /> : <Bot size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{bot.firstName || bot.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                @{bot.name}
                                {isOccupied && <span className="ml-1 text-amber-600 font-medium">• Занят: {occupier.title}</span>}
                              </p>
                            </div>
                            {isCurrentBot ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                <Check size={14} className="text-white" />
                              </div>
                            ) : isOccupied ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg shrink-0">Занят</span>
                            ) : (
                              <div className={`w-2 h-2 rounded-full shrink-0 ${bot.active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
                {connectError && (
                  <div className="px-4 py-2 border-t border-red-100 bg-red-50">
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {connectError}
                    </p>
                  </div>
                )}
                {connectedBotId && (
                  <div className="p-3 border-t border-slate-100 bg-slate-50">
                    <button
                      onClick={() => connectBot(null)}
                      className="w-full py-2 text-sm font-bold text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-red-100 shadow-sm flex items-center justify-center gap-2"
                    >
                      Отключить бота
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stage Cards */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 pb-20">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 p-4 sm:p-6 text-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-emerald-300 ring-1 ring-white/10">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight">Кнопка в чате Telegram</h2>
                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                      MenuButton
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
                    Постоянная кнопка возле поля сообщения. Она открывает профиль ученика, прогресс и продолжение обучения.
                  </p>
                </div>
              </div>

              <button
                onClick={() => window.open(menuButtonPreviewUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100"
              >
                <ExternalLink size={16} />
                Открыть профиль
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
              <div className="border-b border-slate-100 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Текст кнопки
                </label>
                <input
                  value={menuButtonText}
                  onChange={(e) => updateMenuButtonText(e.target.value)}
                  className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  placeholder="Мой прогресс"
                  maxLength={64}
                />
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Smartphone size={14} />
                  Открывает `stage=intro` — главный экран воронки.
                </div>

                <button
                  type="button"
                  onClick={() => updateTelegramMiniApp(!telegramMiniApp)}
                  className={`mt-4 flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    telegramMiniApp ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    telegramMiniApp ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Smartphone size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800">Открывать внутри Telegram</div>
                    <div className="mt-0.5 text-xs leading-5 text-slate-500">
                      Страницы уроков открываются как Mini App, следующий этап уходит сразу,
                      оформление подстраивается под Telegram. Выключено — обычная ссылка в браузере.
                    </div>
                  </div>
                  <div className={`mt-1 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${telegramMiniApp ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <div className={`h-4 w-4 rounded-full bg-white shadow transition ${telegramMiniApp ? 'translate-x-4' : ''}`} />
                  </div>
                </button>
              </div>

              <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[1fr_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Кнопка в чате
                  </div>
                  <div className="mt-4 rounded-[26px] border border-slate-200 bg-slate-50 p-3 shadow-inner">
                    <div className="rounded-[22px] bg-white p-3 shadow-sm">
                      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-slate-900" />
                        <div>
                          <div className="text-sm font-black text-slate-800">{connectedBot?.firstName || 'Ваш бот'}</div>
                          <div className="text-[11px] font-semibold text-slate-400">бот</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-blue-500 px-3 text-xs font-black text-white shadow-sm">
                          <span className="h-4 w-4 rounded border-2 border-white/90" />
                          {menuButtonText || 'Мой прогресс'}
                        </button>
                        <div className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400">
                          Сообщение...
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
                    Когда бот подключен, кнопка выставляется через Telegram API автоматически.
                  </div>
                </div>

                <div className="justify-self-center xl:justify-self-end">
                  <div className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Что откроется по нажатию
                  </div>
                  <PhoneFrame
                    src={menuButtonPreviewUrl}
                    title="Профиль ученика"
                  />
                </div>
              </div>
            </div>
          </div>

          <AssistantSettings assistant={funnel.assistant} onChange={updateAssistant} />

          {/* Сами настройки платформы живут на отдельной вкладке: раньше, чтобы
              поправить ссылку на куратора, приходилось листать все этапы. */}
          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-[#CEF563]">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black tracking-tight text-slate-900">Настройки платформы</h3>
                <p className="mt-1 max-w-2xl text-[13px] font-semibold leading-5 text-slate-400">
                  {lessonsCount ? `Программа: ${lessonsCount} уроков` : 'Программа: встроенный курс'}, эфиры ({sessionsCount}),
                  бонусы{bonusEnabled ? ' включены' : ' выключены'}{curatorConfigured ? ', куратор задан' : ''} — на отдельной странице.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenPlatform?.(funnel.id)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <GraduationCap size={16} />
              Открыть настройки
            </button>
          </div>

          {funnel.stages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles size={32} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Воронка пуста</h2>
              <p className="text-slate-400 mb-6">Добавьте первый этап или создайте воронку через ИИ-Чат</p>
              <button
                onClick={addStage}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
              >
                + Добавить первый этап
              </button>
            </div>
          )}

          {funnel.stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              stages={funnel.stages}
              funnelId={funnel.id}
              onUpdate={updateStage}
              onDelete={confirmDeleteStage}
            />
          ))}


          {/* Add Stage Button */}
          {funnel.stages.length > 0 && (
            <div className="flex justify-center pt-4">
              <button
                onClick={addStage}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-600 px-8 py-3 rounded-full font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Plus size={18} />
                Добавить этап
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stage Delete Confirmation Modal */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStageToDelete(null)}></div>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Удалить этот этап?</h3>
            <p className="text-slate-500 text-[15px] mb-8 leading-relaxed">
              Вы уверены, что хотите безвозвратно удалить этот этап воронки? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStageToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-[15px]"
              >
                Отмена
              </button>
              <button
                onClick={deleteStage}
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
