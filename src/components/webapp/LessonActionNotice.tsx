import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, FileText, Gift, Loader2, LockKeyhole, Send, Sparkles, X } from 'lucide-react';
import type { LessonActionState } from './twa';
import { useTelegramMiniApp } from './miniAppContext';

export default function LessonActionNotice({
  status,
  onClose,
}: {
  status: LessonActionState | null;
  onClose: () => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const isMiniApp = useTelegramMiniApp();
  const isPhonePreview = params.get('preview') === 'phone';
  const [countdown, setCountdown] = useState(5);

  const openBot = () => {
    if (!status) return;
    if (isPhonePreview && !status.botUrl) return;
    const telegramWebApp = window.Telegram?.WebApp;

    if (telegramWebApp?.openTelegramLink && status.botUrl) {
      telegramWebApp.openTelegramLink(status.botUrl);
      window.setTimeout(() => telegramWebApp.close?.(), 180);
      return;
    }

    if (telegramWebApp?.close) {
      telegramWebApp.close();
      return;
    }

    if (telegramWebApp?.openLink && status.botUrl) {
      telegramWebApp.openLink(status.botUrl);
      return;
    }

    if (status.botUrl) {
      window.location.href = status.botUrl;
    }
  };

  useEffect(() => {
    if (!status || status.state !== 'success' || !isMiniApp) return;

    const telegramWebApp = window.Telegram?.WebApp;
    if (!status.botUrl && !telegramWebApp?.close) return;

    setCountdown(5);
    const countdownTimer = window.setInterval(() => {
      setCountdown((current) => Math.max(1, current - 1));
    }, 1000);
    const openTimer = window.setTimeout(() => {
      openBot();
    }, 5200);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(openTimer);
    };
  }, [status?.state, status?.botUrl, isMiniApp]);

  if (!status) return null;

  const isSending = status.state === 'sending';
  const isSuccess = status.state === 'success';
  const isError = status.state === 'error';
  const isBonus = status.context === 'bonus';
  const title = isBonus
    ? 'Бонус ждёт в финале'
    : isSending
    ? 'Сохраняем прогресс'
    : isSuccess && isMiniApp
      ? 'Поздравляю!'
      : isSuccess
        ? 'Следующий шаг готов'
        : 'Не получилось отправить';
  const Icon = isBonus ? Gift : isSending ? Loader2 : isSuccess ? Check : AlertCircle;
  const accentColor = isMiniApp ? '#3C3BFF' : '#baff4a';
  const showFullScreenSuccess = isMiniApp && isSuccess && !isBonus;

  if (isBonus) {
    const currentStep = Math.min(status.progressCurrent || 1, status.progressTotal || 4);
    const totalSteps = status.progressTotal || 4;

    return (
      <div className="lesson-action-notice fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-3 pb-3 pt-10 backdrop-blur-[6px] md:items-center md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bonus-dialog-title"
          className="challenge-progress-bar relative w-full max-w-[420px] overflow-hidden rounded-[10px] border border-[#E8D5AE]/[0.16] bg-[#11171B]/[0.98] text-[#DDE3E7] shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[#D7C39C]/80" />

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3.5">
              <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#E8D5AE]/25 bg-[#E8D5AE]/[0.09] text-[#E8D5AE] shadow-[0_0_0_6px_rgba(232,213,174,0.035)]">
                <Gift className="h-[22px] w-[22px]" strokeWidth={2.2} />
                <Sparkles className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-[#B9CDDC]" strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-[#AFC6D8]">
                  Откроется после 4-го урока
                </div>
                <h2 id="bonus-dialog-title" className="mt-1 text-[21px] font-semibold leading-[1.2] text-[#E2E7EA]">
                  Финишный подарок
                </h2>
                <span className="mt-2 inline-flex rounded-full border border-[#E8D5AE]/20 bg-[#E8D5AE]/[0.07] px-2 py-0.5 text-[10px] font-semibold text-[#DCC9A4]">
                  2 материала в подарок
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Закрыть"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <p className="mt-5 text-[14px] font-normal leading-[1.6] text-white/58">
              Дойди до конца курса, и подарок появится здесь автоматически.
            </p>

            <div className="mt-5" aria-label={`Шаг ${currentStep} из ${totalSteps}`}>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-white/48">Шаг {currentStep} из {totalSteps}</span>
                <span className="text-[#DCC9A4]">Подарок</span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 min-w-0 flex-1 rounded-full ${index < currentStep ? 'bg-[#91AEC5]' : 'bg-white/[0.08]'}`}
                  />
                ))}
                <span className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#E8D5AE]/25 bg-[#E8D5AE]/[0.07] text-[#E8D5AE]">
                  <Gift className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div className="mt-5 text-[11px] font-medium text-white/42">Внутри подарка</div>
            <div className="mt-1.5 border-y border-white/[0.08]">
              <div className="flex items-center gap-3 py-3.5">
                <Sparkles className="h-[18px] w-[18px] shrink-0 text-[#E8D5AE]" />
                <div>
                  <div className="text-[14px] font-semibold text-[#DDE3E7]">50 готовых промптов</div>
                  <div className="mt-0.5 text-[12px] text-white/42">Для сайтов, ботов и продающих экранов</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-white/[0.08] py-3.5">
                <FileText className="h-[18px] w-[18px] shrink-0 text-[#AFC6D8]" />
                <div>
                  <div className="text-[14px] font-semibold text-[#DDE3E7]">Чек-лист первого клиента</div>
                  <div className="mt-0.5 text-[12px] text-white/42">Пошаговый план сделки на $300</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[8px] bg-[#A9C1D3] px-4 text-[14px] font-semibold text-[#101820] shadow-[0_10px_26px_rgba(143,173,197,0.1)] transition hover:bg-[#B7CBDA] active:scale-[0.99]"
            >
              Продолжить урок
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/35">
              <LockKeyhole className="h-3.5 w-3.5" />
              <span>Доступ откроется при прогрессе 100%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`lesson-action-notice fixed inset-0 z-[100] flex items-end justify-center bg-black/35 px-3 pb-3 pt-10 backdrop-blur-[2px] md:items-center md:p-6 ${isMiniApp ? 'lesson-action-notice-soft' : ''} ${showFullScreenSuccess ? 'lesson-action-success-full' : ''}`}>
      {showFullScreenSuccess && (
        <div className="lesson-confetti-burst" aria-hidden="true">
          {Array.from({ length: 72 }).map((_, index) => (
            <span key={index} style={{ '--i': index } as React.CSSProperties} />
          ))}
        </div>
      )}
      <div className="lesson-action-card relative w-full max-w-[460px] overflow-hidden rounded-[8px] border border-white/12 bg-[#0d1017]/95 text-white shadow-2xl shadow-black/40">
        {isSuccess && isMiniApp && (
          <div className="lesson-fireworks" aria-hidden="true">
            {Array.from({ length: 32 }).map((_, index) => (
              <span key={index} style={{ '--i': index } as React.CSSProperties} />
            ))}
          </div>
        )}
        <div className="h-1 bg-white/10">
          <div
            className={`h-full transition-all duration-500 ${
              isSuccess ? 'w-full' : isError ? 'w-2/3 bg-red-400' : 'w-1/2'
            }`}
            style={!isError ? { backgroundColor: accentColor } : undefined}
          />
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                isBonus
                  ? 'bg-[#baff4a]/12 text-[#baff4a] ring-1 ring-[#baff4a]/25'
                  : isSuccess
                  ? isMiniApp ? 'bg-[#3C3BFF] text-white' : 'bg-[#baff4a] text-[#10131a]'
                  : isError
                    ? 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30'
                    : isMiniApp ? 'bg-[#3C3BFF]/10 text-[#3C3BFF] ring-1 ring-[#3C3BFF]/25' : 'bg-[#baff4a]/12 text-[#baff4a] ring-1 ring-[#baff4a]/25'
              }`}>
                <Icon className={`h-5 w-5 ${isSending ? 'animate-spin' : ''}`} strokeWidth={2.6} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                  {isBonus ? 'Награда за курс' : 'Урок завершён'}
                </div>
                <h2 className="mt-1 text-xl font-black leading-tight tracking-normal text-white">
                  {title}
                </h2>
              </div>
            </div>

            {!isSending && (
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-white/10 text-white/55 transition hover:border-white/20 hover:text-white"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-4 text-[15px] font-medium leading-6 text-white/70">{status.message}</p>

          {showFullScreenSuccess && (
            <div className="lesson-countdown-orb" aria-label={`Открываю Telegram через ${countdown}`}>
              {countdown}
            </div>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            {status.botUrl && (
              <button
                type="button"
                onClick={openBot}
                className="lesson-action-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#baff4a] px-4 text-sm font-black text-[#10131a] transition hover:brightness-105"
              >
                <Send className="h-4 w-4" />
                Открыть Telegram
                <ExternalLink className="h-4 w-4 opacity-70" />
              </button>
            )}
            {!isSending && (
              <button
                type="button"
                onClick={onClose}
                className="lesson-action-secondary inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/12 px-4 text-sm font-extrabold text-white/68 transition hover:border-white/20 hover:text-white"
              >
                {isBonus ? 'Понятно' : 'Остаться здесь'}
              </button>
            )}
            {isSending && (
              <div className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/10 px-4 text-sm font-extrabold text-white/45">
                Отправляем...
              </div>
            )}
          </div>

          {isSuccess && (
            <div className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold leading-5 text-white/45">
              {isBonus
                ? 'Бонус откроется автоматически, когда прогресс дойдёт до 100%.'
                : isMiniApp
                ? `Открываю Telegram через ${countdown}. Следующий урок уже отправлен вторым сообщением.`
                : 'Можно закрыть окно и остаться на уроке, но продолжение уже ждёт в Telegram.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
