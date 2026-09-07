import React, { lazy, Suspense } from 'react';
import PageLoader from './PageLoader';
import LessonActionNotice from './LessonActionNotice';
import { getWebAppAuthPayload, isSiteLabEntryPath, DEFAULT_FUNNEL_ID, DEFAULT_TELEGRAM_STAGE_ID } from './twa';
import { TelegramMiniAppContext, useTelegramMiniApp } from './miniAppContext';
import type { LessonActionState } from './twa';

const SalesEngineRenderer = lazy(() => import('../editor/SalesEngineRenderer'));
const CourseInfoCard = lazy(() =>
  import('../editor/SalesEngineRenderer').then((module) => ({ default: module.CourseInfoCard }))
);
const CustomStage0 = lazy(() => import('../CustomStage0'));
const CustomStage1 = lazy(() => import('../CustomStage1'));
const CustomStage2 = lazy(() => import('../CustomStage2'));
const CustomStage3 = lazy(() => import('../CustomStage3'));
const IntroProfile = lazy(() => import('../IntroProfile'));
import { ChallengeProgressBar } from '../lessons/ChallengeProgressBar';


interface WebAppViewProps {
  webAppData: {
    blocks: any[];
    theme: string;
    pageEvents: any[];
    title?: string;
    funnelTitle?: string;
    stageIndex?: number;
    stageCount?: number;
    stageNavigation?: Array<{ id: string; index: number; title: string }>;
    // Воронка открыта внутри Telegram как Mini App — приходит с сервера.
    telegramMiniApp?: boolean;
  } | null;
  loading: boolean;
  error?: string;
  chatId: number | null;
  lessonAction: LessonActionState | null;
  setLessonAction: (action: LessonActionState | null) => void;
}

// Признак Mini App нужен вложенным компонентам урока (оформление, тексты,
// поведение после прохождения), поэтому кладём его в контекст один раз здесь.
export default function WebAppView(props: WebAppViewProps) {
  return (
    <TelegramMiniAppContext.Provider value={Boolean(props.webAppData?.telegramMiniApp)}>
      <WebAppViewContent {...props} />
    </TelegramMiniAppContext.Provider>
  );
}

