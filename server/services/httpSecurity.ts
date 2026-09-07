import fs from "fs";
import path from "path";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isApiPath, isPublicApiPath } from "./adminAuth";

function createLimiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: message },
  });
}

export function applyHttpSecurity(app: express.Express, isProduction: boolean) {
  app.disable("x-powered-by");
  app.set("trust proxy", isProduction ? 1 : false);

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          ...(!isProduction ? ["ws://127.0.0.1:*", "ws://localhost:*"] : []),
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        formAction: ["'self'"],
        // The funnel editor embeds its own public WebApp route in the mobile
        // preview. Keep clickjacking protection for every foreign origin while
        // allowing this same-origin preview to render.
        frameAncestors: ["'self'"],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com",
          "https://t.me",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        // Vite добавляет inline-модуль React Refresh только в development.
        // В production CSP остаётся без unsafe-inline.
        scriptSrc: [
          "'self'",
          "https://telegram.org",
          ...(!isProduction ? ["'unsafe-inline'"] : []),
        ],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  }));

  app.use("/api/webhook/telegram", createLimiter(60_000, 300, "Telegram webhook rate limit exceeded"));
  app.use("/api/webhook/lava", createLimiter(60_000, 60, "Payment webhook rate limit exceeded"));
  app.use("/api/track", createLimiter(60_000, 120, "Tracking rate limit exceeded"));
  app.use("/api/webapp", createLimiter(60_000, 120, "WebApp rate limit exceeded"));
  app.use("/api/payments/create", createLimiter(10 * 60_000, 10, "Payment rate limit exceeded"));
  app.use("/api/payments/mock-success", createLimiter(10 * 60_000, 10, "Payment rate limit exceeded"));
  app.use("/api/media/upload", createLimiter(10 * 60_000, 20, "Upload rate limit exceeded"));
  app.use("/api/broadcast", createLimiter(10 * 60_000, 20, "Broadcast rate limit exceeded"));
  app.use("/api/broadcasts/send", createLimiter(10 * 60_000, 20, "Broadcast send rate limit exceeded"));
  app.use("/api/broadcasts/test", createLimiter(10 * 60_000, 20, "Broadcast test rate limit exceeded"));
  app.use("/api/broadcasts/save", createLimiter(10 * 60_000, 60, "Broadcast save rate limit exceeded"));
  // Предпросмотр аудитории обновляется при редактировании текста, поэтому общий
  // лимит выше, а опасные send/test/save ограничены отдельно выше.
  app.use("/api/broadcasts", createLimiter(10 * 60_000, 300, "Broadcast rate limit exceeded"));
  app.use("/api/admin/broadcast", createLimiter(10 * 60_000, 20, "Broadcast rate limit exceeded"));
}

function normalizeAuditPath(value: string) {
  return value
    .replace(/[0-9]{5,}/g, ":id")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":uuid")
    .slice(0, 240);
}

export function createAuditMiddleware(dataDir: string, getSupabase?: () => SupabaseClient | null) {
  const auditDir = path.join(dataDir, "audit");
  const auditFile = path.join(auditDir, "admin-actions.jsonl");
  fs.mkdirSync(auditDir, { recursive: true, mode: 0o700 });

  return function auditMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!isApiPath(req.path) || isPublicApiPath(req.method, req.path)) {
      return next();
    }

    const startedAt = Date.now();
    res.once("finish", () => {
      const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      const isAuthFailure = res.statusCode === 401 || res.statusCode === 403;
      if (!isMutation && !isAuthFailure) return;

      const adminUser = res.locals.adminUser as { id?: string; email?: string } | undefined;
      const entry = {
        at: new Date().toISOString(),
        action: isAuthFailure ? "admin_api_auth_failed" : "admin_api_mutation",
        actorId: adminUser?.id || null,
        actorEmail: adminUser?.email || null,
        method: req.method,
        path: normalizeAuditPath(req.path),
        bodyFields: req.body && typeof req.body === "object"
          ? Object.keys(req.body).filter((key) => !/token|secret|password|key|payload/i.test(key)).slice(0, 30)
          : [],
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      };

      fs.promises.appendFile(auditFile, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
        .catch((error) => console.error("Failed to write security audit event:", error));

      const supabase = getSupabase?.();
      if (supabase) {
        void supabase.from("admin_audit_log").insert({
          occurred_at: entry.at,
          action: entry.action,
          actor_id: entry.actorId,
          actor_email: entry.actorEmail,
          method: entry.method,
          path: entry.path,
          body_fields: entry.bodyFields,
          status: entry.status,
          duration_ms: entry.durationMs,
        }).then(({ error }) => {
          if (error && error.code !== "42P01") {
            console.error("Failed to persist security audit event:", error.message);
          }
        });
      }
    });

    return next();
  };
}
