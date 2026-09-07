import fs from "fs";
import path from "path";
import crypto from "crypto";
import TelegramBot from "node-telegram-bot-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Funnel, FunnelStage, MessageEntry, Settings, SubscriberProfile } from "../types";

interface TelegramDeliveryDeps {
  activeFunnels: Map<string, Funnel>;
  dataDir: string;
  mediaDir: string;
  globalSubscribers: Map<number, SubscriberProfile>;
  getSettings: () => Settings;
  getSupabase?: () => SupabaseClient | null;
  getTgCache: () => Record<string, any>;
  getWebAppUrl: (funnelId: string, stageId: string, chatId?: number) => string;
  logMessage: (chatId: number, from: 'bot' | 'user', text: string, media?: MessageEntry["media"], scope?: { botId?: string; funnelId?: string }) => Promise<void>;
  saveTgCache: () => Promise<void>;
}

/**
 * Полное экранирование для parse_mode: "HTML". Годится для чужого текста —
 * ответа студента, его имени в Telegram, ответа модели: ни один тег не
 * переживёт подстановку. Без этого один символ "<" в сообщении ломает отправку
 * целиком (Telegram возвращает 400), а имя вида "<b>Одобрено</b>" отрисуется
 * в карточке куратора как настоящая разметка.
 */
