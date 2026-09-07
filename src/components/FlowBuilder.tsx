import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { Funnel, FunnelStage } from '../types/funnel';
import CreateFunnelModal, { CreateFunnelConfig, FunnelTemplate } from './CreateFunnelModal';
import { buildCourseTemplateSite, buildCourseTemplateStages } from '../utils/courseFunnelTemplate';
import { apiFetch } from '../lib/api';

const Dashboard = lazy(() => import('./Dashboard'));
const FunnelsPage = lazy(() => import('./FunnelsPage'));
const FunnelView = lazy(() => import('./FunnelView'));
const SitesPage = lazy(() => import('./SitesPage'));
const GalleryPage = lazy(() => import('./GalleryPage'));
const AudiencePage = lazy(() => import('./AudiencePage'));
const BroadcastsPage = lazy(() => import('./BroadcastsPage'));
const StageAnalyticsPage = lazy(() => import('./StageAnalyticsPage'));
const SalesPage = lazy(() => import('./SalesPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const PlatformSettingsPage = lazy(() => import('./PlatformSettingsPage'));

function AdminPanelLoader() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#f8f8fb]">
      <div className="w-9 h-9 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

const templateStages: Record<FunnelTemplate, Array<{ title: string; message: string }>> = {
  blank: [
    {
      title: 'Первое сообщение',
      message: '👋 Привет, {name}!\n\nНапишите здесь первое сообщение вашей воронки.',
    },
  ],
  lead: [
    {
      title: 'Знакомство и обещание',
      message: '👋 {name}, привет!\n\nРасскажите, какой результат человек получит и почему ему стоит пройти дальше.',
    },
    {
      title: 'Выдача материала',
      message: '🎁 {name}, обещанный материал готов.\n\nДобавьте ссылку, файл или откройте Web App кнопкой ниже.',
    },
    {
      title: 'Следующий шаг',
      message: 'Готовы двигаться дальше?\n\nПредложите консультацию, продукт или переход в основной канал.',
    },
  ],
  course: [
    {
      title: 'Бесплатный продающий урок',
      message: '🎬 {name}, бесплатный урок готов.\n\nДайте быстрый результат и предложите трипваер прямо на странице урока.',
    },
  ],
  sales: [
    {
      title: 'Квалификация лида',
      message: '👋 {name}, привет!\n\nЗадайте один главный вопрос, чтобы понять задачу клиента.',
    },
    {
      title: 'Ценность и доказательство',
      message: 'Покажите, как вы решаете эту задачу: результат, кейс и главное отличие.',
    },
    {
      title: 'Предложение и запись',
      message: 'Предложите следующий шаг: созвон, расчёт стоимости или оформление заказа.',
    },
  ],
};

function buildTemplateStages(template: FunnelTemplate, funnelId: string): FunnelStage[] {
  if (template === 'course') {
    return buildCourseTemplateStages(funnelId);
  }

  const definitions = templateStages[template];
  const stages = definitions.map((definition, index): FunnelStage => ({
    id: `${funnelId}-stage-${index + 1}`,
    index,
    title: definition.title,
    firstMessage: {
      delay: 'Сразу',
      text: definition.message,
      buttonText: index < definitions.length - 1 ? 'Продолжить' : '',
      buttonAction: index < definitions.length - 1 ? 'next_stage' : undefined,
      buttonStyle: index < definitions.length - 1 ? 'primary' : undefined,
    },
    rules: [],
    reminders: index === 0 ? [{
      id: `${funnelId}-stage-${index + 1}-reminder-1`,
      delayMinutes: 60,
      delayLabel: '1 час',
      condition: 'not_opened',
      message: '{name}, напоминаю о сообщении выше. Вернитесь, когда будет удобно 👇',
      buttonText: index < definitions.length - 1 ? 'Продолжить' : '',
      buttonAction: index < definitions.length - 1 ? 'next_stage' : undefined,
    }] : [],
  }));

  return stages.map((stage, index) => {
    const next = stages[index + 1];
    return next
      ? { ...stage, nextStage: { targetStageId: next.id, label: `Далее: ${next.title}` } }
      : stage;
  });
}

export default function FlowBuilder() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'funnels' | 'flow' | 'platform' | 'sites' | 'gallery' | 'audience' | 'broadcasts' | 'sales' | 'settings'>('dashboard');
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [selectedAnalyticsFunnel, setSelectedAnalyticsFunnel] = useState<string | null>(null);
  const [selectedPlatformFunnel, setSelectedPlatformFunnel] = useState<string | null>(null);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveQueues = useRef(new Map<string, Promise<void>>());

  const [funnels, setFunnels] = useState<any[]>([]);

  // Load funnels from server on mount
  const loadFunnels = async () => {
    try {
      const serverFunnels = await apiFetch<Funnel[]>('/api/funnels');
      if (!Array.isArray(serverFunnels)) throw new Error('Сервер вернул некорректный список воронок');
      setFunnels(serverFunnels);
      setPersistenceError('');
    } catch (error) {
      console.error(error);
      setPersistenceError(error instanceof Error ? error.message : 'Не удалось загрузить воронки');
    }
  };

  // Load funnels on mount and when switching to funnels/dashboard tabs
  useEffect(() => {
    void loadFunnels();
  }, []);

  const saveFunnelToServer = (funnel: Funnel) => {
    const previous = saveQueues.current.get(funnel.id) || Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      await apiFetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(funnel),
      });
      setPersistenceError('');
    });
    saveQueues.current.set(funnel.id, next);
    void next.finally(() => {
      if (saveQueues.current.get(funnel.id) === next) saveQueues.current.delete(funnel.id);
    }).catch(() => undefined);
    return next;
  };

  const scheduleFunnelSave = (funnel: Funnel) => {
    const existing = saveTimers.current.get(funnel.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.current.delete(funnel.id);
      void saveFunnelToServer(funnel).catch((error) => {
        setPersistenceError(error instanceof Error ? error.message : 'Не удалось сохранить воронку');
      });
    }, 700);
    saveTimers.current.set(funnel.id, timer);
  };

  useEffect(() => () => {
    for (const timer of saveTimers.current.values()) clearTimeout(timer);
  }, []);



  const handleOpenFunnel = (id: string) => {
    const funnel = funnels.find(f => f.id === id);
    setSelectedFunnel(id);
    setSelectedAnalyticsFunnel(id);
    setSelectedPlatformFunnel(id);
    setFunnelData(funnel || null);
    setActiveTab('flow');
  };

  const handleOpenAnalytics = (id: string) => {
    setSelectedAnalyticsFunnel(id);
    setActiveTab('analytics');
  };

  const handleOpenPlatform = (id: string) => {
    setSelectedPlatformFunnel(id);
    setActiveTab('platform');
  };

  const handleDeleteFunnel = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiFetch(`/api/funnels/${id}`, { method: 'DELETE' });
      setFunnels(prev => prev.filter(f => f.id !== id));
      setPersistenceError('');
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'Не удалось удалить воронку');
      return;
    }

    if (selectedPlatformFunnel === id) setSelectedPlatformFunnel(null);

    if (selectedFunnel === id) {
      setSelectedFunnel(null);
      setFunnelData(null);
      setActiveTab('funnels');
    }
  };

  const handleUpdateFunnel = (updatedFunnel: Funnel) => {
    setFunnels(prev => prev.map(f => f.id === updatedFunnel.id ? updatedFunnel : f));
    // Настройки платформы правятся на отдельной вкладке и могут относиться к другой
    // воронке — открытый в редакторе черновик от этого подменяться не должен.
    setFunnelData((prev: any) => (prev && prev.id !== updatedFunnel.id ? prev : updatedFunnel));
    scheduleFunnelSave(updatedFunnel);
  };

  const handleSaveFunnel = async (funnel: Funnel) => {
    const timer = saveTimers.current.get(funnel.id);
    if (timer) clearTimeout(timer);
    saveTimers.current.delete(funnel.id);
    try {
      await saveFunnelToServer(funnel);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить воронку';
      setPersistenceError(message);
      throw error;
    }
  };

  const handleBackToFunnels = () => {
    setSelectedFunnel(null);
    setActiveTab('funnels');
  };

  const createFunnel = async (config: CreateFunnelConfig) => {
    const funnelId = `funnel-${Date.now()}`;
    const stages = buildTemplateStages(config.template, funnelId);
    const newFunnel: Funnel = {
      id: funnelId,
      title: config.title,
      // Выбранный шаблон остаётся с воронкой: по нему её потом можно найти
      // в списке и в галерее, а не только разложить этапы при создании.
      type: config.template,
      subscribers: 0,
      conversion: '0%',
      status: 'draft' as const,
      connectedBotId: config.connectedBotId,
      createdAt: new Date().toISOString().split('T')[0],
      sites: config.template === 'course'
        ? [buildCourseTemplateSite(funnelId, config.title, stages)]
        : undefined,
      stages,
    };

    try {
      await saveFunnelToServer(newFunnel);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'Не удалось создать воронку');
      return;
    }
    setFunnels(prev => [newFunnel, ...prev]);
    setFunnelData(newFunnel);
    setSelectedFunnel(newFunnel.id);
    setSelectedAnalyticsFunnel(newFunnel.id);
    setSelectedPlatformFunnel(newFunnel.id);
    setActiveTab('flow');
    setCreateModalOpen(false);
  };

  const handleCreateFunnel = () => setCreateModalOpen(true);

  return (
    <div className="botflow-admin flex h-[100dvh] min-w-0 bg-[#f0f0f5] overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <Suspense fallback={<AdminPanelLoader />}>
        {activeTab === 'dashboard' ? (
          <Dashboard funnels={funnels} onOpenFunnel={handleOpenFunnel} onCreateFunnel={handleCreateFunnel} onDeleteFunnel={handleDeleteFunnel} />
        ) : activeTab === 'analytics' ? (
          <StageAnalyticsPage
            funnels={funnels}
            selectedFunnelId={selectedAnalyticsFunnel}
            onSelectFunnel={setSelectedAnalyticsFunnel}
          />
        ) : activeTab === 'funnels' ? (
          <FunnelsPage funnels={funnels} onOpenFunnel={handleOpenFunnel} onCreateFunnel={handleCreateFunnel} onDeleteFunnel={handleDeleteFunnel} />
        ) : activeTab === 'sites' ? (
          <SitesPage
            funnels={funnels}
            onOpenFunnel={handleOpenFunnel}
            onCreateFunnel={handleCreateFunnel}
          />
        ) : activeTab === 'platform' ? (
          <PlatformSettingsPage
            funnels={funnels}
            selectedFunnelId={selectedPlatformFunnel}
            onSelectFunnel={setSelectedPlatformFunnel}
            onUpdateFunnel={handleUpdateFunnel}
            onOpenFunnel={handleOpenFunnel}
          />
        ) : activeTab === 'gallery' ? (
          <GalleryPage />
        ) : activeTab === 'audience' ? (
          <AudiencePage />
        ) : activeTab === 'broadcasts' ? (
          <BroadcastsPage />
        ) : activeTab === 'sales' ? (
          <SalesPage />
        ) : activeTab === 'settings' ? (
          <SettingsPage />
        ) : (
          <FunnelView
            onBack={handleBackToFunnels}
            initialData={funnelData}
            onUpdateFunnel={handleUpdateFunnel}
            onSaveFunnel={handleSaveFunnel}
            saveError={persistenceError}
            onOpenAnalytics={handleOpenAnalytics}
            onOpenPlatform={handleOpenPlatform}
          />
        )}
      </Suspense>

      {persistenceError && (
        <div role="alert" className="fixed bottom-4 right-4 z-[120] max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg">
          {persistenceError}
        </div>
      )}

      <CreateFunnelModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={createFunnel}
      />
    </div>
  );
}
