import type { WebAppBlock } from './webapp';

// ===== Напоминание (дожимающее сообщение) =====
export interface Reminder {
  id: string;
  delayMinutes: number;
  delayLabel: string; // "60 минут", "2 часа", "23 часа"
  condition?: 'not_opened' | 'opened_not_viewed' | 'viewed_not_completed' | 'not_completed' | 'not_paid';
  message: string;
  photo?: string; // URL/path изображения для дожимного сообщения
  buttonText?: string;
  buttonAction?: 'next_stage' | 'open_webapp' | 'url';
  buttonUrl?: string;
  buttonStyle?: string;
  pinMessage?: boolean; // Закрепить напоминание в чате Telegram
}

// ===== Событие / задача на Web App странице =====
export interface PageEvent {
  id: string;
  label: string; // "Первый вход", "Квиз пройден", "Вход на страницу"
  eventKey: string; // "first_visit", "quiz_completed", "page_view"
}

// ===== Правило (реакция на событие) =====
export interface StageRule {
  id: string;
  type: 'message';
  message: string;
  buttonText?: string;
}

// ===== Платный оффер этапа =====
// Сервер берёт сумму, валюту и тариф отсюда, а не из тела запроса клиента.
export interface StagePaymentOffer {
  offerId: string;
  tier?: 'pkg-1' | 'pkg-2';
  accessTier?: 'pkg-1' | 'pkg-2';
  amount: number;
  currency?: string;
  product?: string;
  offerTitle?: string;
}

// ===== Конфигурация Web App для этапа =====
export interface StageWebApp {
  enabled: boolean;
  access?: 'public' | 'signed' | 'paid';
  blocks: WebAppBlock[];
  theme: 'alice' | 'hormozi' | 'dotcom' | 'story' | 'cosmic';
  pageEvents: PageEvent[];
  paymentOffers?: StagePaymentOffer[];
  menuButtonText?: string; // Текст для кнопки меню бота (например "🚀 Начать обучение")
}

// ===== Переход на другой этап =====
export interface StageTransition {
  targetStageId?: string;
  label: string; // "Далее: Вебинар", "Далее: Продажа курса"
  // Через сколько минут следующий этап уходит сам, без нажатия кнопки.
  // Пусто или 0 — этап ждёт действия человека, как было всегда.
  // Кнопка при этом никуда не девается: нажал раньше — автопереход отменяется.
  autoAdvanceMinutes?: number;
  autoAdvanceLabel?: string; // "24 часа" — только для админки
}

// ===== Первое сообщение этапа =====
export interface StageMessage {
  // Метка задержки для админки ("Сразу", "Через 24 часа").
  // Сервер её не использует и не проставляет в дожимных сообщениях.
  delay?: string;
  text: string;
  buttonText?: string;
  buttonAction?: 'next_stage' | 'open_webapp' | 'url';
  buttonUrl?: string;
  buttonStyle?: string;
  photo?: string; // URL/path изображения для отправки с сообщением
  videoNote?: string; // URL/path видео-кругляшка для отправки перед сообщением
  video?: string; // URL/path обычного видео для отправки вместо фото
  gif?: string; // URL/path GIF-анимации для отправки вместо фото/видео
  pinMessage?: boolean; // Закрепить отправленное сообщение в чате Telegram
  // Порядок отправки, когда у сообщения есть и медиа, и текст.
  mediaOrder?: 'media_first' | 'text_first';
}

// ===== Вопрос подписчику =====
// Единственный способ воронки что-то узнать о человеке: он отвечает кнопкой,
// ответ ложится в профиль и может увести его на другую ветку.
export interface StageQuestionOption {
  id: string;
  label: string;
  // Куда вести после этого ответа. Пусто — остаёмся на текущем этапе.
  targetStageId?: string;
}

export interface StageQuestion {
  id: string;
  // Ключ, под которым ответ ляжет в профиль: goal, level, budget…
  key: string;
  text: string;
  options: StageQuestionOption[];
}

// ===== Этап воронки =====
export interface FunnelStage {
  id: string;
  index: number;
  title: string;
  firstMessage: StageMessage;
  webApp?: StageWebApp;
  nextStage?: StageTransition;
  rules: StageRule[];
  reminders: Reminder[];
  // Вопросы задаются по очереди после сообщения этапа.
  questions?: StageQuestion[];
  // Домашнее задание (челлендж)
  requireHomework?: boolean;
  homeworkCriteria?: string;
  // Статистика
  stats?: {
    messagesSent: number;
    messagesReceived: number;
  };
}


export interface FunnelSitePage {
  id: string;
  title: string;
  slug: string;
  stageId?: string;
  source?: 'intro' | 'stage' | 'custom';
}

export interface FunnelSite {
  id: string;
  title: string;
  slug: string;
  customDomain?: string;
  isPrimary?: boolean;
  pages?: FunnelSitePage[];
}

// ===== ИИ-ассистент воронки =====
// Отвечает подписчику в Telegram, когда тот пишет боту сам. Все действия
// выключены по умолчанию: ассистент, который умеет только отвечать, —
// самый безопасный вариант.
export interface FunnelAssistant {
  // Главный выключатель ИИ для этой воронки.
  enabled: boolean;
  // Описание оффера, тона и границ — попадает в системный промпт.
  systemPrompt?: string;
  // Отвечать подписчику, когда он пишет боту сам. По умолчанию включено.
  replyToMessages?: boolean;
  // Переписывать текст напоминаний под конкретного человека вместо шаблона.
  // Если ИИ недоступен или ответил мусором, уходит исходный текст.
  personalizeReminders?: boolean;
  // Разрешить повторно отправлять этап, который подписчик уже получал.
  allowResendStage?: boolean;
  // Разрешить давать ссылку на страницу этапа с оплатой.
  // Ассистент не создаёт платёж и не называет сумму сам — цена берётся с сервера.
  allowPaymentLink?: boolean;
  // Сколько обращений к ИИ на одного подписчика за сутки.
  dailyMessageLimit?: number;

