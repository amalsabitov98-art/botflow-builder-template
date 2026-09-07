import { createContext, useContext } from 'react';

/**
 * Открыта ли страница внутри Telegram как Mini App.
 *
 * Раньше это выяснялось сравнением id воронки со строкой — в пяти компонентах
 * сразу, поэтому вторая воронка не могла получить то же оформление, не поменяв
 * код. Признак приходит с сервера вместе с данными страницы (`telegramMiniApp`),
 * а компоненты читают его отсюда.
 *
 * Значение по умолчанию — false: страница открыта обычной ссылкой в браузере.
 */
export const TelegramMiniAppContext = createContext(false);

export function useTelegramMiniApp() {
  return useContext(TelegramMiniAppContext);
}
