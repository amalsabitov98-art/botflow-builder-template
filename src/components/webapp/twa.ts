// Общие помощники для Telegram WebApp (TWA) входа: авторизация, fullscreen, точки входа.

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export type LessonActionState = {
  state: 'sending' | 'success' | 'error';
  botUrl?: string;
  message: string;
  context?: 'lesson' | 'bonus';
  progressCurrent?: number;
  progressTotal?: number;
};

// Воронка, которой принадлежит вход без параметров: статичная кнопка «Открыть
// приложение» у BotFather и адрес /sitelab — оба ведут на один URL без ?funnel=.
// Задаётся при сборке через VITE_DEFAULT_FUNNEL_ID; пусто — таких входов у
// установки просто нет, и страница остаётся обычной админкой.
export const DEFAULT_FUNNEL_ID = import.meta.env.VITE_DEFAULT_FUNNEL_ID || '';
export const DEFAULT_TELEGRAM_STAGE_ID = 'intro';
const SITELAB_ENTRY_PATHS = new Set(['/sitelab', '/site-lab']);

export function isSiteLabEntryPath(pathname = window.location.pathname) {
  return SITELAB_ENTRY_PATHS.has(pathname.replace(/\/$/, ''));
}

export function getInitialWebAppEntry() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(
    isSiteLabEntryPath() ||
    params.get('funnel') ||
    params.get('stage') ||
    params.get('chatId') ||
    window.Telegram?.WebApp?.initData
  );
}

export function getWebAppAuthPayload(params = new URLSearchParams(window.location.search)) {
  return {
    authTs: params.get('authTs') || '',
    authSig: params.get('authSig') || '',
    telegramInitData: window.Telegram?.WebApp?.initData || '',
  };
}

// On desktop Telegram opens Mini Apps in a narrow phone-sized window; requestFullscreen()
// (Bot API 8.0+) lets them fill the screen. We skip phones: there the normal expanded
// sheet looks right, and fullscreen would push content under the status bar. On desktop
// Telegram's Close/menu buttons live in the window chrome, so no safe-area padding needed.
const MOBILE_TG_PLATFORMS = new Set(['ios', 'android', 'android_x']);

export function enableTelegramFullscreen(tg: any) {
  try {
    const platform = String(tg?.platform || '').toLowerCase();
    if (MOBILE_TG_PLATFORMS.has(platform)) return; // phones keep the normal sheet
    const supportsFullscreen =
      typeof tg.requestFullscreen === 'function' &&
      (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('8.0'));
    if (!supportsFullscreen) return;
    if (!tg.isFullscreen) tg.requestFullscreen();
  } catch (err) {
    console.warn('[TWA] requestFullscreen failed', err);
  }
}
