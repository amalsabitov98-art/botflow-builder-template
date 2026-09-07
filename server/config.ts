import dotenv from "dotenv";

dotenv.config();

export interface ServerConfig {
  allowDevAuthBypass: boolean;
  assistantApiKey: string;
  allowLiveServicesInDev: boolean;
  adminEmail: string;
  adminTelegramChatId: string;
  appUrl: string;
  geminiApiKey: string;
  groqApiKey: string;
  host: string;
  isProduction: boolean;
  lavaApiKey: string;
  lavaWebhookSecret: string;
  nodeEnv: string;
  openaiApiKey: string;
  port: number;
  requireAdminMfa: boolean;
  supabaseServiceKey: string;
  supabaseUrl: string;
  telegramBotToken: string;
  webAppSigningSecret: string;
  xaiApiKey: string;
}

function readEnv(name: string) {
  return (process.env[name] || "").trim();
}

function readBoolean(name: string, defaultValue = false) {
  const value = readEnv(name).toLowerCase();
  if (!value) return defaultValue;
  return value === "1" || value === "true" || value === "yes";
}

export function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();
  return !normalized
    || normalized.includes("your-")
    || normalized.includes("your_")
    || normalized.includes("replace-me")
    || normalized.includes("changeme")
    || normalized.includes("your-project");
}

function validateUrl(name: string, value: string, errors: string[]) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push(`${name} must use http:// or https://`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}

function validateRequiredSecret(name: string, value: string, errors: string[], minLength = 16) {
  if (isPlaceholder(value)) {
    errors.push(`${name} is required`);
  } else if (value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters`);
  }
}

export function loadServerConfig(): ServerConfig {
  const nodeEnv = readEnv("NODE_ENV") || "development";
  const isProduction = nodeEnv === "production";
  const allowLiveServicesInDev = readBoolean("ALLOW_LIVE_SERVICES_IN_DEV");
  const allowDevAuthBypass = !isProduction && readBoolean("ALLOW_DEV_AUTH_BYPASS");
  const allowNetworkBind = isProduction || readBoolean("ALLOW_NETWORK_BIND");
  const rawPort = readEnv("PORT");
  const port = rawPort ? Number(rawPort) : 3000;
  const host = readEnv("HOST") || (isProduction ? "0.0.0.0" : "127.0.0.1");
  const readServiceEnv = (productionName: string, developmentName: string) => {
    if (isProduction) return readEnv(productionName);
    return allowLiveServicesInDev ? readEnv(developmentName) : "";
  };
  const appUrl = isProduction
    ? readEnv("APP_URL")
    : readEnv("DEV_APP_URL") || `http://127.0.0.1:${port}`;
  const supabaseUrl = readServiceEnv("SUPABASE_URL", "DEV_SUPABASE_URL");
  const supabaseServiceKey = readServiceEnv("SUPABASE_SERVICE_KEY", "DEV_SUPABASE_SERVICE_KEY");
  const webAppSigningSecret = readServiceEnv("WEBAPP_SIGNING_SECRET", "DEV_WEBAPP_SIGNING_SECRET");
  const lavaApiKey = readServiceEnv("LAVA_API_KEY", "DEV_LAVA_API_KEY");
  const lavaWebhookSecret = readServiceEnv("LAVA_WEBHOOK_SECRET", "DEV_LAVA_WEBHOOK_SECRET");
  const telegramBotToken = readServiceEnv("TELEGRAM_BOT_TOKEN", "DEV_TELEGRAM_BOT_TOKEN");
  const adminEmail = readServiceEnv("ADMIN_EMAIL", "DEV_ADMIN_EMAIL");
  const adminTelegramChatId = readServiceEnv("ADMIN_TELEGRAM_CHAT_ID", "DEV_ADMIN_TELEGRAM_CHAT_ID");
  // Ключ ассистента живёт только в переменных окружения: в настройках админки
  // он не хранится и не редактируется, поэтому его нечего утекать через API.
  const assistantApiKey = readServiceEnv("DEEPSEEK_API_KEY", "DEV_DEEPSEEK_API_KEY");
  const geminiApiKey = isProduction
    ? readEnv("DEEPSEEK_API_KEY") || readEnv("GEMINI_API_KEY")
    : allowLiveServicesInDev
      ? readEnv("DEV_DEEPSEEK_API_KEY") || readEnv("DEV_GEMINI_API_KEY")
      : "";
  // Ключи распознавания речи. Проходят через ту же изоляцию, что и остальные
  // сервисы: в development боевые значения не читаются без ALLOW_LIVE_SERVICES_IN_DEV.
  const xaiApiKey = readServiceEnv("XAI_API_KEY", "DEV_XAI_API_KEY");
  const groqApiKey = readServiceEnv("GROQ_API_KEY", "DEV_GROQ_API_KEY");
  const openaiApiKey = readServiceEnv("OPENAI_API_KEY", "DEV_OPENAI_API_KEY");
  const requireAdminMfa = readBoolean("REQUIRE_ADMIN_MFA", true);

  const errors: string[] = [];

  if (adminEmail && !adminEmail.includes("@")) {
    errors.push("ADMIN_EMAIL must be a valid email address");
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push("PORT must be a number from 1 to 65535");
  }

  if (!allowNetworkBind && host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    errors.push("Development HOST must be loopback-only unless ALLOW_NETWORK_BIND=true");
  }

  validateUrl("APP_URL", appUrl, errors);

  if (supabaseUrl && !isPlaceholder(supabaseUrl)) {
    validateUrl("SUPABASE_URL", supabaseUrl, errors);
  }

  if (isProduction) {
    if (isPlaceholder(appUrl)) {
      errors.push("APP_URL is required in production");
    } else if (!appUrl.startsWith("https://")) {
      errors.push("APP_URL must use https:// in production");
    }
    if (isPlaceholder(adminEmail)) {
      errors.push("ADMIN_EMAIL is required in production");
    }
    validateRequiredSecret("SUPABASE_SERVICE_KEY", supabaseServiceKey, errors, 24);
    if (isPlaceholder(supabaseUrl)) {
      errors.push("SUPABASE_URL is required in production");
    }
    validateRequiredSecret("WEBAPP_SIGNING_SECRET", webAppSigningSecret, errors, 32);

    if ((lavaApiKey && !lavaWebhookSecret) || (!lavaApiKey && lavaWebhookSecret)) {
      errors.push("LAVA_API_KEY and LAVA_WEBHOOK_SECRET must be configured together");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join("\n- ")}`);
  }

  return {
    allowDevAuthBypass,
    assistantApiKey,
    allowLiveServicesInDev,
    adminEmail,
    adminTelegramChatId,
    appUrl,
    geminiApiKey,
    groqApiKey,
    host,
    isProduction,
    lavaApiKey,
    lavaWebhookSecret,
    nodeEnv,
    openaiApiKey,
    port,
    requireAdminMfa,
    supabaseServiceKey,
    supabaseUrl,
    telegramBotToken,
    webAppSigningSecret,
    xaiApiKey,
  };
}