  // ===== Длинный дожим =====
  // Ассистент сам решает, когда и что написать человеку, который замолчал.
  nurtureEnabled?: boolean;
  // Жёсткие пределы. Они проверяются в коде, а не в промпте: модель не может их обойти.
  nurtureMaxTouches?: number;    // по умолчанию 6
  nurtureMinGapHours?: number;   // по умолчанию 72
  nurtureWindowDays?: number;    // по умолчанию 30
}

// ===== Живой эфир платформы =====
// Созвон с учениками: до эфира — анонс со ссылкой, после — запись.
// Хранится в данных воронки, поэтому добавляется из админки, а не деплоем.
export interface LiveSessionMaterial {
  label: string;
  href: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  // Время начала. Пустое — эфир без даты, только запись.
  startsAt?: string;
  durationMin?: number;
  // Ссылка на подключение, актуальна до и во время эфира.
  joinUrl?: string;
  // Запись появляется после эфира.
  recordingUrl?: string;
  // Младший тариф, которому эфир доступен.
  minTier?: 'pkg-1' | 'pkg-2';
  materials?: LiveSessionMaterial[];
}

// ===== Бонусы =====
// Награда за доведённое до конца действие: урок, ответ на вопрос, задание.
// Смысл не в валюте, а в причине не бросать на середине.
export interface BonusReward {
  id: string;
  title: string;
  description?: string;
  price: number;
  // Что человек получает после обмена: ссылка, промокод или инструкция.
  payload?: string;
  minTier?: 'pkg-1' | 'pkg-2';
}

export interface FunnelBonus {
  enabled: boolean;
  // Как называем валюту в интерфейсе: «бонусных рублей», «баллов»…
  currencyLabel?: string;
  perLesson?: number;
  perQuestion?: number;
  rewards?: BonusReward[];
}

// ===== Программа платформы =====
// Материал урока: ссылка на файл, шаблон, чек-лист.
export interface PlatformLessonResource {
  label: string;
  href: string;
  minTier?: 'pkg-1' | 'pkg-2';
}

// Урок платформы. Раньше программа лежала массивом в коде страницы и была
// общей для всех воронок: вторую платформу нельзя было собрать, не редактируя
// исходники. Теперь она принадлежит воронке, а код остаётся запасным вариантом
// для воронок, где программу ещё не завели.
export interface PlatformLesson {
  id: string;
  // Модули задаются названием прямо в уроке: список плоский, а группировка
  // получается сама. Так проще переносить урок между модулями.
  module: string;
  title: string;
  // Ключ иконки из LESSON_ICONS.
  icon?: string;
  duration?: string;
  description?: string;
  // Обложка урока в каталоге. Пусто — рисуем локальную заглушку.
  coverUrl?: string;
  // Ссылка для встраивания (YouTube embed и подобные).
  videoSrc?: string;
  minTier?: 'pkg-1' | 'pkg-2';
  resources?: PlatformLessonResource[];
}

// Тариф платформы: как он называется ученику и что обещает.
export interface PlatformTier {
  label?: string;
  description?: string;
}

// Всё, что относится к платной платформе воронки.
export interface FunnelPlatform {
  // Название платформы в шапке у ученика. Пусто — берётся название воронки.
  title?: string;
  lessons?: PlatformLesson[];
  tiers?: {
    'pkg-1'?: PlatformTier;
    'pkg-2'?: PlatformTier;
  };
  sessions?: LiveSession[];
  bonus?: FunnelBonus;
  // Куда ведёт кнопка «Нужна помощь?» на платформе: чат куратора или поддержки.
  // Пусто — блок не показывается вовсе, чтобы ученик не упирался в мёртвую ссылку.
  curatorUrl?: string;
}

// ===== Воронка =====
// Вид оффера, выбранный при создании. Раньше шаблон только раскладывал этапы и
// нигде не сохранялся, поэтому отличить лид-магнит от продажи услуги было нельзя.
// Пусто — воронка создана до появления поля.
export type FunnelType = 'blank' | 'lead' | 'course' | 'sales';

export interface Funnel {
  id: string;
  title: string;
  type?: FunnelType;
  // Воронка живёт внутри Telegram как Mini App: кнопки открывают страницы
  // нативно (web_app), следующий этап уходит сразу, а не через паузу, и уроки
  // оформлены под интерфейс Telegram. Пусто — страницы открываются обычной
  // ссылкой во внешнем браузере, как было до появления поля.
  telegramMiniApp?: boolean;
  status: 'draft' | 'active' | 'archived';
  subscribers: number;
  subscriberIds?: number[];
  activeSubscribers?: number;
  activeSubscriberIds?: number[];
  unsubscribedSubscriberIds?: number[];
  conversion: string;
  createdAt: string;
  connectedBotId?: string;
  introWebApp?: StageWebApp;
  sites?: FunnelSite[];
  assistant?: FunnelAssistant;
  platform?: FunnelPlatform;
  stages: FunnelStage[];
}
