import React, { lazy, Suspense, useEffect, useState } from 'react';
import PageLoader from './components/webapp/PageLoader';
import WebAppView from './components/webapp/WebAppView';
import {
  DEFAULT_FUNNEL_ID,
  DEFAULT_TELEGRAM_STAGE_ID,
  enableTelegramFullscreen,
  getInitialWebAppEntry,
  getWebAppAuthPayload,
  isSiteLabEntryPath,
  type LessonActionState,
} from './components/webapp/twa';

const MockPayment = lazy(() => import('./components/MockPayment'));
const PlatformPage = lazy(() => import('./components/PlatformPage'));
const AdminApp = lazy(() => import('./components/AdminApp'));

export default function App() {
  if (window.location.pathname === '/mock-checkout') {
    return (
      <Suspense fallback={<PageLoader dark />}>
        <MockPayment />
      </Suspense>
    );
  }

  if (
    window.location.pathname === '/platform' ||
    new URLSearchParams(window.location.search).get('stage') === 'platform'
  ) {
    return (
      <Suspense fallback={<PageLoader dark />}>
        <PlatformPage />
      </Suspense>
    );
  }

  if (
    window.location.pathname === '/shader-demo' ||
    new URLSearchParams(window.location.search).get('stage') === 'shader-demo'
  ) {
    const HeroDemo = React.lazy(() => import('./components/ui/HeroDemo'));
    return (
      <Suspense fallback={<PageLoader dark />}>
        <HeroDemo />
      </Suspense>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const [isTWA, setIsTWA] = useState(getInitialWebAppEntry);
  const [chatId, setChatId] = useState<number | null>(null);
  const [webAppData, setWebAppData] = useState<{
    blocks: any[];
    theme: string;
    pageEvents: any[];
    title?: string;
    funnelTitle?: string;
    stageIndex?: number;
    stageCount?: number;
    stageNavigation?: Array<{ id: string; index: number; title: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lessonAction, setLessonAction] = useState<LessonActionState | null>(null);

  useEffect(() => {
    // Check URL params for funnel/stage
    const params = new URLSearchParams(window.location.search);
    let funnelId = params.get('funnel');
    let stageId = params.get('stage');
    const urlChatId = params.get('chatId');
    const isPreview = params.get('preview') === 'phone' || urlChatId === '123';
    const isSiteLabEntry = isSiteLabEntryPath();

    // BotFather's "Open app" button can only point to a static Mini App URL.
    // Use /sitelab as a public product entry so it never falls through to the admin panel.
    const insideTelegram = !!window.Telegram?.WebApp?.initData;
    if (!funnelId && (insideTelegram || isSiteLabEntry)) {
      funnelId = DEFAULT_FUNNEL_ID;
      stageId = stageId || DEFAULT_TELEGRAM_STAGE_ID;
    }

    const trackWebAppOpened = (id: number) => {
      setIsTWA(true);
      setChatId(id);
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id, event: 'webapp_opened', funnelId, stageId, ...getWebAppAuthPayload(params) })
      }).catch(console.error);
    };

    // Initialize Telegram Web App if available
    if (!isPreview && window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      enableTelegramFullscreen(tg);

      if (tg.initDataUnsafe?.user) {
        trackWebAppOpened(tg.initDataUnsafe.user.id);
      } else if (urlChatId) {
        trackWebAppOpened(Number(urlChatId));
      }
    } else if (!isPreview && urlChatId) {
      trackWebAppOpened(Number(urlChatId));
    }

    // If we have funnel/stage params, fetch the webapp data
    if (funnelId && stageId) {
      setIsTWA(true); // Show webapp view even without Telegram context
      const fetchPath = stageId === 'intro' ? `/api/webapp/${funnelId}/intro` : `/api/webapp/${funnelId}/${stageId}`;
      const authPayload = getWebAppAuthPayload(params);
      const fetchParams = new URLSearchParams();
      const fetchChatId = urlChatId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (fetchChatId) fetchParams.set('chatId', String(fetchChatId));
      if (authPayload.authTs) fetchParams.set('authTs', authPayload.authTs);
      if (authPayload.authSig) fetchParams.set('authSig', authPayload.authSig);
      const fetchUrl = fetchParams.size ? `${fetchPath}?${fetchParams}` : fetchPath;
      const fetchHeaders = new Headers();
      if (authPayload.telegramInitData) {
        fetchHeaders.set('X-Telegram-Init-Data', authPayload.telegramInitData);
      }
      fetch(fetchUrl, { headers: fetchHeaders })
        .then(res => {
          if (!res.ok) {
            throw new Error(`WebApp not found: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          // Both complete webapp and funnel.introWebApp have blocks, theme, pageEvents properties (which might be inside the object or top-level depending on what the API returned)
          // Since our new API returns the pure StageWebApp object, data.blocks should exist
          if (!Array.isArray(data.blocks)) throw new Error('Некорректная страница урока');
          setWebAppData(data);
          setLoadError('');
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load WebApp:', error);
          setWebAppData(null);
          setLoadError('Не удалось загрузить урок. Проверьте интернет и откройте страницу ещё раз из сообщения бота.');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTWA || !chatId) return;

    const params = new URLSearchParams(window.location.search);
    const funnelId = params.get('funnel');
    const stageId = params.get('stage');
    const isPreview = params.get('preview') === 'phone';
    if (isPreview) return;
    if (!funnelId || !stageId || stageId === 'intro') return;

    let sent = false;
    const sendViewed = () => {
      if (sent) return;
      sent = true;
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, event: 'lesson_viewed', funnelId, stageId, ...getWebAppAuthPayload(params) })
      }).catch(console.error);
    };

    window.addEventListener('lesson-video-viewed', sendViewed);
    return () => {
      window.removeEventListener('lesson-video-viewed', sendViewed);
    };
  }, [isTWA, chatId]);

  // Telegram Web App view — render actual funnel stage blocks
  if (isTWA) {
    return (
      <WebAppView
        webAppData={webAppData}
        loading={loading}
        error={loadError}
        chatId={chatId}
        lessonAction={lessonAction}
        setLessonAction={setLessonAction}
      />
    );
  }

  // Auth gate — only for admin panel, not for Telegram WebApp
  return (
    <Suspense fallback={<PageLoader dark />}>
      <AdminApp />
    </Suspense>
  );
}