// Рендер страницы урока внутри Telegram WebApp: кастомные премиум-этапы (cosmic/dotcom)
// или стандартный layout с блоками SalesEngineRenderer.
function WebAppViewContent({ webAppData, loading, error, chatId, lessonAction, setLessonAction }: WebAppViewProps) {
    const isMiniApp = useTelegramMiniApp();
    React.useEffect(() => {
      if (loading || !webAppData || !chatId) return;

      const params = new URLSearchParams(window.location.search);
      const funnelId = params.get('funnel');
      const stageId = params.get('stage');
      const isPhonePreview = params.get('preview') === 'phone';
      const hasPaymentOffer = webAppData.blocks.some((block: any) => block.content?.isPayment === true);
      if (!funnelId || !stageId || isPhonePreview || !hasPaymentOffer) return;

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          event: 'offer_viewed',
          funnelId,
          stageId,
          ...getWebAppAuthPayload(params),
        }),
      }).catch(console.error);
    }, [loading, webAppData, chatId]);

    if (loading) {
      return <PageLoader />;
    }

    if (error) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-white">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xl font-bold mb-2">Урок временно недоступен</p>
            <p className="text-sm text-slate-300">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900">
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }

    if (!webAppData) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-xl font-bold text-slate-800 mb-2">Страница не найдена</p>
            <p className="text-sm text-slate-400">Воронка или этап не найдены</p>
          </div>
        </div>
      );
    }

    const theme = webAppData.theme || 'alice';

    const handleCTAClick = async (block?: any) => {
      const params = new URLSearchParams(window.location.search);
      const funnelId = params.get('funnel');
      const stageId = params.get('stage');
      const isPhonePreview = params.get('preview') === 'phone';

      if (block?.content?.isPayment) {
        if (isPhonePreview) {
          setLessonAction({
            state: 'success',
            message: 'Это безопасное превью страницы. В настоящей воронке кнопка создаст оплату для подписчика, открывшего урок из Telegram.',
          });
          return;
        }
        if (!chatId) {
          setLessonAction({
            state: 'error',
            message: 'Для создания оплаты откройте урок из сообщения бота: так Telegram безопасно передаст данные подписчика.',
          });
          return;
        }

        try {
          if (funnelId && stageId) {
            await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId,
                event: 'checkout_started',
                funnelId,
                stageId,
                ...getWebAppAuthPayload(params),
              }),
            });
          }

          const res = await fetch('/api/payments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              offerId: block.content.offerId || `offer-${stageId}`,
              amount: block.content.amount,
              currency: block.content.currency || 'RUB',
              chatId: chatId,
              funnelId,
              stageId,
              ...getWebAppAuthPayload(params),
            })
          });
          const data = await res.json();
          if (data.paymentUrl) {
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.openLink(data.paymentUrl);
            } else {
              window.location.href = data.paymentUrl;
            }
            return;
          } else {
            alert('Ошибка создания платежа: ' + (data.error || 'Неизвестная ошибка'));
            return;
          }
        } catch (e) {
          alert('Ошибка соединения с сервером');
          return;
        }
      }

      if (chatId && stageId !== 'intro') {
        setLessonAction({
          state: 'sending',
          message: isMiniApp
            ? 'Засчитываем урок и отправляем следующий шаг в Telegram.'
            : 'Фиксируем прохождение и готовим следующий шаг в Telegram.',
        });

        try {
          const res = await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, event: 'stage_completed', funnelId, stageId, ...getWebAppAuthPayload(params) })
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok || data.error) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          const botUrl = typeof data.botUrl === 'string' ? data.botUrl : undefined;
          setLessonAction({
            state: 'success',
            botUrl,
            message: data.duplicate
              ? isMiniApp
                ? 'Отлично, урок уже пройден. Следующий урок уже ждёт тебя в Telegram — сейчас открою бот.'
                : 'Этот урок уже засчитан. Следующий шаг уже ждёт тебя в Telegram — открой бота и продолжай с того места, где остановился.'
              : isMiniApp
                ? 'Отлично, урок пройден. Мы уже отправляем тебе следующий урок в Telegram — сейчас открою бот.'
                : 'Поздравляю, шаг засчитан. Следующий урок уже ждёт тебя в Telegram — открой бота и забери продолжение, пока фокус ещё свежий.',
          });
        } catch (e) {
          console.error(e);
          setLessonAction({
            state: 'error',
            message: 'Проверь интернет и нажми кнопку ещё раз. Если Telegram уже прислал следующий шаг, можно открыть бота вручную.',
          });
        }
      } else if (window.Telegram?.WebApp && !isPhonePreview) {
        window.Telegram.WebApp.close();
      } else {
        setLessonAction({
          state: 'success',
          message: isMiniApp
            ? 'Отлично, урок пройден. В настоящем Telegram WebApp здесь отправится следующий урок и запустится переход в бот.'
            : 'Действие выполнено. Если это превью, следующий шаг в Telegram не отправляется.',
        });
      }
    };

    const renderLessonStage = (node: React.ReactNode) => (
      <>
        <Suspense fallback={<PageLoader />}>
          {node}
        </Suspense>
        <LessonActionNotice status={lessonAction} onClose={() => setLessonAction(null)} />
      </>
    );
    const renderCustomLessonStage = (node: React.ReactNode) => (
      renderLessonStage(
        isMiniApp
          ? <div className="telegram-soft-theme">{node}</div>
          : node
      )
    );

    // Determine title & breadcrumbs dynamically based on funnel and stage parameters
    const params = new URLSearchParams(window.location.search);
    const insideTelegram = !!window.Telegram?.WebApp?.initData;
    const isSiteLabEntry = isSiteLabEntryPath();
    const funnelId = params.get('funnel') || DEFAULT_FUNNEL_ID;
    const stageId = params.get('stage') || (insideTelegram || isSiteLabEntry ? DEFAULT_TELEGRAM_STAGE_ID : 'stage-0');
    const isPhonePreview = params.get('preview') === 'phone';
    const courseStages = (webAppData.stageNavigation || []).filter(stage => /урок/i.test(stage.title));
    const currentCourseStage = courseStages.findIndex(stage => stage.id === stageId);
    const visibleBlocks = theme === 'alice' && currentCourseStage >= 0
      ? webAppData.blocks.filter((block: any) => (
          block.type === 'lesson_video_hero'
          || block.type === 'cta_button'
          || (block.type === 'text_block' && block.content?.variant === 'practice')
        ))
      : webAppData.blocks;
    const isDirectResponseVsl = visibleBlocks.some((block: any) => (
      block.type === 'lesson_video_hero' && block.content?.isPayment === true
    ));

    // ===== COSMIC/DOTCOM THEME: Full custom premium page =====
    if (theme === 'cosmic' || theme === 'dotcom') {
      const p = new URLSearchParams(window.location.search);
      const sId = p.get('stage') || (insideTelegram || isSiteLabEntry ? DEFAULT_TELEGRAM_STAGE_ID : 'stage-0');

      if (sId === 'intro') {
        return renderCustomLessonStage(<IntroProfile chatId={chatId} isPhonePreview={isPhonePreview} />);
      }

      const handleBonusClick = () => {
        if (sId === 'stage-3') {
          const bonusEl = document.getElementById('challenge-bonus-section');
          if (bonusEl) {
            bonusEl.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          const currentStep = {
            'stage-0': 1,
            'stage-1': 2,
            'stage-2': 3,
          }[sId] || 1;
          setLessonAction({
            state: 'success',
            context: 'bonus',
            message: 'Пройди все 4 урока, и здесь откроется пакет из 50 промптов и чек-лист для первого клиента на $300.',
            progressCurrent: currentStep,
            progressTotal: 4,
          });
        }
      };

      const withProgress = (node: React.ReactNode) => (
        <>
          <ChallengeProgressBar stageId={sId} onBonusClick={handleBonusClick} />
          {node}
        </>
      );

      if (sId === 'stage-0') {
        return renderCustomLessonStage(withProgress(<CustomStage0 onCTAClick={handleCTAClick} isPhonePreview={isPhonePreview} stageData={webAppData} />));
      }
      if (sId === 'stage-2') {
        return renderCustomLessonStage(withProgress(<CustomStage2 onCTAClick={handleCTAClick} isPhonePreview={isPhonePreview} stageData={webAppData} />));
      }
      if (sId === 'stage-3') {
        return renderCustomLessonStage(withProgress(<CustomStage3 onCTAClick={handleCTAClick} isPhonePreview={isPhonePreview} stageData={webAppData} />));
      }
      return renderCustomLessonStage(withProgress(<CustomStage1 onCTAClick={handleCTAClick} isPhonePreview={isPhonePreview} stageData={webAppData} />));
    }


    return (
      <Suspense fallback={<PageLoader />}>
        <div className={`${theme === 'alice' ? 'skillbox-soft-site' : ''} min-h-screen bg-slate-50 font-sans text-slate-800 antialiased`}>
          {/* Main Content Area */}
          <div className={`site-public-main ${currentCourseStage >= 0 ? 'site-public-main--lesson' : ''} ${isDirectResponseVsl ? 'site-public-main--direct-response' : ''} max-w-lg md:max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-32`}>
            {/* Grid Layout (Responsive: 1 Column on Mobile/Telegram Web App, 3 Columns on Desktop/Web Site) */}
            <div className="site-public-grid grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Left Column (Main Stage Blocks like Video Player, Letters, etc.) */}
              <div className="site-public-content md:col-span-2 space-y-4">
                {visibleBlocks.map((block: any, index: number) => (
                    <SalesEngineRenderer key={block.id || index} block={block} isEditing={false} onCTAClick={handleCTAClick} theme={theme} />
                ))}
              </div>

              {/* Right Column (Sidebar Course Card - Visible on Desktop/Web browser only) */}
              {(() => {
                const vslHeroBlock = webAppData.blocks.find((b: any) => b.type === 'vsl_hero');
                if (vslHeroBlock) {
                  return (
                    <div className="hidden md:block md:col-span-1 sticky top-24">
                      <CourseInfoCard content={vslHeroBlock.content} />
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Close button for Telegram */}
            {window.Telegram?.WebApp && (
              <div className="px-5 pt-6 pb-8 text-center">
                <button
                  onClick={() => {
                    const sId = params.get('stage');
                    if (chatId && sId !== 'intro') {
                      void fetch('/api/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chatId,
                          event: 'stage_completed',
                          funnelId: params.get('funnel'),
                          stageId: sId,
                          ...getWebAppAuthPayload(params),
                        })
                      }).then(async (response) => {
                        if (!response.ok) {
                          const data = await response.json().catch(() => ({}));
                          throw new Error(data.error || `HTTP ${response.status}`);
                        }
                        window.Telegram?.WebApp?.close();
                      }).catch((error) => {
                        console.error('Failed to record stage completion:', error);
                        setLessonAction({
                          state: 'error',
                          message: 'Не удалось сохранить прохождение. Проверь интернет и попробуй ещё раз.',
                        });
                      });
                    } else {
                      window.Telegram?.WebApp?.close();
                    }
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-wider"
                >
                  Закрыть сессию обучения
                </button>
              </div>
            )}
          </div>
          <LessonActionNotice status={lessonAction} onClose={() => setLessonAction(null)} />
        </div>
      </Suspense>
    );
}
