// Встроенная программа платформы. Она остаётся в коде по двум причинам:
// её показывают воронки, где программу ещё не завели в настройках, и с неё
// удобно начать — кнопка «Взять за основу» копирует эти уроки в воронку.
export type Tier = 'pkg-1' | 'pkg-2';

export interface Lesson {
  id: string;
  module: string;
  title: string;
  icon?: string;
  duration: string;
  description: string;
  videoSrc: string; // YouTube embed URL
  minTier: Tier; // pkg-2 — бонусные уроки, видны только старшему тарифу
  coverUrl?: string;
  resources?: Array<{ label: string; href: string; minTier?: Tier }>;
}



export const DEFAULT_PLATFORM_TITLE = 'AI Site Lab';

export const DEFAULT_TIER_LABELS: Record<Tier, string> = {
  'pkg-1': 'IT-Архитектор',
  'pkg-2': '⭐ IT-Владелец',
};

export const DEFAULT_LESSONS: Lesson[] = [
  {
    id: 'm1-setup',
    icon: 'setup',
    module: 'Модуль 1 · Инструмент и премиум-фронтенд',
    title: 'Установка Antigravity и рабочая среда вайб-кодера',
    duration: '16 мин',
    description: 'Ставим профессиональную среду, настраиваем проект и учимся вести диалог с ИИ так, чтобы он не ломал код и не терял контекст.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    coverUrl: '/images/platform-bg.jpg',
    minTier: 'pkg-1',
    resources: [
      { label: 'Чек-лист установки', href: '#' },
      { label: 'Стартовый промпт проекта', href: '#' },
    ],
  },
  {
    id: 'm1-frontend',
    icon: 'design',
    module: 'Модуль 1 · Инструмент и премиум-фронтенд',
    title: 'Дорогой многостраничный сайт с анимациями',
    duration: '24 мин',
    description: 'Собираем структуру, адаптив, hero, карточки, анимации и визуальный стиль, который можно показывать клиенту как готовый продукт.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    coverUrl: '/images/lesson1-night-1280.webp',
    minTier: 'pkg-1',
    resources: [
      { label: 'Промпты для premium UI', href: '#' },
      { label: 'Референсы секций', href: '#' },
    ],
  },
  {
    id: 'm1-telegram-webapp',
    icon: 'webapp',
    module: 'Модуль 1 · Инструмент и премиум-фронтенд',
    title: 'Telegram Web App внутри бота',
    duration: '21 мин',
    description: 'Создаём мобильный интерфейс внутри Telegram: меню, прогресс, кнопки, события и персональные экраны для пользователя.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-1',
    resources: [
      { label: 'Шаблон WebApp-экрана', href: '#' },
      { label: 'События и аналитика', href: '#' },
    ],
  },
  {
    id: 'm2-amocrm',
    icon: 'crm',
    module: 'Модуль 2 · AmoCRM',
    title: 'Заявки с сайта напрямую в AmoCRM',
    duration: '28 мин',
    description: 'Подключаем сайт к CRM: клиент оставляет заявку, бизнес сразу видит лид в базе, а ты продаёшь уже не страницу, а систему.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-1',
    resources: [
      { label: 'Схема интеграции AmoCRM', href: '#' },
      { label: 'Промпт для webhook-логики', href: '#' },
    ],
  },
  {
    id: 'm3-ai-seller',
    icon: 'ai',
    module: 'Модуль 3 · ИИ-продавец',
    title: 'ИИ-продавец в WhatsApp / Telegram',
    duration: '31 мин',
    description: 'ИИ видит новую заявку, пишет клиенту в мессенджер, отвечает по базе знаний бизнеса и помогает довести диалог до сделки.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-1',
    resources: [
      { label: 'База знаний для ИИ-продавца', href: '#' },
      { label: 'Скрипт отработки возражений', href: '#' },
    ],
  },
  {
    id: 'm4-saas-payments',
    icon: 'payments',
    module: 'Модуль 4 · Свой IT-сервис',
    title: 'Свой SaaS: кабинеты, доступы и платежи',
    duration: '36 мин',
    description: 'Собираем сервис с регистрацией, личным кабинетом, оплатами и автоматической выдачей доступа после покупки.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-1',
    resources: [
      { label: 'Архитектура SaaS', href: '#' },
      { label: 'Промпты для оплаты и доступов', href: '#' },
    ],
  },
  {
    id: 'm5-monetization',
    icon: 'traffic',
    module: 'Модуль 5 · Монетизация',
    title: 'Стратегия выхода на $2000+',
    duration: '34 мин',
    description: 'Как упаковать навык, кому писать, как вести переговоры и продавать бизнесу внедрение ИИ-систем на чеки от $1500.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-2',
    resources: [
      { label: 'Скрипты продаж', href: '#' },
      { label: 'Шаблон коммерческого предложения', href: '#' },
    ],
  },
  {
    id: 'bonus-source',
    icon: 'code',
    module: 'Бонусы IT-Владельца',
    title: 'Исходный код ИИ-сервиса',
    duration: '27 мин',
    description: 'Разбираем готовый код платформы: как развернуть, поменять дизайн под свою нишу и начать принимать оплаты по подписке.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-2',
    resources: [
      { label: 'Скачать исходный код', href: '#' },
      { label: 'Инструкция по запуску', href: '#' },
    ],
  },
  {
    id: 'bonus-traffic',
    icon: 'launch',
    module: 'Бонусы IT-Владельца',
    title: 'ИИ-трафик: Instagram + Threads',
    duration: '23 мин',
    description: 'Как заставить ИИ генерировать контент и вести бесплатный органический трафик на твой продукт или услугу.',
    videoSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    minTier: 'pkg-2',
    resources: [
      { label: 'Контент-матрица', href: '#' },
      { label: '30 промптов для органики', href: '#' },
    ],
  },
];
