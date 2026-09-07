// Воронки и этапы описаны один раз в shared/ и используются админкой и сервером:
// расхождение схемы между фронтендом и API ловится компилятором, а не в проде.
export type {
  Funnel,
  FunnelAssistant,
  FunnelPlatform,
  FunnelSite,
  FunnelSitePage,
  FunnelStage,
  FunnelType,
  PageEvent,
  PlatformLesson,
  PlatformLessonResource,
  PlatformTier,
  Reminder,
  BonusReward,
  FunnelBonus,
  LiveSession,
  LiveSessionMaterial,
  StageMessage,
  StageQuestion,
  StageQuestionOption,
  StageRule,
  StageTransition,
  StageWebApp,
} from "../shared/funnel";
export type { AudienceFilter } from "../shared/audience";

export interface SubscriberProfile {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  lastActive: string;
  // Ассистент передал разговор человеку: в CRM видно, что ждут ответа оператора.
  awaitingHumanReply?: string;
  // Telegram вернул 403 при отправке: пользователь заблокировал бота.
  // Сбрасывается при любой новой активности пользователя (см. trackUserActivity).
  botBlockedAt?: string;
  // Состояние хранится отдельно для каждого подключённого бота. Старые поля
  // выше оставлены для совместимости с данными до миграции.
  botStates?: Record<string, {
    blockedAt?: string;
    awaitingHumanReply?: string;
  }>;
}

export interface MessageEntry {
  id: string;
  from: 'bot' | 'user';
  text: string;
  timestamp: string;
  botId?: string;
  funnelId?: string;
  media?: {
    type: 'photo' | 'video' | 'videoNote' | 'animation' | 'document' | 'sticker' | 'voice' | 'audio';
    fileId?: string;
    botId?: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
  };
}

export interface OrderEntry {
  accessDelivery?: {
    status: 'pending' | 'sent';
    attempts: number;
    nextAttemptAt?: string;
    sentAt?: string;
  };
  id: string;
  idempotencyKey?: string;
  customer: string;
  username: string;
  product: string;
  amount: number;
  status: 'paid' | 'pending' | 'refund';
  date: string;
  createdAt?: string;
  bot: string;
  chatId?: number | null;
  funnelId?: string;
  stageId?: string;
  offerId?: string;
  accessTier?: 'pkg-1' | 'pkg-2';
  currency?: string;
}

export interface LavaPaymentIntent {
  paymentId: string;
  chatId: number;
  funnelId: string;
  stageId: string;
  offerId: string;
  tier: 'pkg-1' | 'pkg-2';
  amount: number;
  currency: string;
  product: string;
  buyerEmail: string;
  createdAt: string;
}

export interface BroadcastRecipient {
  chatId: number;
  botId?: string;
  firstName?: string;
  username?: string;
  funnelId?: string;
  status: 'sent' | 'failed' | 'skipped' | 'blocked';
  error?: string;
  sentAt?: string;
}

export interface BroadcastCampaign {
  id: string;
  type: 'manual' | 'test' | 'auto';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed' | 'skipped';
  name?: string;
  segmentKey: string;
  segmentLabel: string;
  // Дополнительный отбор по ответам и источнику. Хранится вместе с кампанией,
  // чтобы отложенный запуск собрал ту же аудиторию, что показал предпросмотр.
  filter?: import("../shared/audience").AudienceFilter;
  funnelId?: string;
  funnelLabel?: string;
  recipientIds?: number[];
  text: string;
  mediaType?: 'none' | 'photo' | 'video' | 'videoNote';
  mediaUrl?: string;
  pinMessage?: boolean;
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  sourceRuleId?: string;
  // Причина, по которой рассылка не ушла или оборвалась — показывается в админке.
  error?: string;
  // Слепок аудитории на момент запуска: по нему отправка догружается после
  // перезапуска сервера, не задевая тех, кто подписался уже во время рассылки.
  targetChatIds?: number[];
  result: {
    total: number;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    blocked?: number;
  };
  recipients: BroadcastRecipient[];
}

export interface BroadcastRule {
  id: string;
  name: string;
  segmentKey: string;
  filter?: import("../shared/audience").AudienceFilter;
  delayMinutes: number;
  text: string;
  mediaType?: 'none' | 'photo' | 'video' | 'videoNote';
  mediaUrl?: string;
  pinMessage?: boolean;
  enabled: boolean;
  limitPerRun: number;
  createdAt: string;
  updatedAt: string;
}

export interface BotEntry {
  id: string;
  token: string;
  name: string;
  firstName: string;
  active: boolean;
  addedAt: string;
}

export interface Settings {
  bots: BotEntry[];
  geminiApiKey: string;
  appUrl: string;
  notifications: boolean;
  autoReminders: boolean;
  lavaApiKey?: string;
  lavaWebhookSecret?: string;
  // Ключ ИИ-ассистента воронок. Хранится как остальные секреты проекта:
  // редактируется в админке, наружу отдаётся только маской.
  deepseekApiKey?: string;
  // Telegram Chat ID администратора для получения уведомлений об оплатах и эскалациях
  adminTelegramChatId?: string;
  // Username эксперта в Telegram (без @) для ссылок на сдачу ДЗ в личку
  expertTelegramUsername?: string;
  // Ключ xAI (Grok) для ультраточного распознавания речи (STT) и работы ассистента
  xaiApiKey?: string;
}