export function escapeTelegramHtml(input: string): string {
  if (!input) return "";
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Воронка с этим признаком открывает свои страницы нативной кнопкой Mini App
// (web_app), а не внешней ссылкой. Общая функция: кнопки этапов, напоминаний и
// «продолжить обучение» должны вести себя одинаково.
export function isTelegramMiniAppFunnel(funnel: Funnel | undefined): boolean {
  return funnel?.telegramMiniApp === true;
}

export function createTelegramDeliveryService({
  activeFunnels,
  dataDir,
  mediaDir,
  globalSubscribers,
  getSettings,
  getSupabase,
  getTgCache,
  getWebAppUrl,
  logMessage,
  saveTgCache,
}: TelegramDeliveryDeps) {
  async function persistTgCacheBestEffort() {
    try {
      await saveTgCache();
    } catch (error) {
      console.error("Failed to persist Telegram media cache:", error);
    }
  }

  async function resolvePrivateMediaUrl(mediaSrc: string) {
    const marker = "/api/admin/media/private/";
    const markerIndex = mediaSrc.indexOf(marker);
    if (markerIndex < 0) return mediaSrc;

    const encodedFilename = mediaSrc.slice(markerIndex + marker.length).split(/[?#]/)[0];
    const filename = path.basename(decodeURIComponent(encodedFilename));
    const localPath = path.join(mediaDir, filename);
    if (fs.existsSync(localPath)) return localPath;

    const supabase = getSupabase?.();
    if (!supabase) return mediaSrc;
    const { data, error } = await supabase.storage
      .from("project-media-private")
      .createSignedUrl(filename, 5 * 60);
    return !error && data?.signedUrl ? data.signedUrl : mediaSrc;
  }

  function getMediaCacheKey(bot: TelegramBot, mediaSrc: string) {
    const token = String((bot as any).token || "unknown-token");
    const botHash = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
    return `${botHash}:${mediaSrc}`;
  }

  async function sendVideoNoteHelper(bot: TelegramBot, chatId: number | string, videoNoteSrc: string) {
    const cacheSource = videoNoteSrc;
    videoNoteSrc = await resolvePrivateMediaUrl(videoNoteSrc);
    const tgCache = getTgCache();
    const cacheKey = getMediaCacheKey(bot, cacheSource);
    const cachedFileId = tgCache[cacheKey];

    if (cachedFileId) {
      try {
        console.log(`📹 Sending video note via cached file_id for bot: ${cachedFileId}`);
        return await bot.sendVideoNote(chatId, cachedFileId);
      } catch (cacheErr) {
        console.warn(`⚠️ Failed to send video note by cached file_id, falling back to upload:`, cacheErr);
        delete tgCache[cacheKey];
        await persistTgCacheBestEffort();
      }
    }

    let isLocal = false;
    let resolvedLocalPath = "";

    if (videoNoteSrc.startsWith('/api/media/')) {
      const filename = videoNoteSrc.replace('/api/media/', '');
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    } else if (videoNoteSrc.startsWith('http') && videoNoteSrc.includes('/api/media/')) {
      const filename = videoNoteSrc.split('/api/media/')[1];
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    }

    let finalPath = resolvedLocalPath || videoNoteSrc;
    let isTemp = false;

    if (!isLocal && videoNoteSrc.startsWith('http')) {
      console.log("📹 Downloading remote video note for sending:", videoNoteSrc);
      const tempFilename = `temp-vn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
      const tempPath = path.join(dataDir, tempFilename);
      try {
        const response = await fetch(videoNoteSrc);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(tempPath, buffer);
          finalPath = tempPath;
          isTemp = true;
        } else {
          console.error(`📹 Failed to download remote videoNote (status ${response.status}): ${videoNoteSrc}`);
        }
      } catch (downloadErr) {
        console.error("📹 Error downloading remote videoNote:", downloadErr);
      }
    }

    try {
      console.log("📹 Uploading video note file to Telegram:", finalPath);
      const msg = await bot.sendVideoNote(chatId, finalPath);

      if (msg && msg.video_note && msg.video_note.file_id) {
        const fileId = msg.video_note.file_id;
        tgCache[cacheKey] = fileId;
        await persistTgCacheBestEffort();
        console.log(`✅ Video note uploaded and file_id cached: ${fileId}`);
      }

      if (isTemp && fs.existsSync(finalPath)) {
        try { fs.unlinkSync(finalPath); } catch (_) {}
      }
      return msg;
    } catch (e) {
      console.error("📹 Error in sendVideoNoteHelper during upload/send:", e);
      if (isTemp && fs.existsSync(finalPath)) {
        try { fs.unlinkSync(finalPath); } catch (_) {}
      }
      try {
        console.log("📹 sendVideoNote failed, trying fallback to sendVideo...");
        return await bot.sendVideo(chatId, videoNoteSrc);
      } catch (fallbackErr) {
        console.error("📹 Fallback sendVideo also failed:", fallbackErr);
        throw fallbackErr;
      }
    }
  }

  async function sendPhotoHelper(bot: TelegramBot, chatId: number | string, photoSrc: string, options: any) {
    const cacheSource = photoSrc;
    photoSrc = await resolvePrivateMediaUrl(photoSrc);
    const tgCache = getTgCache();
    const cacheKey = getMediaCacheKey(bot, cacheSource);
    const cachedFileId = tgCache[cacheKey];

    if (cachedFileId) {
      try {
        console.log(`📸 Sending photo via cached file_id: ${cachedFileId}`);
        return await bot.sendPhoto(chatId, cachedFileId, options);
      } catch (cacheErr) {
        console.warn(`⚠️ Failed to send photo by cached file_id, falling back to upload:`, cacheErr);
        delete tgCache[cacheKey];
        await persistTgCacheBestEffort();
      }
    }

    let isLocal = false;
    let resolvedLocalPath = "";

    if (photoSrc.startsWith('/api/media/')) {
      const filename = photoSrc.replace('/api/media/', '');
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    } else if (photoSrc.startsWith('http') && photoSrc.includes('/api/media/')) {
      const filename = photoSrc.split('/api/media/')[1];
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    }

    try {
      const settings = getSettings();
      const source = isLocal ? fs.createReadStream(resolvedLocalPath) : (photoSrc.startsWith('http') ? photoSrc : `${settings.appUrl}${photoSrc}`);
      console.log("📸 Uploading/sending photo to Telegram:", isLocal ? `local stream (${resolvedLocalPath})` : source);
      const msg = await bot.sendPhoto(chatId, source, options);

      if (msg && msg.photo && msg.photo.length > 0) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        tgCache[cacheKey] = fileId;
        await persistTgCacheBestEffort();
        console.log(`✅ Photo uploaded and file_id cached: ${fileId}`);
      }
      return msg;
    } catch (e) {
      console.error("📸 Error in sendPhotoHelper:", e);
      const settings = getSettings();
      const fallbackSource = photoSrc.startsWith('http') ? photoSrc : `${settings.appUrl}${photoSrc}`;
      return await bot.sendPhoto(chatId, fallbackSource, options);
    }
  }

  async function sendVideoHelper(bot: TelegramBot, chatId: number | string, videoSrc: string, options: any) {
    const cacheSource = videoSrc;
    videoSrc = await resolvePrivateMediaUrl(videoSrc);
    const tgCache = getTgCache();
    const cacheKey = getMediaCacheKey(bot, cacheSource);
    const cachedFileId = tgCache[cacheKey];

    if (cachedFileId) {
      try {
        console.log(`📹 Sending video via cached file_id: ${cachedFileId}`);
        return await bot.sendVideo(chatId, cachedFileId, options);
      } catch (cacheErr) {
        console.warn(`⚠️ Failed to send video by cached file_id, falling back to upload:`, cacheErr);
        delete tgCache[cacheKey];
        await persistTgCacheBestEffort();
      }
    }

    let isLocal = false;
    let resolvedLocalPath = "";

    if (videoSrc.startsWith('/api/media/')) {
      const filename = videoSrc.replace('/api/media/', '');
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    } else if (videoSrc.startsWith('http') && videoSrc.includes('/api/media/')) {
      const filename = videoSrc.split('/api/media/')[1];
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    }

    try {
      const settings = getSettings();
      const source = isLocal ? fs.createReadStream(resolvedLocalPath) : (videoSrc.startsWith('http') ? videoSrc : `${settings.appUrl}${videoSrc}`);
      console.log("📹 Uploading/sending video to Telegram:", isLocal ? `local stream (${resolvedLocalPath})` : source);
      const msg = await bot.sendVideo(chatId, source, options);

      if (msg && msg.video && msg.video.file_id) {
        const fileId = msg.video.file_id;
        tgCache[cacheKey] = fileId;
        await persistTgCacheBestEffort();
        console.log(`✅ Video uploaded and file_id cached: ${fileId}`);
      }
      return msg;
    } catch (e) {
      console.error("📹 Error in sendVideoHelper:", e);
      const settings = getSettings();
      const fallbackSource = videoSrc.startsWith('http') ? videoSrc : `${settings.appUrl}${videoSrc}`;
      return await bot.sendVideo(chatId, fallbackSource, options);
    }
  }

  async function sendAnimationHelper(bot: TelegramBot, chatId: number | string, gifSrc: string, options: any) {
    const cacheSource = gifSrc;
    gifSrc = await resolvePrivateMediaUrl(gifSrc);
    const tgCache = getTgCache();
    const cacheKey = getMediaCacheKey(bot, cacheSource);
    const cachedFileId = tgCache[cacheKey];

    if (cachedFileId) {
      try {
        console.log(`🎞️ Sending GIF via cached file_id: ${cachedFileId}`);
        return await bot.sendAnimation(chatId, cachedFileId, options);
      } catch (cacheErr) {
        console.warn(`⚠️ Failed to send GIF by cached file_id, falling back to upload:`, cacheErr);
        delete tgCache[cacheKey];
        await persistTgCacheBestEffort();
      }
    }

    let isLocal = false;
    let resolvedLocalPath = "";

    if (gifSrc.startsWith('/api/media/')) {
      const filename = gifSrc.replace('/api/media/', '');
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    } else if (gifSrc.startsWith('http') && gifSrc.includes('/api/media/')) {
      const filename = gifSrc.split('/api/media/')[1];
      resolvedLocalPath = path.join(mediaDir, filename);
      if (fs.existsSync(resolvedLocalPath)) {
        isLocal = true;
      }
    }

    try {
      const settings = getSettings();
      const source = isLocal ? fs.createReadStream(resolvedLocalPath) : (gifSrc.startsWith('http') ? gifSrc : `${settings.appUrl}${gifSrc}`);
      console.log("🎞️ Uploading/sending GIF to Telegram:", isLocal ? `local stream (${resolvedLocalPath})` : source);
      const msg = await bot.sendAnimation(chatId, source, options);

      if (msg && msg.animation && msg.animation.file_id) {
        const fileId = msg.animation.file_id;
        tgCache[cacheKey] = fileId;
        await persistTgCacheBestEffort();
        console.log(`✅ GIF uploaded and file_id cached: ${fileId}`);
      }
      return msg;
    } catch (e) {
      console.error("🎞️ Error in sendAnimationHelper:", e);
      const settings = getSettings();
      const fallbackSource = gifSrc.startsWith('http') ? gifSrc : `${settings.appUrl}${gifSrc}`;
      return await bot.sendAnimation(chatId, fallbackSource, options);
    }
  }

  function buildInlineKeyboard(
    buttonText: string,
    buttonAction: string | undefined,
    buttonUrl: string | undefined,
    buttonStyle: string | undefined,
    stageId: string,
    funnelId: string,
    webAppEnabled: boolean,
    targetStageId: string | undefined,
    chatId?: number
  ): any[][] {
    const texts = buttonText.split("|").map(t => t.trim());
    const actions = (buttonAction || "").split("|").map(a => a.trim());
    const urls = (buttonUrl || "").split("|").map(u => u.trim());

    const rows = texts.map((text, idx) => {
      const action = actions[idx] || actions[0] || "next_stage";
      const url = urls[idx] || urls[0] || "";
      const btn: any = { text };

      if (action === "open_webapp" && webAppEnabled) {
        const webAppUrl = getWebAppUrl(funnelId, stageId, chatId);
        if (isTelegramMiniAppFunnel(activeFunnels.get(funnelId))) {
          btn.web_app = { url: webAppUrl };
        } else {
          btn.url = webAppUrl;
        }
      } else if (action === "url" && url) {
        let sanitizedUrl = url.trim();
        if (sanitizedUrl.startsWith("@")) {
          sanitizedUrl = `https://t.me/${sanitizedUrl.substring(1)}`;
        } else if (sanitizedUrl && !/^https?:\/\//i.test(sanitizedUrl)) {
          sanitizedUrl = `https://${sanitizedUrl}`;
        }
        btn.url = sanitizedUrl;
      } else {
        if (url && (url.startsWith("stage_") || url.startsWith("next_"))) {
          btn.callback_data = url;
        } else if (targetStageId) {
          btn.callback_data = `next_${targetStageId}`;
        } else {
          btn.callback_data = `stage_${stageId}`;
        }
      }

      return [btn];
    });

    return rows;
  }

  // Делает текст безопасным для parse_mode: "HTML": экранирует случайные < > &,
  // но сохраняет поддерживаемые Telegram теги форматирования. Иначе один символ "<"
  // в тексте ломает отправку всего сообщения (Telegram возвращает 400).
  function sanitizeTelegramHtml(input: string): string {
    if (!input) return "";
    let s = escapeTelegramHtml(input);
    const tags = ["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "code", "pre", "blockquote", "tg-spoiler"];
    for (const tag of tags) {
      s = s
        .replace(new RegExp(`&lt;${tag}&gt;`, "gi"), `<${tag}>`)
        .replace(new RegExp(`&lt;\\/${tag}&gt;`, "gi"), `</${tag}>`);
    }
    // Ссылки вида <a href="...">...</a>
    s = s
      .replace(/&lt;a href="(.*?)"&gt;/gi, (_m, href) => `<a href="${String(href).replace(/&amp;/g, "&")}">`)
      .replace(/&lt;\/a&gt;/gi, "</a>");
    return s;
  }

  async function pinMessageIfEnabled(
    bot: TelegramBot,
    chatId: number | string,
    message: any,
    enabled?: boolean,
  ) {
    if (!enabled || !message?.message_id) return;
    try {
      await bot.pinChatMessage(chatId, message.message_id, { disable_notification: true });
    } catch (error: any) {
      // Закрепление — дополнительная возможность. Не превращаем успешную отправку
      // в ошибку, если у бота нет права закреплять сообщения.
      console.warn(`[TELEGRAM] Не удалось закрепить сообщение ${message.message_id}:`, error?.response?.body?.description || error?.message || "unknown error");
    }
  }

  async function deliverStageMessage(bot: TelegramBot, chatId: number | string, funnel: Funnel, stage: FunnelStage, overrideName?: string) {
    const messageScope = { botId: funnel.connectedBotId, funnelId: funnel.id };
    const subscriber = globalSubscribers.get(Number(chatId));
    const firstName = overrideName || subscriber?.firstName || "друг";

    const text = sanitizeTelegramHtml((stage.firstMessage?.text || "").replace(/{name}/g, firstName));
    const options: any = { parse_mode: "HTML" };

    if (stage.firstMessage?.buttonText) {
      options.reply_markup = {
        inline_keyboard: buildInlineKeyboard(
          stage.firstMessage.buttonText,
          stage.firstMessage.buttonAction,
          stage.firstMessage.buttonUrl,
          stage.firstMessage.buttonStyle,
          stage.id,
          funnel.id,
          !!stage.webApp?.enabled,
          stage.nextStage?.targetStageId,
          Number(chatId)
        ),
      };
    }

    const videoNoteSrc = stage.firstMessage?.videoNote;
    const videoSrc = stage.firstMessage?.video;
    const photoSrc = stage.firstMessage?.photo;
    const gifSrc = stage.firstMessage?.gif;
    const mediaOrder = stage.firstMessage?.mediaOrder || "media_first";
    const mainMedia: MessageEntry["media"] | undefined = videoSrc
      ? { type: "video", url: videoSrc }
      : gifSrc
        ? { type: "animation", url: gifSrc }
        : photoSrc
          ? { type: "photo", url: photoSrc }
          : undefined;
    const videoNoteMedia: MessageEntry["media"] | undefined = videoNoteSrc
      ? { type: "videoNote", url: videoNoteSrc }
      : undefined;

    // Отправка основного медиа (видео / GIF / фото) с подписью-текстом
    const sendMainMediaWithCaption = async () => {
      const captionOpts = { caption: text, parse_mode: options.parse_mode, reply_markup: options.reply_markup };
      if (videoSrc) {
        return await sendVideoHelper(bot, chatId, videoSrc, captionOpts);
      } else if (gifSrc) {
        return await sendAnimationHelper(bot, chatId, gifSrc, captionOpts);
      } else if (photoSrc) {
        return await sendPhotoHelper(bot, chatId, photoSrc, captionOpts);
      } else {
        return await bot.sendMessage(chatId, text, options);
      }
    };

    let messageToPin: any;

    if (videoNoteSrc) {
      if (mediaOrder === "text_first") {
        messageToPin = await sendMainMediaWithCaption();
        await logMessage(Number(chatId), 'bot', text, mainMedia, messageScope);

        console.log("⏱️ Waiting 10 seconds before sending video note...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        await sendVideoNoteHelper(bot, chatId, videoNoteSrc);
        await logMessage(Number(chatId), 'bot', "", videoNoteMedia, messageScope);
      } else {
        await sendVideoNoteHelper(bot, chatId, videoNoteSrc);
        await logMessage(Number(chatId), 'bot', "", videoNoteMedia, messageScope);

        console.log("⏱️ Waiting 10 seconds before sending text message...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        messageToPin = await sendMainMediaWithCaption();
        await logMessage(Number(chatId), 'bot', text, mainMedia, messageScope);
      }
    } else if (videoSrc || gifSrc || photoSrc) {
      if (mediaOrder === "text_first") {
        messageToPin = await bot.sendMessage(chatId, text, options);
        await logMessage(Number(chatId), 'bot', text, undefined, messageScope);

        console.log("⏱️ Waiting 10 seconds before sending media...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        if (videoSrc) {
          await sendVideoHelper(bot, chatId, videoSrc, {});
        } else if (gifSrc) {
          await sendAnimationHelper(bot, chatId, gifSrc, {});
        } else {
          await sendPhotoHelper(bot, chatId, photoSrc, {});
        }
        await logMessage(Number(chatId), 'bot', "", mainMedia, messageScope);
      } else {
        messageToPin = await sendMainMediaWithCaption();
        await logMessage(Number(chatId), 'bot', text, mainMedia, messageScope);
      }
    } else {
      messageToPin = await bot.sendMessage(chatId, text, options);
      await logMessage(Number(chatId), 'bot', text, undefined, messageScope);
    }
    await pinMessageIfEnabled(bot, chatId, messageToPin, stage.firstMessage?.pinMessage);
  }

  return {
    buildInlineKeyboard,
    deliverStageMessage,
    resolvePrivateMediaUrl,
    sanitizeTelegramHtml,
    pinMessageIfEnabled,
  };
}
