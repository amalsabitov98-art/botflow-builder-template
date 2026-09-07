import crypto from "crypto";
import express from "express";
import type { Funnel, Settings } from "../types";

const WEBAPP_SIGNATURE_TTL_MS = 60 * 60 * 1000;
const TELEGRAM_INIT_DATA_TTL_MS = 10 * 60 * 1000;

interface WebAppAuthDeps {
  activeFunnels: Map<string, Funnel>;
  getSettings: () => Settings;
  getIsProduction: () => boolean;
  getWebAppSigningSecret: () => string;
}

export const WEBAPP_ACTION_EVENTS = new Set([
  "webapp_opened",
  "lesson_viewed",
  "stage_completed",
  "menu_button_opened",
  "profile_opened",
  "profile_continue_clicked",
  "offer_viewed",
  "checkout_started",
]);

export function createWebAppAuth({ activeFunnels, getSettings, getIsProduction, getWebAppSigningSecret }: WebAppAuthDeps) {
  const ephemeralDevelopmentSecret = crypto.randomBytes(32).toString("hex");

  function getSigningSecret() {
    const configuredSecret = getWebAppSigningSecret();
    if (configuredSecret) return configuredSecret;

    return !getIsProduction() ? ephemeralDevelopmentSecret : "";
  }

  function getWebAppSignaturePayload(funnelId: string, stageId: string, chatId: number, authTs: string) {
    return `${funnelId}:${stageId}:${chatId}:${authTs}`;
  }

  function signWebAppUrl(funnelId: string, stageId: string, chatId: number, authTs: string) {
    const secret = getSigningSecret();
    if (!secret) return "";
    return crypto
      .createHmac("sha256", secret)
      .update(getWebAppSignaturePayload(funnelId, stageId, chatId, authTs))
      .digest("hex");
  }

  function timingSafeEqualHex(a: string, b: string) {
    if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");
    if (aBuffer.length !== bBuffer.length) return false;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }

  function verifySignedWebAppRequest(funnelId: string, stageId: string, chatId: number, authTs?: unknown, authSig?: unknown) {
    if (typeof authTs !== "string" || typeof authSig !== "string") {
      return false;
    }

    const issuedAt = Number(authTs);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > WEBAPP_SIGNATURE_TTL_MS) return false;
    if (issuedAt - Date.now() > 5 * 60 * 1000) return false;

    const expected = signWebAppUrl(funnelId, stageId, chatId, authTs);
    return !!expected && timingSafeEqualHex(authSig, expected);
  }

  function parseTelegramInitData(initData: string) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    return { params, hash, dataCheckString };
  }

  function verifyTelegramInitDataForToken(initData: string, botToken: string) {
    const { params, hash, dataCheckString } = parseTelegramInitData(initData);
    if (!hash || !dataCheckString) return null;

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (!timingSafeEqualHex(hash, expectedHash)) return null;

    const authDate = Number(params.get("auth_date") || "0") * 1000;
    if (!authDate || Date.now() - authDate > TELEGRAM_INIT_DATA_TTL_MS) return null;

    const userRaw = params.get("user");
    if (!userRaw) return null;
    try {
      return JSON.parse(userRaw) as { id?: number };
    } catch {
      return null;
    }
  }

  function verifyTelegramInitData(initData: unknown, funnelId: string, chatId: number) {
    if (typeof initData !== "string" || !initData) return false;

    const settings = getSettings();
    const funnel = activeFunnels.get(funnelId);
    const connectedBot = funnel?.connectedBotId
      ? settings.bots.find((bot) => bot.id === funnel.connectedBotId)
      : null;
    const candidates = connectedBot ? [connectedBot] : settings.bots;

    for (const bot of candidates) {
      const user = verifyTelegramInitDataForToken(initData, bot.token);
      if (user?.id === chatId) return true;
    }

    return false;
  }

  function getRequestAuthValue(req: express.Request, key: string) {
    return (req.body && req.body[key] !== undefined)
      ? req.body[key]
      : req.query[key];
  }

  function validateWebAppActionAuth(req: express.Request, funnelId: string, stageId: string, chatId: number) {
    const telegramInitData = req.body?.telegramInitData || req.headers["x-telegram-init-data"];
    if (verifyTelegramInitData(telegramInitData, funnelId, chatId)) {
      return true;
    }

    return verifySignedWebAppRequest(
      funnelId,
      stageId,
      chatId,
      getRequestAuthValue(req, "authTs"),
      getRequestAuthValue(req, "authSig")
    );
  }

  function validateTelegramWebAppAuth(req: express.Request, funnelId: string, chatId: number) {
    const telegramInitData = req.body?.telegramInitData || req.headers["x-telegram-init-data"];
    return verifyTelegramInitData(telegramInitData, funnelId, chatId);
  }

  function getWebAppUrl(appUrl: string, funnelId: string, stageId: string, chatId?: number): string {
    let url = `${appUrl}/?funnel=${funnelId}&stage=${stageId}`;
    if (chatId) {
      const authTs = String(Date.now());
      const authSig = signWebAppUrl(funnelId, stageId, chatId, authTs);
      url += `&chatId=${chatId}&authTs=${authTs}`;
      if (authSig) {
        url += `&authSig=${authSig}`;
      }
    }
    return url;
  }

  return {
    getRequestAuthValue,
    getWebAppUrl,
    validateTelegramWebAppAuth,
    validateWebAppActionAuth,
  };
}
