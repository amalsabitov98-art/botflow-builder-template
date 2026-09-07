# BotFlow Builder — инструкция для ИИ-ассистента

Ты помогаешь пользователю развернуть его **собственную копию** BotFlow Builder — конструктора Telegram-воронок (React/Vite админка + Express API + Telegram-боты + Supabase). Пользователь может быть новичком: объясняй шаги простым языком и жди его ответов там, где нужны его ключи.

## Правила безопасности

- Никогда не коммить и не выводи в логи содержимое `.env`, ключи Supabase, токены ботов.
- `.env` и `data/` уже в `.gitignore` — не убирай их оттуда.
- Все ключи пользователь создаёт в своих аккаунтах (Supabase, BotFather, Lava.top). Не используй чужие URL и ключи из примеров.

## Шаг 1. Зависимости

Требуется Node.js 20+. Проверь `node --version`; если ниже — помоги установить через nvm или с nodejs.org.

```bash
npm install
```

`ffmpeg`/`ffprobe` нужны только для обработки Telegram video note — можно пропустить и поставить позже (`brew install ffmpeg` на macOS).

## Шаг 2. Файл окружения

```bash
cp .env.example .env
```

Для первого локального запуска достаточно значений по умолчанию — приложение работает без Supabase (данные хранятся в локальных JSON в `data/`). Упрощённый вход включается только явным скриптом `dev:local-login` и только на loopback-интерфейсе.

## Шаг 3. Запуск

```bash
npm run dev:local-login
```

Приложение доступно на `http://localhost:3000`. Проверь `GET /api/health` — должен отвечать 200. Покажи пользователю, что открылась админка.

## Шаг 4. Telegram-бот

1. Попроси пользователя открыть в Telegram бота **@BotFather**, отправить `/newbot` и получить токен.
2. Токен добавляется в разделе настроек админки (можно несколько ботов). Для production безопаснее: в настройках указать placeholder `__ENV_TELEGRAM_BOT_TOKEN__`, а сам токен положить в переменную `TELEGRAM_BOT_TOKEN`.
3. Локально бот работает через polling; в production (NODE_ENV=production + HTTPS `APP_URL`) сервер сам переключает ботов на webhook.
4. Если бот уже задеплоен в production, для локальной разработки создайте **отдельного тестового бота** — иначе локальный polling не будет получать сообщения (webhook имеет приоритет).

## Шаг 5. Supabase (нужен для production, опционален локально)

1. Попроси пользователя создать проект на https://supabase.com (бесплатный тариф подходит).
2. В Supabase **SQL Editor** выполнить содержимое файла `supabase-schema.sql` из корня проекта.
3. В **Project Settings → API** взять: Project URL, `anon` key, `service_role` key.
4. В **Authentication → Users** создать пользователя (email + пароль) — это будет админ.
5. Заполни в `.env`:
   - `SUPABASE_URL`, `VITE_SUPABASE_URL` — Project URL
   - `SUPABASE_SERVICE_KEY` — service_role key (только сервер!)
   - `VITE_SUPABASE_ANON_KEY` — anon key
   - `ADMIN_EMAIL` и `VITE_ADMIN_EMAIL` — email созданного пользователя
6. Для проверки реального dev-Supabase запусти `npm run dev:live-login` и проверь в логах строку `✅ Supabase connected`. Обычная локальная разработка запускается через `npm run dev:local-login`.

## Шаг 6. Production-деплой (опционально)

Проект готов к деплою на Railway (или любой Docker-хостинг) — есть `Dockerfile` и `railway.toml`. Обязательные переменные production перечислены в README, раздел «Railway». Ключевые:

- `NODE_ENV=production`
- `APP_URL` — публичный HTTPS-URL приложения
- `ADMIN_EMAIL` — email админа (без него сервер не стартует)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `WEBAPP_SIGNING_SECRET` — случайная строка от 32 символов (сгенерируй: `openssl rand -hex 32`)

Если сервер падает при старте со строкой `Invalid server configuration` — в сообщении перечислены недостающие переменные.

## Шаг 7. Проверка

- `npm run lint` — проверка типов, `npm run test` — тесты.
- В админке: создать воронку, подключить бота, отправить боту `/start` в Telegram и убедиться, что подписчик появился в разделе «Аудитория».

## Полезно знать

- Платежи: тестовый режим через `/mock-checkout` работает сразу; реальные платежи — Lava.top (`LAVA_API_KEY` + `LAVA_WEBHOOK_SECRET`, webhook `{APP_URL}/api/webhook/lava`).
- WebApp-страницы уроков — это React-компоненты `src/components/CustomStage0-3.tsx`; их редактируют через код (можно просить ИИ переделать под свой оффер).
- ИИ-ассистент воронок: включается в настройках воронки, ключ DeepSeek вводится в разделе «Настройки» админки (переменная `DEEPSEEK_API_KEY` — запасной путь). Подробности и границы действий — в README, раздел «ИИ-ассистент воронки».
- Приложение рассчитано на один инстанс: боты, таймеры напоминаний и очередь рассылок живут в памяти процесса. Подробности и лимиты отправки — в README, раздел «Ограничения масштабирования».
- Хранилище: в production только Supabase; JSON-файлы в `data/` используются исключительно локально и не коммитятся.
