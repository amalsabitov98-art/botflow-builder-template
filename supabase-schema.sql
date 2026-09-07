-- ============================================
-- BotFlow Builder: Supabase Schema
-- Запустите этот SQL в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Settings (одна строка с настройками)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  bots JSONB DEFAULT '[]'::jsonb,
  gemini_api_key TEXT DEFAULT '',
  app_url TEXT DEFAULT '',
  notifications BOOLEAN DEFAULT true,
  auto_reminders BOOLEAN DEFAULT true,
  lava_api_key TEXT DEFAULT '',
  lava_webhook_secret TEXT DEFAULT '',
  -- Ключ ИИ-ассистента воронок.
  deepseek_api_key TEXT DEFAULT '',
  -- Telegram Chat ID администратора для уведомлений.
  admin_telegram_chat_id TEXT DEFAULT '',
  -- Ключ xAI (Grok) для STT и ассистента.
  xai_api_key TEXT DEFAULT '',
  -- Username эксперта в Telegram для лички.
  expert_telegram_username TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Для баз, созданных до появления ассистента или уведомлений.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_telegram_chat_id TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS xai_api_key TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS expert_telegram_username TEXT DEFAULT '';

-- Вставляем начальную строку
INSERT INTO settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

-- 2. Funnels (воронки)
CREATE TABLE IF NOT EXISTS funnels (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Subscribers (подписчики)
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT,
  username TEXT,
  language_code TEXT,
  last_active TIMESTAMPTZ DEFAULT now(),
  -- Подписчик заблокировал бота: не трогаем его рассылками.
  bot_blocked_at TIMESTAMPTZ,
  -- Ассистент передал разговор оператору и ждёт ответа человека.
  awaiting_human_reply TIMESTAMPTZ,
  bot_states JSONB DEFAULT '{}'::jsonb
);

-- Для баз, созданных до появления этих полей.
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS bot_blocked_at TIMESTAMPTZ;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS awaiting_human_reply TIMESTAMPTZ;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS bot_states JSONB DEFAULT '{}'::jsonb;

-- 4. Messages (история сообщений)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('bot', 'user')),
  bot_id TEXT,
  funnel_id TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS bot_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS funnel_id TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_bot_chat_created ON messages(bot_id, chat_id, created_at DESC);

-- 5. Orders (заказы)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL DEFAULT '',
  username TEXT DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'refund')),
  date TEXT NOT NULL DEFAULT '',
  bot TEXT DEFAULT '',
  chat_id BIGINT,
  funnel_id TEXT,
  stage_id TEXT,
  offer_id TEXT,
  access_tier TEXT CHECK (access_tier IN ('pkg-1', 'pkg-2')),
  currency TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Lava payment intents
-- Связывает contract id, возвращённый при создании счёта, с Telegram-пользователем.
-- Webhook payment.success присылает тот же идентификатор в contractId.
CREATE TABLE IF NOT EXISTS payment_intents (
  payment_id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  funnel_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('pkg-1', 'pkg-2')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  product TEXT NOT NULL,
  buyer_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at
  ON payment_intents(created_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_tier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS product TEXT;

-- 7. User funnel progress (аналитика прохождения)
CREATE TABLE IF NOT EXISTS user_funnel_progress (
  chat_id BIGINT NOT NULL,
  funnel_id TEXT NOT NULL,
  current_stage_id TEXT,
  current_stage_index INTEGER DEFAULT 0,
  finished BOOLEAN DEFAULT false,
  sent_stages JSONB DEFAULT '[]'::jsonb,
  opened_stages JSONB DEFAULT '[]'::jsonb,
  viewed_stages JSONB DEFAULT '[]'::jsonb,
  completed_stages JSONB DEFAULT '[]'::jsonb,
  purchase_status TEXT DEFAULT 'none' CHECK (purchase_status IN ('none', 'paid', 'pending', 'refund')),
  events JSONB DEFAULT '[]'::jsonb,
  reminder_jobs JSONB DEFAULT '[]'::jsonb,
  last_action_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (chat_id, funnel_id)
);

-- Профиль подписчика: ответы на вопросы воронки.
ALTER TABLE user_funnel_progress ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_funnel_progress_funnel ON user_funnel_progress(funnel_id);
CREATE INDEX IF NOT EXISTS idx_user_funnel_progress_last_action ON user_funnel_progress(last_action_at DESC);
ALTER TABLE user_funnel_progress ADD COLUMN IF NOT EXISTS reminder_jobs JSONB DEFAULT '[]'::jsonb;

-- 8. Append-only administrative security audit
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_occurred_at
  ON admin_audit_log(occurred_at DESC);

-- ============================================
-- Server-only data access
-- The backend uses service_role, which bypasses RLS. Browser roles must never
-- receive table grants or permissive policies for these private tables.
-- ============================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_funnel_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON settings;
DROP POLICY IF EXISTS "Service role full access" ON funnels;
DROP POLICY IF EXISTS "Service role full access" ON subscribers;
DROP POLICY IF EXISTS "Service role full access" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON orders;
DROP POLICY IF EXISTS "Service role full access" ON payment_intents;
DROP POLICY IF EXISTS "Service role full access" ON user_funnel_progress;
DROP POLICY IF EXISTS "Service role full access" ON admin_audit_log;

REVOKE ALL PRIVILEGES ON TABLE settings FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE funnels FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE subscribers FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE messages FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE orders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE payment_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE user_funnel_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE admin_audit_log FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE funnels TO service_role;
GRANT ALL PRIVILEGES ON TABLE subscribers TO service_role;
GRANT ALL PRIVILEGES ON TABLE messages TO service_role;
GRANT ALL PRIVILEGES ON TABLE orders TO service_role;
GRANT ALL PRIVILEGES ON TABLE payment_intents TO service_role;
GRANT ALL PRIVILEGES ON TABLE user_funnel_progress TO service_role;
GRANT SELECT, INSERT ON TABLE admin_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE admin_audit_log_id_seq TO service_role;

-- Storage: only funnel images are public. Videos, PDFs and customer files are private.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'funnel-images',
  'funnel-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media-private',
  'project-media-private',
  false,
  52428800,
  ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The legacy mixed bucket must not remain anonymously downloadable.
UPDATE storage.buckets
SET public = false, file_size_limit = 52428800
WHERE id = 'media';
