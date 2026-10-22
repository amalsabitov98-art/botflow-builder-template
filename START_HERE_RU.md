# BotFlow: запуск вашей копии

Репозиторий: https://github.com/amalsabitov98-art/botflow-builder-template

Это готовый конструктор Telegram-воронок. GitHub хранит исходники; для работы 24/7 нужны сервер приложения, база данных и свой Telegram-бот.

## Посмотреть на компьютере без аккаунтов

Установите Node.js 20.19+ или актуальную LTS-версию и выполните в папке проекта:

```powershell
npm.cmd ci
$env:NODE_ENV = 'development'
$env:ALLOW_DEV_AUTH_BYPASS = 'true'
$env:VITE_ALLOW_DEV_AUTH_BYPASS = 'true'
node --import tsx/esm server.ts
```

Откройте http://127.0.0.1:3000. Для локального просмотра можно войти с `demo@example.com` и паролем `local-demo-only`. Это демонстрационный вход, аккаунт в Supabase не создаётся. Данные сохраняются в `data/development/`. Остановка сервера: Ctrl+C.

В Linux/macOS вместо переменных PowerShell достаточно `npm ci` и `npm run dev:local-login`.

## Запустить в интернете

### 1. Supabase — база данных и вход администратора

1. Войдите на https://supabase.com/dashboard и создайте отдельный проект для BotFlow. Пароль базы сохраните у себя.
2. Откройте SQL Editor и выполните весь файл `supabase-schema.sql` из этого репозитория.
3. В Authentication → Users создайте своего администратора с email и паролем. Вход в приложение допускает только email из `ADMIN_EMAIL`.
4. Найдите Project URL и API Keys. Публичный publishable key используется браузером; secret key — только сервером. Старые `anon` и `service_role` также поддерживаются. Названия переменных приложения остаются прежними, как в таблице ниже.

### 2. Telegram — ваш бот

Откройте https://t.me/BotFather, отправьте `/newbot`, задайте имя и username. Токен храните у себя; позже он понадобится в переменной `TELEGRAM_BOT_TOKEN` сервера.

### 3. Railway — сервер приложения

Войдите на https://railway.com и подключите репозиторий `amalsabitov98-art/botflow-builder-template` как GitHub-сервис. В корне уже есть `Dockerfile`; отдельная команда сборки не нужна. До запуска проверьте условия и стоимость выбранного размещения.

Задайте Variables:

| Переменная | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `APP_URL` | Полный публичный HTTPS-адрес сервиса Railway |
| `ADMIN_EMAIL` | Email созданного Supabase-пользователя |
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_SERVICE_KEY` | Серверный secret key или legacy service_role |
| `VITE_SUPABASE_URL` | Тот же Project URL |
| `VITE_SUPABASE_ANON_KEY` | Публичный publishable key или legacy anon |
| `WEBAPP_SIGNING_SECRET` | Уникальная случайная строка, минимум 32 символа |
| `TELEGRAM_BOT_TOKEN` | Токен вашего бота |

Секрет подписи можно создать локально: `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Вставьте результат непосредственно в Railway Variables.

Параметры Railway: одна реплика, healthcheck `/api/health`, таймаут 120 секунд. Сгенерируйте публичный домен и укажите его в `APP_URL`. Значения `VITE_*` нужны при сборке: после их изменения пересоберите сервис.

В production загруженные медиа сохраняются в Supabase Storage. Для первого запуска отдельный Railway Volume не требуется. Локальные временные файлы и кэш сервера могут исчезать при пересоздании контейнера.

При первом входе приложение предложит подключить двухфакторную защиту через приложение-аутентификатор.

### 4. Проверить реальную воронку

При первом запуске с `TELEGRAM_BOT_TOKEN` приложение автоматически добавит бота `env_telegram_bot` («Telegram Bot»). Найдите его в настройках; повторно добавлять токен через форму не нужно. Создайте воронку, выберите этого бота и активируйте её. Откройте бота в Telegram, отправьте `/start` и проверьте получение первого сообщения и появление контакта в «Аудитории».

`GET /api/health` должен возвращать `status: "ok"` и `storage: "supabase"`. Проверка локального JSON-режима не заменяет эту проверку.

## Дополнительные функции

Реальные оплаты Lava.top и ИИ-ответы подключаются отдельно. Для первого знакомства ключи платёжного и ИИ-сервиса не нужны. Шаблон имеет тестовый checkout; реальные платежи требуют настройки и проверки.

`.env`, `data/`, пароли и токены не добавляйте в GitHub. Учётные записи и создание ключей выполняет владелец проекта в своих аккаунтах.

## Документация сервисов

- Railway Dockerfile: https://docs.railway.com/guides/dockerfiles
- Railway healthcheck: https://docs.railway.com/guides/healthchecks
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys

