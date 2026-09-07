import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServerConfig } from "../config";

describe("development service isolation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("не подключает live-сервисы при обычном локальном запуске", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_LIVE_SERVICES_IN_DEV", "false");
    vi.stubEnv("DEV_SUPABASE_URL", "https://dev.example.com");
    vi.stubEnv("DEV_SUPABASE_SERVICE_KEY", "dev-service-key");
    vi.stubEnv("DEV_TELEGRAM_BOT_TOKEN", "dev-bot-token");

    const config = loadServerConfig();

    expect(config.supabaseUrl).toBe("");
    expect(config.supabaseServiceKey).toBe("");
    expect(config.telegramBotToken).toBe("");
  });

  it("использует DEV_* только при явном live-login", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_LIVE_SERVICES_IN_DEV", "true");
    vi.stubEnv("DEV_SUPABASE_URL", "https://dev.example.com");
    vi.stubEnv("DEV_SUPABASE_SERVICE_KEY", "dev-service-key");

    const config = loadServerConfig();

    expect(config.supabaseUrl).toBe("https://dev.example.com");
    expect(config.supabaseServiceKey).toBe("dev-service-key");
  });
});
