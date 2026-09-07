// Предпросмотр платформы получает данные от редактора через postMessage —
// боевой ответ сервера отдаётся только оплатившему из Telegram. Раньше это
// работало лишь для рамки внутри страницы, а открытая в новой вкладке
// платформа показывала встроенный курс вместо программы воронки.
const openedWindows = new Set<Window>();

export function openPreviewWindow(url: string) {
  // Без `noopener`: вкладке нужен opener, чтобы попросить у редактора данные.
  const opened = window.open(url, '_blank');
  if (opened) openedWindows.add(opened);
  return opened;
}

export function previewWindows() {
  for (const opened of [...openedWindows]) {
    if (opened.closed) openedWindows.delete(opened);
  }
  return [...openedWindows];
}
